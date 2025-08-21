import { NextResponse } from "next/server";
import { connectToMongo, usersCollection } from "../../lib/mongo";
import { KeyDeriver, PrivateKey, Utils, WalletClient, Hash } from "@bsv/sdk";
import { WalletStorageManager, Services, Wallet, StorageClient, WalletSigner } from '@bsv/wallet-toolbox-client'

const CHAIN = process.env.CHAIN;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL;
const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

export async function POST(req) {
    const body = await req.json();
    const { publicKey, certificate } = body;

    console.log("certificate", certificate);
    console.log("certificate.serialNumber type:", typeof certificate.serialNumber);
    console.log("certificate.serialNumber value:", certificate.serialNumber);

    // Validate required certificate fields
    if (!certificate?.serialNumber || !certificate?.revocationOutpoint || !certificate?.subject) {
        return NextResponse.json({ 
            message: 'Invalid certificate structure - missing required fields',
            missing: {
                serialNumber: !certificate?.serialNumber,
                revocationOutpoint: !certificate?.revocationOutpoint,
                subject: !certificate?.subject
            }
        }, { status: 400 });
    }

    const revocationOutpoint = certificate.revocationOutpoint;

    try {
        // Spend tx outpoint
        const wallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);

        // List the spendable tokens within this user's basket (using unique basket name)
        const revocationBasket = `certificate revocation ${certificate.subject} ${certificate.serialNumber.substring(0, 8)}`;
        const list = await wallet.listOutputs({
            basket: revocationBasket,
            include: 'entire transactions',
            limit: 10 // Get more outputs to find the right one
        })

        if (list.outputs.length === 0) {
            return NextResponse.json({ message: 'No revocation tokens found' }, { status: 400 });
        }

        console.log("list", list);
        console.log("Available outpoints:", list.outputs.map(o => ({
            outpoint: o.outpoint,
            satoshis: o.satoshis,
            basket: o.basket
        })));
        console.log("Target revocation outpoint:", revocationOutpoint);

        // Find the matching output that matches the revocation outpoint
        let output = null;
        for (const o of list.outputs) {
            console.log(`Comparing: "${o.outpoint}" === "${revocationOutpoint}"`);
            if (o.outpoint === revocationOutpoint) {
                output = o;
                break;
            }
        }
        
        // If no matching output found, return error - don't use fallback
        if (!output) {
            console.error(`ERROR: No output matching revocation outpoint ${revocationOutpoint}`);
            console.log("Available outputs:", list.outputs.map(o => o.outpoint));
            return NextResponse.json({ 
                message: 'Certificate revocation outpoint not found - this certificate may have been revoked already or belongs to a different session',
                requestedOutpoint: revocationOutpoint,
                availableOutpoints: list.outputs.map(o => o.outpoint),
                basket: revocationBasket,
                suggestion: 'Please refresh your certificate or generate a new one'
            }, { status: 400 });
        }
        
        console.log("Using output:", output);
        
        // Debug: Log the certificate to see what we're working with
        console.log("Full certificate object:", JSON.stringify(certificate, null, 2));

        // Create proper unlocking script for OP_SHA256 OP_EQUAL verification
        // The locking script checks: OP_SHA256 <serialNumberHash> OP_EQUAL
        // So we need to provide the raw serialNumber bytes that hash to the expected value
        console.log("Creating unlocking script for serialNumber:", certificate.serialNumber);
        
        let unlockingScript;
        try {
            // CRITICAL FIX: The server comment says "the unlockingScript is just the serialNumber"
            // The OP_SHA256 opcode will hash whatever bytes are on the stack
            // Since the server hashes the base64 string directly: Hash.sha256(serialNumber)
            // We need to provide the base64 string as UTF-8 bytes so when OP_SHA256 hashes them,
            // it produces the same hash as Hash.sha256(serialNumber)
            const serialNumberStringBytes = Utils.toArray(certificate.serialNumber, 'utf8');
            console.log("Base64 string as UTF-8 bytes length:", serialNumberStringBytes.length);
            console.log("Base64 string as UTF-8 bytes:", serialNumberStringBytes);
            
            // Calculate SHA256 hash of the serialNumber to debug (must match server calculation)
            const sha256Hash = Hash.sha256(certificate.serialNumber);
            console.log("SHA256 hash of serialNumber (base64):", Utils.toHex(sha256Hash));
            
            // Verify our bytes will hash to the same value
            const bytesHash = Hash.sha256(serialNumberStringBytes);
            console.log("SHA256 hash of UTF-8 bytes:", Utils.toHex(bytesHash));
            
            // Create unlocking script with proper minimal encoding
            // For OP_SHA256 OP_EQUAL, we need to push the data onto the stack
            // Push the UTF-8 bytes of the base64 string
            if (serialNumberStringBytes.length <= 75) {
                const scriptBytes = [serialNumberStringBytes.length, ...serialNumberStringBytes];
                unlockingScript = Utils.toHex(scriptBytes);
            } else {
                throw new Error("Serial number string too long for simple push");
            }
            console.log("Created minimally-encoded unlocking script:", unlockingScript);
            
            if (!unlockingScript) {
                throw new Error("Failed to create unlocking script");
            }
        } catch (scriptError) {
            console.error("Error creating unlocking script:", scriptError);
            return NextResponse.json({ 
                message: 'Failed to create unlocking script',
                error: scriptError.message,
                serialNumber: certificate.serialNumber
            }, { status: 400 });
        }

        // Create revocation transaction - spend the token and send satoshis to change
        console.log("Creating action with parameters:", {
            description: 'Certificate revocation',
            inputBEEF: list.BEEF ? 'Present' : 'Missing',
            inputOutpoint: output.outpoint,
            inputSatoshis: output.satoshis,
            unlockingScript: unlockingScript,
            outputSatoshis: output.satoshis
        });

        // Validate all parameters before createAction
        const basketName = `certificate revocation ${certificate.subject}`;
        console.log("Basket name:", basketName);
        console.log("Output outpoint:", output.outpoint);
        console.log("Unlocking script:", unlockingScript);
        console.log("Description:", 'Certificate revocation');
        
        // CRITICAL: Validate output before createAction (fixes trim() error)
        console.log("Validating output before createAction:", output);
        if (!output || !output.outpoint) {
            return NextResponse.json({ 
                message: 'Invalid output or missing outpoint',
                output: output,
                availableOutputs: list.outputs.map(o => ({ outpoint: o.outpoint, satoshis: o.satoshis }))
            }, { status: 400 });
        }

        // Ensure outpoint is a string in correct format
        if (typeof output.outpoint !== 'string' || !output.outpoint.includes('.')) {
            return NextResponse.json({ 
                message: 'Invalid outpoint format',
                outpoint: output.outpoint,
                expectedFormat: 'txid.vout'
            }, { status: 400 });
        }
        
        let tx;
        try {
            // Use the manual approach with proper parameters
            tx = await wallet.createAction({
                description: 'Certificate revocation',
                inputBEEF: list.BEEF,
                inputs: [
                    {
                        inputDescription: 'Certificate revocation',
                        outpoint: output.outpoint,
                        unlockingScript: unlockingScript,
                        unlockingScriptLength: Math.floor(unlockingScript.length / 2)
                    }
                ],
                outputs: []  // Let wallet handle change automatically
            });
            console.log("Transaction created successfully:", tx?.txid || 'No txid');
        } catch (actionError) {
            console.error("Error in wallet.createAction:", actionError);
            return NextResponse.json({ 
                message: 'Failed to create revocation transaction',
                error: actionError.message,
                details: {
                    outpoint: output.outpoint,
                    unlockingScript: unlockingScript,
                    satoshis: output.satoshis
                }
            }, { status: 400 });
        }

        if (!tx) {
            return NextResponse.json({ message: 'Failed to spend certificate outpoint', outpoint: output.outpoint }, { status: 400 });
        }

        // Update certificate in db (remove certificate but preserve DID for reuse)
        await connectToMongo();

        const dbresponse = await usersCollection.updateOne({ _id: publicKey },
            {
                $set: {
                    signedCertificate: null,
                    revokedAt: new Date()
                },
                // Keep did and vcData fields for identity continuity
                $unset: {
                    // Remove certificate-specific data but keep persistent DID
                }
            },
            { upsert: true }
        );

        if (!dbresponse.acknowledged) {
            return NextResponse.json({ message: 'Failed to delete certificate from database', dbresponse }, { status: 400 });
        }

        // Call relinquish certificate
        const userWallet = new WalletClient('auto', 'localhost');
        const relinquishResponse = await userWallet.relinquishCertificate({
            type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
            serialNumber: certificate.serialNumber,
            certifier: serverPubKey,
        });
        console.log("relinquishResponse", relinquishResponse);

        if (!relinquishResponse.relinquished) {
            return NextResponse.json({ message: 'Failed to relinquish certificate', relinquishResponse }, { status: 400 });
        }

        return NextResponse.json({ message: 'Certificate deleted successfully' }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: 'Failed to delete certificate', error }, { status: 400 });
    }
}

async function makeWallet(chain, storageURL, privateKey) {
    const keyDeriver = new KeyDeriver(new PrivateKey(privateKey, 'hex'));
    const storageManager = new WalletStorageManager(keyDeriver.identityKey);
    const signer = new WalletSigner(chain, keyDeriver, storageManager);
    const services = new Services(chain);
    const wallet = new Wallet(signer, services);
    const client = new StorageClient(
        wallet,
        storageURL
    );
    await client.makeAvailable();
    await storageManager.addWalletStorageProvider(client);
    return wallet;
}
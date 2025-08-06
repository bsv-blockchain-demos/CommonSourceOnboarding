import {
    WalletClient,
    PrivateKey,
    KeyDeriver,
    verifyNonce,
    createNonce,
    Utils,
    Certificate,
    MasterCertificate,
    Script,
    Hash
} from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient, WalletSigner } from '@bsv/wallet-toolbox-client'
import { connectToMongo, usersCollection } from '../src/lib/mongo.js'
import dotenv from 'dotenv'
dotenv.config()

const CHAIN = process.env.CHAIN;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL;

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

export async function signCertificate(req, res) {
    try {
        // Body response from Metanet desktop walletclient
        const body = req.body;
        const { clientNonce, type, fields, masterKeyring } = body;
        // Get all wallet info
        const serverWallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);
        const { publicKey: certifier } = await serverWallet.getPublicKey({ identityKey: true });

        const subject = req.auth.identityKey;
        if (!subject || !subject) {
            return res.status(400).json({ error: 'User wallet not found' });
        }

        const wallet = new WalletClient("auto", "localhost");
        if (!wallet) {
            return res.status(400).json({ error: 'User wallet not found' });
        }

        console.log({ subject })

        // Decrypt certificate fields and verify them before signing
        const decryptedFields = await MasterCertificate.decryptFields(
            serverWallet,
            masterKeyring,
            fields,
            subject
        );

        console.log({ decryptedFields }) // PRODUCTION: actually check if we believe this before attesting to it
        
        // Check if this is a VC-structured certificate (new format)
        const isVCCertificate = decryptedFields && decryptedFields.isVC === 'true';
        
        if (isVCCertificate) {
            console.log('Processing W3C VC-structured certificate');
            // Parse the essential VC data from the stringified JSON
            try {
                const essentialVcData = JSON.parse(decryptedFields.vcData);
                console.log('Parsed essential VC data:', essentialVcData);
                
                // Validate DID format
                const subjectDid = essentialVcData.did;
                if (subjectDid && !subjectDid.startsWith('did:bsv:tm did:')) {
                    console.warn('Invalid DID format:', subjectDid);
                }
                
                // Store the essential VC data for database
                decryptedFields.parsedVcData = essentialVcData;
                decryptedFields.isReducedVC = true; // Flag indicating this is reduced data
            } catch (parseError) {
                console.error('Error parsing essential VC data:', parseError);
            }
        } else {
            console.log('Processing legacy certificate format');
        }

        // const valid = await verifyNonce(clientNonce, wallet, subject);
        // if (!valid) {
        //     return res.status(400).json({ error: 'Invalid nonce' });
        // }
        const serverNonce = await createNonce(serverWallet, subject);

        // The server computes a serial number from the client and server nonces
        const { hmac } = await serverWallet.createHmac({
            data: Utils.toArray(clientNonce + serverNonce, 'base64'),
            protocolID: [2, 'certificate issuance'],
            keyID: serverNonce + clientNonce,
            counterparty: subject
        });
        const serialNumber = Utils.toBase64(hmac);
        const hashOfSerialNumber = Utils.toHex(Hash.sha256(serialNumber));

        // Creating certificate revocation tx
        let revocation;
        try {
            revocation = await serverWallet.createAction({
                description: 'Certificate revocation',
                outputs: [
                    {
                        outputDescription: 'Certificate revocation outpoint',
                        satoshis: 1,
                        lockingScript: Script.fromASM(`OP_SHA256 ${hashOfSerialNumber} OP_EQUAL`).toHex(),
                        basket: `certificate revocation ${subject}`,
                        customInstructions: JSON.stringify({
                            serialNumber, // the unlockingScript is just the serialNumber
                        })
                    }
                ],
                options: {
                    randomizeOutputs: false // this ensures the output is always at the same position at outputIndex 0
                }
            });
            console.log("revocationTxid", revocation.txid);
        } catch (revocationError) {
            console.error("Error creating revocation transaction:", revocationError);
            throw revocationError;
        }


        // Signing the new certificate
        const signedCertificate = new Certificate(
            type,
            serialNumber,
            subject,
            certifier,
            revocation.txid + '.0', // randomizeOutputs must be set to false
            fields
        );

        await signedCertificate.sign(serverWallet);

        console.log("signedCertificate", signedCertificate);

        // Save certificate in database
        // EX: {subject: subject, certificate: signedCertificate}
        await connectToMongo();

        const existingCertificate = await usersCollection.findOne({ _id: subject });
        if (existingCertificate) {
            return res.json({ error: 'User already has a certificate' });
        }
        
        // Prepare document for database
        const documentToSave = { 
            signedCertificate: signedCertificate,
            isVCCertificate: isVCCertificate,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // If it's a VC certificate, also extract the DID and essential VC data for easier lookup
        if (isVCCertificate && decryptedFields.parsedVcData) {
            documentToSave.did = decryptedFields.parsedVcData.did;
            documentToSave.essentialVcData = decryptedFields.parsedVcData;
            documentToSave.isReducedVC = decryptedFields.isReducedVC;
        }
        
        await usersCollection.updateOne({ _id: subject }, 
            { $set: documentToSave },
            { upsert: true }
        );
        
        console.log(`Certificate saved for subject: ${subject}, VC format: ${isVCCertificate}`);
        return res.json({ certificate: signedCertificate, serverNonce: serverNonce });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error });
    }
}
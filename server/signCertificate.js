import {
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
// Temporarily comment out MongoDB import to get server running
// import { connectToMongo, usersCollection } from './mongo.js'
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
    console.log('=== Certificate signing request received ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Auth object:', JSON.stringify(req.auth, null, 2));
    try {
        // Body response from Metanet desktop walletclient
        const body = req.body;
        const { clientNonce, type, fields, masterKeyring } = body;
        // Get all wallet info
        const serverWallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);
        const { publicKey: certifier } = await serverWallet.getPublicKey({ identityKey: true });

        const subject = req.auth?.identityKey;
        console.log('[signCertificate] Subject from auth:', subject);
        
        if (!subject) {
            console.log('[signCertificate] No subject in req.auth, this might be expected for certificate issuance');
            // For certificate issuance, we might not have a subject yet
            // The subject should come from the certificate request itself
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
            console.log('Processing W3C VC-structured certificate with minimal fields');
            // For VC certificates, we store the full VC data in MongoDB separately
            // The certificate itself only contains minimal reference fields
            console.log('Certificate fields:', {
                username: decryptedFields.username,
                email: decryptedFields.email,
                didRef: decryptedFields.didRef
            });
        } else {
            console.log('Processing legacy certificate format');
        }

        // Verify client nonce for replay protection
        console.log('Verifying client nonce for replay protection...');
        try {
            const valid = await verifyNonce(clientNonce, serverWallet, subject);
            if (!valid) {
                console.log('Nonce verification failed for subject:', subject);
                return res.status(400).json({ error: 'Invalid client nonce - replay protection failed' });
            }
            console.log('Client nonce verification passed');
        } catch (nonceError) {
            console.error('Error during nonce verification:', nonceError);
            return res.status(400).json({ error: 'Nonce verification error: ' + nonceError.message });
        }
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
            // Create unique basket name using serialNumber to avoid conflicts with old revocation tokens
            const revocationBasket = `certificate revocation ${subject} ${serialNumber.substring(0, 8)}`;
            
            console.log('Creating revocation transaction with params:', {
                description: 'Certificate revocation',
                outputSatoshis: 1,
                basket: revocationBasket,
                serialNumber: serialNumber,
                hashOfSerialNumber: hashOfSerialNumber
            });
            
            revocation = await serverWallet.createAction({
                description: 'Certificate revocation',
                outputs: [
                    {
                        outputDescription: 'Certificate revocation outpoint',
                        satoshis: 1,
                        lockingScript: Script.fromASM(`OP_SHA256 ${hashOfSerialNumber} OP_EQUAL`).toHex(),
                        basket: revocationBasket,
                        customInstructions: JSON.stringify({
                            serialNumber, // the unlockingScript is just the serialNumber
                        })
                    }
                ],
                options: {
                    randomizeOutputs: false // this ensures the output is always at the same position at outputIndex 0
                }
            });
            console.log("revocationTxid created successfully:", revocation.txid);
        } catch (revocationError) {
            console.error("Error creating revocation transaction:", revocationError);
            console.error("Revocation error details:", JSON.stringify(revocationError, null, 2));
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
        // Temporarily comment out MongoDB operations to get server running
        // await connectToMongo();

        // Check for existing DID to enable identity continuity across certificate renewals
        // const existingRecord = await usersCollection.findOne({ _id: subject });
        let existingDid = null;
        
        // if (existingRecord) {
        //     console.log('User has existing record, preserving DID for continuity:', subject);
        //     // Preserve the existing DID for identity continuity
        //     // This allows users to revoke and re-certify without creating a new identity
        //     existingDid = existingRecord.did;
        // }
        
        // Prepare document for database
        const documentToSave = { 
            signedCertificate: signedCertificate,
            isVCCertificate: isVCCertificate,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // If it's a VC certificate, create and store the full VC data separately
        if (isVCCertificate) {
            // Reuse existing DID or generate a persistent DID based on user's public key
            // This allows the same DID to be reused across certificate renewals/reissues
            let userDid = existingDid;
            if (!userDid) {
                const userPubKeyHash = subject.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
                userDid = `did:bsv:${userPubKeyHash}`;
                console.log('Generated new persistent DID:', userDid);
            } else {
                console.log('Reusing existing DID for identity continuity:', userDid);
            }
            
            // Create the full VC structure to store in MongoDB
            const serverPubKeyHash = certifier.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
            const fullVcData = {
                '@context': ['https://www.w3.org/2018/credentials/v1'],
                type: ['VerifiableCredential', 'IdentityCredential'],
                issuer: `did:bsv:${serverPubKeyHash}`,
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: userDid,
                    username: decryptedFields.username,
                    email: decryptedFields.email,
                    residence: decryptedFields.residence || '',
                    age: decryptedFields.age || '',
                    gender: decryptedFields.gender || '',
                    work: decryptedFields.work || ''
                }
            };
            
            documentToSave.did = userDid;
            documentToSave.vcData = fullVcData;
            documentToSave.didRef = decryptedFields.didRef;
        }
        
        // Use the certificate subject as the ID
        const documentId = signedCertificate.subject || subject;
        console.log('DEBUG: signedCertificate.subject:', signedCertificate.subject);
        console.log('DEBUG: subject:', subject);
        console.log('DEBUG: documentId:', documentId);
        
        if (!documentId) {
            throw new Error('Document ID is null or undefined - cannot save certificate');
        }
        
        // Temporarily comment out database save operation
        // await usersCollection.updateOne({ _id: documentId }, 
        //     { $set: documentToSave },
        //     { upsert: true }
        // );
        
        console.log(`Certificate would be saved for subject: ${documentId}, VC format: ${isVCCertificate} (MongoDB disabled temporarily)`);
        
        // BSV SDK's acquireCertificate expects just the certificate object
        // Not wrapped in any protocol response
        console.log('Returning signed certificate directly to BSV SDK');
        console.log('Certificate type:', signedCertificate.type);
        console.log('Certificate serialNumber:', signedCertificate.serialNumber);
        console.log('Certificate subject:', signedCertificate.subject);
        console.log('Certificate certifier:', signedCertificate.certifier);
        
        res.setHeader('Content-Type', 'application/json');
        return res.json(signedCertificate);
    } catch (error) {
        console.error('Certificate signing error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message || error });
    }
}
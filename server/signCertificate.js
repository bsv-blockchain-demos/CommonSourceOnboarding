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
    console.log('Request has BSV auth headers:', !!req.headers['x-bsv-auth-identity-key']);
    
    try {
        // Body response from Metanet desktop walletclient
        const body = req.body;
        const { clientNonce, type, fields, masterKeyring } = body;
        
        // Extract subject from BSV auth headers since we're not using auth middleware
        const subject = req.headers['x-bsv-auth-identity-key'];
        console.log('[signCertificate] Subject from headers:', subject);
        
        if (!subject) {
            console.error('[signCertificate] No subject identity key found in headers');
            return res.status(400).json({ error: 'Missing identity key in request headers' });
        }

        // Get all wallet info
        const serverWallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);
        const { publicKey: certifier } = await serverWallet.getPublicKey({ identityKey: true });

        console.log({ subject })

        // Decrypt certificate fields and verify them before signing
        const decryptedFields = await MasterCertificate.decryptFields(
            serverWallet,
            masterKeyring,
            fields,
            subject
        );

        console.log('Fields decrypted, isVC:', decryptedFields?.isVC);
        
        // Check if this is a VC-structured certificate (new format)
        const isVCCertificate = decryptedFields && decryptedFields.isVC === 'true';

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
        
        // BSV SDK's acquireCertificate expects the certificate as a plain object
        // Need to serialize the Certificate properly
        console.log('Returning signed certificate directly to BSV SDK');
        console.log('Certificate type:', signedCertificate.type);
        console.log('Certificate serialNumber:', signedCertificate.serialNumber);
        console.log('Certificate subject:', signedCertificate.subject);
        console.log('Certificate certifier:', signedCertificate.certifier);
        
        // CRITICAL: Check if certificate has signature
        console.log('CERT DEBUG - Has signature:', !!signedCertificate.signature);
        console.log('CERT DEBUG - Signature length:', signedCertificate.signature?.length);
        
        // Convert Certificate object to plain object for JSON serialization
        // Ensure fields is an object, not an array or null
        const certificateForResponse = {
            type: signedCertificate.type,
            serialNumber: signedCertificate.serialNumber,
            subject: signedCertificate.subject,
            certifier: signedCertificate.certifier,
            revocationOutpoint: signedCertificate.revocationOutpoint,
            signature: signedCertificate.signature,
            fields: signedCertificate.fields || {}
        };
        
        console.log('CERT DEBUG - Fields type:', typeof certificateForResponse.fields);
        console.log('CERT DEBUG - Fields is array:', Array.isArray(certificateForResponse.fields));
        
        console.log('CERT RESPONSE - All fields present:', {
            type: !!certificateForResponse.type,
            serialNumber: !!certificateForResponse.serialNumber,
            subject: !!certificateForResponse.subject,
            certifier: !!certificateForResponse.certifier,
            revocationOutpoint: !!certificateForResponse.revocationOutpoint,
            signature: !!certificateForResponse.signature,
            fields: !!certificateForResponse.fields
        });
        
        // Try returning just the certificate object directly
        // The BSV SDK acquireCertificate might expect the raw certificate object
        console.log('Returning certificate object directly (no wrapper)');
        console.log('Certificate has all required fields:', {
            type: !!certificateForResponse.type,
            serialNumber: !!certificateForResponse.serialNumber,
            subject: !!certificateForResponse.subject,
            certifier: !!certificateForResponse.certifier,
            revocationOutpoint: !!certificateForResponse.revocationOutpoint,
            signature: !!certificateForResponse.signature
        });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', '*');
        
        return res.status(200).json(certificateForResponse);
    } catch (error) {
        console.error('Certificate signing error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message || error });
    }
}
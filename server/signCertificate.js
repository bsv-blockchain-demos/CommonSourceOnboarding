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
        console.log('[signCertificate] Full request body:', JSON.stringify(body, null, 2));
        const { clientNonce, type, fields, masterKeyring, acquisitionProtocol } = body;
        
        // Extract subject from BSV auth headers since we're not using auth middleware
        const subject = req.headers['x-bsv-auth-identity-key'];
        console.log('[signCertificate] Subject from headers:', subject);
        console.log('[signCertificate] All headers:', JSON.stringify(req.headers, null, 2));
        
        if (!subject) {
            console.error('[signCertificate] No subject identity key found in headers');
            // Return BRC-103 binary error format instead of JSON
            const errorMessage = 'Missing identity key in request headers';
            const responseWriter = new Utils.Writer();
            responseWriter.writeUInt8(1); // Error code (1 = error)
            const messageBytes = Utils.toArray(errorMessage, 'utf8');
            responseWriter.writeUInt32LE(messageBytes.length); // Message length
            responseWriter.write(messageBytes);
            return res.status(400).send(Buffer.from(responseWriter.toArray()));
        }

        // Get all wallet info
        const serverWallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);
        const { publicKey: certifier } = await serverWallet.getPublicKey({ identityKey: true });

        console.log({ subject })

        console.log('[signCertificate] Processing certificate with BSV SDK patterns');
        
        let decryptedFields;
        
        // Check if certificate data is already unencrypted (new format)
        const isAlreadyDecrypted = fields && (fields.isVC === 'true' || fields.isDID === 'true');
        
        if (isAlreadyDecrypted) {
            console.log('[signCertificate] Certificate data is already unencrypted, using fields directly');
            decryptedFields = fields;
        } else {
            // Legacy encrypted certificate handling
            console.log('[signCertificate] Processing encrypted certificate with BSV SDK patterns');
            if (!masterKeyring || !clientNonce) {
                console.error('[signCertificate] Encrypted certificate requires masterKeyring and clientNonce');
                // Return BRC-103 binary error format instead of JSON
                const errorMessage = 'Encrypted certificate requires masterKeyring and clientNonce';
                const responseWriter = new Utils.Writer();
                responseWriter.writeUInt8(1); // Error code (1 = error)
                const messageBytes = Utils.toArray(errorMessage, 'utf8');
                responseWriter.writeUInt32LE(messageBytes.length); // Message length
                responseWriter.write(messageBytes);
                return res.status(400).send(Buffer.from(responseWriter.toArray()));
            }
            
            // Decrypt certificate fields using BSV SDK patterns
            decryptedFields = await MasterCertificate.decryptFields(
                serverWallet,
                masterKeyring,
                fields,
                subject
            );
        }

        console.log('Fields processed, isVC:', decryptedFields?.isVC, 'isDID:', decryptedFields?.isDID);
        
        // Check certificate types
        const isVCCertificate = decryptedFields && decryptedFields.isVC === 'true';
        const isDIDCertificate = decryptedFields && decryptedFields.isDID === 'true';

        // Verify client nonce for replay protection (standard BSV pattern for all certificates)
        console.log('Verifying client nonce for replay protection...');
        let serverNonce, validatedClientNonce;
        try {
            const valid = await verifyNonce(clientNonce, serverWallet, subject);
            if (!valid) {
                console.log('Nonce verification failed for subject:', subject);
                // Return BRC-103 binary error format instead of JSON
                const errorMessage = 'Invalid client nonce - replay protection failed';
                const responseWriter = new Utils.Writer();
                responseWriter.writeUInt8(1); // Error code (1 = error)
                const messageBytes = Utils.toArray(errorMessage, 'utf8');
                responseWriter.writeUInt32LE(messageBytes.length); // Message length
                responseWriter.write(messageBytes);
                return res.status(400).send(Buffer.from(responseWriter.toArray()));
            }
            console.log('Client nonce verification passed');
            validatedClientNonce = clientNonce;
        } catch (nonceError) {
            console.error('Error during nonce verification:', nonceError);
            // Return BRC-103 binary error format instead of JSON
            const errorMessage = 'Nonce verification error: ' + nonceError.message;
            const responseWriter = new Utils.Writer();
            responseWriter.writeUInt8(1); // Error code (1 = error)
            const messageBytes = Utils.toArray(errorMessage, 'utf8');
            responseWriter.writeUInt32LE(messageBytes.length); // Message length
            responseWriter.write(messageBytes);
            return res.status(400).send(Buffer.from(responseWriter.toArray()));
        }
        serverNonce = await createNonce(serverWallet, subject);

        // The server computes a serial number from the client and server nonces
        const { hmac } = await serverWallet.createHmac({
            data: Utils.toArray(validatedClientNonce + serverNonce, 'base64'),
            protocolID: [2, 'certificate issuance'],
            keyID: serverNonce + validatedClientNonce,
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
            isDIDCertificate: isDIDCertificate,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Handle VC certificate processing
        if (isVCCertificate) {
            console.log('[signCertificate] Processing VC certificate for database storage');
            
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
        
        // Handle DID certificate processing
        if (isDIDCertificate) {
            console.log('[signCertificate] Processing DID certificate for database storage');
            
            // Store DID-specific data
            documentToSave.didId = decryptedFields.didId;
            documentToSave.didDocument = decryptedFields.didDocument;
            documentToSave.didVersion = decryptedFields.version || '1.0';
            documentToSave.didCreated = decryptedFields.created;
            documentToSave.didUpdated = decryptedFields.updated;
            
            console.log('[signCertificate] DID certificate data prepared:', {
                didId: documentToSave.didId,
                didVersion: documentToSave.didVersion,
                didCreated: documentToSave.didCreated,
                didUpdated: documentToSave.didUpdated
            });
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
        
        console.log(`Certificate would be saved for subject: ${documentId}, VC format: ${isVCCertificate}, DID format: ${isDIDCertificate} (MongoDB disabled temporarily)`);
        
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
        
        // Return certificate in BRC-103 binary format for MetaNet Desktop acquireCertificate
        console.log('Returning certificate in BRC-103 binary format for MetaNet Desktop...');
        
        // Set appropriate headers for binary response
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', '*');
        
        console.log('Converting certificate to binary format using BSV SDK');
        
        // COMPREHENSIVE VALIDATION: Check certificate is ready for binary conversion
        if (!signedCertificate.signature) {
            throw new Error('Certificate signature is missing - cannot convert to binary');
        }
        if (!signedCertificate.serialNumber || !signedCertificate.subject || !signedCertificate.certifier) {
            throw new Error('Certificate missing required fields for binary conversion');
        }
        
        console.log('VALIDATION: Certificate structure validated, proceeding with binary conversion');
        console.log('CERT FIELDS:', {
            type: !!signedCertificate.type,
            serialNumber: !!signedCertificate.serialNumber, 
            subject: !!signedCertificate.subject,
            certifier: !!signedCertificate.certifier,
            fields: !!signedCertificate.fields,
            signature: !!signedCertificate.signature
        });
        
        // Convert certificate to binary format using BSV SDK's toBinary method
        let certBinary;
        try {
            certBinary = signedCertificate.toBinary();
            console.log('BINARY CONVERSION: Success, certificate binary length:', certBinary.length);
            
            // Validate binary data
            if (!certBinary || certBinary.length === 0) {
                throw new Error('toBinary() returned empty or null data');
            }
            if (!(certBinary instanceof Uint8Array) && !Array.isArray(certBinary)) {
                throw new Error('toBinary() returned non-array-like object: ' + typeof certBinary);
            }
            
            console.log('BINARY VALIDATION: Binary data type:', Object.prototype.toString.call(certBinary));
            console.log('BINARY VALIDATION: First 10 bytes:', Array.from(certBinary.slice(0, 10)));
            console.log('BINARY VALIDATION: Last 10 bytes:', Array.from(certBinary.slice(-10)));
            
        } catch (binaryError) {
            console.error('BINARY CONVERSION ERROR:', binaryError);
            throw new Error(`Certificate toBinary() failed: ${binaryError.message}`);
        }
        
        // TEST: Try returning certificate binary directly (without Utils.Writer wrapper)
        // This tests if the issue is with our BRC-103 success byte prefix format
        const USE_DIRECT_BINARY = process.env.USE_DIRECT_BINARY === 'true';
        
        if (USE_DIRECT_BINARY) {
            console.log('ALTERNATIVE TEST: Returning certificate binary directly (no success byte)');
            return res.status(200).send(Buffer.from(certBinary));
        }
        
        // Return the binary certificate data as required by BRC-103 protocol
        const responseWriter = new Utils.Writer();
        responseWriter.writeUInt8(0); // Success code (0 = success)
        responseWriter.write(certBinary);
        const responseData = responseWriter.toArray();
        
        console.log('RESPONSE WRITER: Success, total response length:', responseData.length);
        console.log('RESPONSE WRITER: Response data type:', Object.prototype.toString.call(responseData));
        console.log('RESPONSE WRITER: First 5 bytes:', Array.from(responseData.slice(0, 5)));
        
        // ADDITIONAL TEST: Validate that responseData is array-like before sending
        if (!responseData || responseData.length === 0) {
            throw new Error('Utils.Writer.toArray() returned empty data');
        }
        if (!(responseData instanceof Uint8Array) && !Array.isArray(responseData)) {
            throw new Error('Utils.Writer.toArray() returned non-array-like object: ' + typeof responseData);
        }
        
        return res.status(200).send(Buffer.from(responseData));
    } catch (error) {
        console.error('Certificate signing error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Return BRC-103 binary error format instead of JSON
        const errorMessage = error.message || 'Unknown certificate signing error';
        const responseWriter = new Utils.Writer();
        responseWriter.writeUInt8(1); // Error code (1 = error)
        const messageBytes = Utils.toArray(errorMessage, 'utf8');
        responseWriter.writeUInt32LE(messageBytes.length);
        responseWriter.write(messageBytes);
        return res.status(500).send(Buffer.from(responseWriter.toArray()));
    }
}
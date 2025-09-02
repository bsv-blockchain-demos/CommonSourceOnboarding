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

// 🔄 Helper function to detect HTTPWalletJSON requests
function isHTTPWalletJSONRequest(req, acquisitionProtocol) {
    return req.headers['content-type']?.includes('application/json') ||
           req.headers['accept']?.includes('application/json') ||
           req.headers['user-agent']?.includes('HTTPWalletJSON') ||
           acquisitionProtocol === 'issuance'; // HTTPWalletJSON typically uses issuance protocol
}

// 🔄 Helper function to return error response in appropriate format
function sendErrorResponse(res, errorMessage, statusCode = 400, isJSON = false) {
    if (isJSON) {
        // Return JSON error for HTTPWalletJSON
        return res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    } else {
        // Return BRC-103 binary error format
        const responseWriter = new Utils.Writer();
        responseWriter.writeUInt8(1); // Error code (1 = error)
        const messageBytes = Utils.toArray(errorMessage, 'utf8');
        responseWriter.writeUInt32LE(messageBytes.length); // Message length
        responseWriter.write(messageBytes);
        return res.status(statusCode).send(Buffer.from(responseWriter.toArray()));
    }
}

export async function signCertificate(req, res) {
    console.log('=== Certificate signing request received ===');
    console.log('Request has BSV auth headers:', !!req.headers['x-bsv-auth-identity-key']);
    
    try {
        // Body response from Metanet desktop walletclient
        const body = req.body;
        console.log('[signCertificate] Full request body:', JSON.stringify(body, null, 2));
        const { clientNonce, type, fields, masterKeyring, acquisitionProtocol, subject: subjectFromBody } = body;
        
        // Extract subject from BSV auth headers OR request body (for issuance protocol)
        let subject = req.headers['x-bsv-auth-identity-key'] || subjectFromBody;
        console.log('[signCertificate] Subject from headers:', req.headers['x-bsv-auth-identity-key']);
        console.log('[signCertificate] Subject from body:', subjectFromBody);
        console.log('[signCertificate] Using subject:', subject);
        
        // 🔄 Detect request type early for error handling
        const isJSONRequest = isHTTPWalletJSONRequest(req, acquisitionProtocol);
        
        if (!subject) {
            console.error('[signCertificate] No subject identity key found in headers or request body');
            return sendErrorResponse(res, 'Missing identity key in request headers or body', 400, isJSONRequest);
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
                return sendErrorResponse(res, 'Encrypted certificate requires masterKeyring and clientNonce', 400, isJSONRequest);
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
        console.log('DEBUG: Decrypted fields received by server:', decryptedFields);
        console.log('DEBUG: Over18 field specifically:', { over18: decryptedFields?.over18, type: typeof decryptedFields?.over18 });
        
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
                return sendErrorResponse(res, 'Invalid client nonce - replay protection failed', 400, isJSONRequest);
            }
            console.log('Client nonce verification passed');
            validatedClientNonce = clientNonce;
        } catch (nonceError) {
            console.error('Error during nonce verification:', nonceError);
            return sendErrorResponse(res, 'Nonce verification error: ' + nonceError.message, 400, isJSONRequest);
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
        // IMPORTANT: Use original fields (encrypted if applicable), not decryptedFields
        // The certificate should contain the original field format as sent by the client
        const signedCertificate = new Certificate(
            type,
            serialNumber,
            subject,
            certifier,
            revocation.txid + '.0', // randomizeOutputs must be set to false
            fields  // Use original fields, not decryptedFields
        );

        await signedCertificate.sign(serverWallet);

        console.log("signedCertificate", signedCertificate);

        // Certificate signed successfully
        let existingDid = null;
        
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
            
            // Create the full VC structure to store in MongoDB with comprehensive fields
            const serverPubKeyHash = certifier.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
            const fullVcData = {
                '@context': ['https://www.w3.org/2018/credentials/v1'],
                type: ['VerifiableCredential', 'IdentityCredential'],
                issuer: `did:bsv:${serverPubKeyHash}`,
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: userDid,
                    // New comprehensive fields
                    firstName: decryptedFields.firstName || '',
                    lastName: decryptedFields.lastName || '',
                    birthdate: decryptedFields.birthdate || '',
                    over18: decryptedFields.over18 || 'false',
                    gender: decryptedFields.gender || '',
                    email: decryptedFields.email || '',
                    occupation: decryptedFields.occupation || '',
                    country: decryptedFields.country || '',
                    provinceState: decryptedFields.provinceState || '',
                    city: decryptedFields.city || '',
                    streetAddress: decryptedFields.streetAddress || '',
                    postalCode: decryptedFields.postalCode || '',
                    // Legacy fields for backwards compatibility
                    username: decryptedFields.username || `${decryptedFields.firstName || ''} ${decryptedFields.lastName || ''}`.trim(),
                    residence: decryptedFields.residence || `${decryptedFields.city || ''}, ${decryptedFields.country || ''}`.replace(', ', ', ').trim(),
                    work: decryptedFields.work || decryptedFields.occupation || ''
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
        
        console.log(`Certificate signed for subject: ${documentId}, VC format: ${isVCCertificate}, DID format: ${isDIDCertificate}`);
        
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
        console.log('CERT DEBUG - Signature type:', typeof signedCertificate.signature);
        console.log('CERT DEBUG - Signature first 16 chars:', signedCertificate.signature?.toString().substring(0, 16));
        
        // Format response following bsva-certs pattern
        // This works with the auth middleware's response wrapping
        const protocolResponse = {
            protocol: 'issuance',
            certificate: signedCertificate,
            serverNonce: serverNonce,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        console.log('Returning certificate response with protocol wrapper:', {
            hasProtocol: !!protocolResponse.protocol,
            hasCertificate: !!protocolResponse.certificate,
            hasServerNonce: !!protocolResponse.serverNonce,
            hasTimestamp: !!protocolResponse.timestamp,
            hasVersion: !!protocolResponse.version
        });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Certificate-Protocol', 'issuance');
        return res.json(protocolResponse);
    } catch (error) {
        console.error('Certificate signing error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        // BRC-104 compliant error response format
        const { acquisitionProtocol } = req.body || {};
        const isJSONRequest = req.auth?.isHTTPWalletJSON || res.locals.needsRawJSON || isHTTPWalletJSONRequest(req, acquisitionProtocol);
        const errorMessage = error.message || 'Unknown certificate signing error';
        
        console.log('[ERROR] BRC-104 error response format:', {
            isJSONRequest: isJSONRequest,
            isHTTPWalletJSON: req.auth?.isHTTPWalletJSON,
            needsRawJSON: res.locals.needsRawJSON,
            errorMessage: errorMessage
        });
        
        return sendErrorResponse(res, errorMessage, 500, isJSONRequest);
    }
}
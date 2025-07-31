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
import { connectToMongo } from '../lib/mongo'
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
        const revocation = await serverWallet.createAction({
            description: 'Certificate revocation',
            outputs: [
                {
                    outputDescription: 'Certificate revocation outpoint',
                    satoshis: 1,
                    lockingScript: Script.fromASM(`OP_SHA256 ${hashOfSerialNumber} OP_EQUAL`).toHex(),
                    basket: 'certificate revocation',
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
        // EX: {subject: subject, serialNumber: serialNumber, certificate: signedCertificate, revocationTxid: revocation.txid}
        await connectToMongo();
        
        await usersCollection.updateOne({ _id: subject }, 
            { $set: { 
                signedCertificate: signedCertificate,
                revocationTxid: revocation.txid,
                serialNumber: serialNumber,
            } },
            { upsert: true }
        );
        return res.json({ certificate: signedCertificate, serverNonce: serverNonce });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error });
    }
}
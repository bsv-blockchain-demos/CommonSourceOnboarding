import { Certificate, createNonce, verifyNonce, PrivateKey, KeyDeriver, Utils, P2PKH, WalletClient } from "@bsv/sdk";
import { Wallet, WalletStorageManager, WalletSigner, Services, StorageClient } from "@bsv/wallet-toolbox"
import dotenv from "dotenv";
dotenv.config();

// Receive certifacte with encrypted fields from walletclient after calling acquireCertificate, 
// verify fields and send back to wallet with  signature (call .sign()) add server nonce
// For 3rd party to get this new certificate, check FetchAuth docs

const CHAIN = process.env.CHAIN;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
//const SERVER_PUBLIC_KEY = process.env.SERVER_PUBLIC_KEY;
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL;

export async function signCertificate(req, res) {
    try {
        // Body response from Metanet desktop walletclient
        const body = req.body;
        const { clientNonce, type, fields, masterKeyring } = body;
        console.log("body", body);

        // Get all wallet info
        const userWallet = new WalletClient('auto', 'localhost');
        const userPubKey = await userWallet.getPublicKey({ identityKey: true });
        const serverWallet = makeWallet(CHAIN === 'testnet' ? 'test' : 'main', WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);

        if (!userWallet || !userPubKey) {
            return res.status(400).json({ error: 'User wallet not found' });
        }
        
        const valid = await verifyNonce(clientNonce, userWallet, userPubKey);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid nonce' });
        }
        const serverNonce = createNonce(serverWallet, userPubKey);

        // // Decrypt certificate fields and verify them before signing
        // const decryptedFields = await MasterCertificate.decryptFields(
        //     serverWallet,
        //     masterKeyring,
        //     fields,
        //     userPubKey
        // );

        // The server computes a serial number from the client and server nonces
        const { hmac } = await serverWallet.createHmac({
            data: Utils.toArray(clientNonce + serverNonce, 'base64'),
            protocolID: [2, 'certificate issuance'],
            keyID: serverNonce + clientNonce,
            counterparty: userPubKey
        });
        const serialNumber = Utils.toBase64(hmac);

        const publicKeyForTx = await serverWallet.getPublicKey({ protocolID: [0, 'revocation'], keyID: "1"}).publicKey;

        // Creating certificate revocation tx
        const revocationTxid = await serverWallet.createAction({
            description: 'Certificate revocation',
            outputs: [
                {
                    outputDescription: 'Certificate revocation outpoint',
                    satoshis: 1,
                    lockingScript: new P2PKH.lock(Utils.toArray(publicKeyForTx, 'base64').toHash().toHex())
                }
            ]
        });
        console.log("revocationTxid", revocationTxid);

        // Signing the new certificate
        const signedCertificate = new Certificate({
            type: type,
            serialNumber: serialNumber,
            subject: userPubKey,
            certifier: (await serverWallet.getPublicKey({ identityKey: true })).publicKey,
            revocationOutpoint: revocationTxid.outpoint[0],
            fields: fields
        });

        await signedCertificate.sign(serverWallet);

        console.log("signedCertificate", signedCertificate);
        return res.json({ certificate: signedCertificate, serverNonce: serverNonce });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error });
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

export default signCertificate;
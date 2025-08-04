import NextResponse from "next/server";
import { connectToMongo, usersCollection } from "../../lib/mongo";
import { KeyDeriver, PrivateKey, Script, Utils, Hash, WalletClient } from "@bsv/sdk";
import { WalletStorageManager, Services, Wallet, StorageClient, WalletSigner } from '@bsv/wallet-toolbox-client'

const CHAIN = process.env.CHAIN;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL;
const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

export async function POST(req) {
    const body = await req.json();
    const { publicKey, certificate } = body;

    console.log("certificate", certificate);

    const { txid, outpoint } = certificate.revocationOutpoint.split('.');
    console.log(txid);
    console.log(outpoint);

    // Create serial number hash for the unlocking script
    const hashOfSerialNumber = Utils.toHex(Hash.sha256(certificate.serialNumber));

    try {
        // Spend tx outpoint
        const wallet = await makeWallet(CHAIN, WALLET_STORAGE_URL, SERVER_PRIVATE_KEY);
        const tx = await wallet.createAction({
            description: 'Certificate revocation',
            inputs: [
                {
                    inputDescription: 'Certificate revocation',
                    txid,
                    outpoint,
                    unlockingScript: Script.fromASM(`OP_SHA256 ${hashOfSerialNumber} OP_EQUAL`).toHex(),
                }
            ],
        });
        console.log("tx", tx);

        if (!tx) {
            return NextResponse.json({ message: 'Failed to spend certificate outpoint', txid, outpoint }, { status: 400 });
        }

        // Delete cert from the db
        await connectToMongo();

        const dbresponse = await usersCollection.updateOne({ _id: publicKey },
            {
                $set: {
                    signedCertificate: null,
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
import { NextResponse } from "next/server";
import { WalletClient, Utils } from "@bsv/sdk";

export async function POST(req) {
    try {
        const userWallet = new WalletClient('auto', 'localhost');
        
        // List all certificates first
        const certificatesResponse = await userWallet.listCertificates({
            certifiers: [process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY],
            types: [Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8'))]
        });
        
        console.log('Found certificates response:', certificatesResponse);
        const certificates = certificatesResponse.certificates || [];
        
        // Relinquish all certificates
        const results = [];
        for (const cert of certificates) {
            try {
                const result = await userWallet.relinquishCertificate({
                    type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
                    serialNumber: cert.serialNumber,
                    certifier: process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY,
                });
                results.push({ serialNumber: cert.serialNumber, result });
            } catch (error) {
                results.push({ serialNumber: cert.serialNumber, error: error.message });
            }
        }
        
        return NextResponse.json({ 
            message: 'Wallet clearing attempted',
            totalCertificates: certificatesResponse.totalCertificates || 0,
            certificatesFound: certificates.length,
            results 
        });
        
    } catch (error) {
        console.error('Error clearing wallet:', error);
        return NextResponse.json({ 
            message: 'Failed to clear wallet', 
            error: error.message 
        }, { status: 400 });
    }
}
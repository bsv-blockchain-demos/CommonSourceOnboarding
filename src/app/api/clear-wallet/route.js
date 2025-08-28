import { NextResponse } from "next/server";
import { Utils } from "@bsv/sdk";
import { walletService } from "../../../lib/WalletService";

export async function POST(req) {
    try {
        const userWallet = await walletService.getWallet();
        
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
                    certifier: process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4",
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
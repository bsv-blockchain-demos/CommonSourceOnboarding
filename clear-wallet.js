import { Utils } from '@bsv/sdk';
import { walletService } from './src/lib/WalletService.js';

async function clearWallet() {
    try {
        console.log('Connecting to wallet...');
        const userWallet = await walletService.getWallet();
        
        // List all certificates
        console.log('Listing all certificates...');
        const certificatesResponse = await userWallet.listCertificates({
            certifiers: [process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4"],
            types: [Utils.toBase64(Utils.toArray('Bvc', 'base64'))]
        });
        
        console.log('Found certificates response:', certificatesResponse);
        const certificates = certificatesResponse.certificates || [];
        
        if (certificates.length === 0) {
            console.log('No certificates found in wallet');
            return;
        }
        
        console.log(`Found ${certificates.length} certificate(s) to clear`);
        
        // Relinquish all certificates
        for (const cert of certificates) {
            try {
                console.log(`Relinquishing certificate: ${cert.serialNumber?.substring(0, 8)}...`);
                const result = await userWallet.relinquishCertificate({
                    type: cert.type,
                    serialNumber: cert.serialNumber,
                    certifier: process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4",
                });
                console.log('Certificate relinquished:', result);
            } catch (error) {
                console.error(`Failed to relinquish certificate ${cert.serialNumber}:`, error.message);
            }
        }
        
        console.log('Wallet clearing complete!');
        
    } catch (error) {
        console.error('Error clearing wallet:', error);
    }
}

// Run the script
clearWallet();
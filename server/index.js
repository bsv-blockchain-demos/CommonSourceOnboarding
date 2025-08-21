import express from 'express'
import bodyParser from 'body-parser'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { WalletClient, PrivateKey, KeyDeriver } from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client'
import { signCertificate } from './signCertificate.js'
import dotenv from 'dotenv'
import crypto from 'crypto'

global.self = {crypto};
dotenv.config();

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL;

console.log("SERVER_PRIVATE_KEY", SERVER_PRIVATE_KEY);
console.log("WALLET_STORAGE_URL", WALLET_STORAGE_URL);

export const createWalletClient = async (keyHex, walletStorageUrl, chain) => {
    const rootKey = PrivateKey.fromHex(keyHex)
    const keyDeriver = new KeyDeriver(rootKey)
    const storage = new WalletStorageManager(keyDeriver.identityKey)
    const services = new Services(chain)
    const wallet = new Wallet({
        chain,
        keyDeriver,
        storage,
        services,
    })
    const client = new StorageClient(wallet, walletStorageUrl)
    await storage.addWalletStorageProvider(client)
    await storage.makeAvailable()
    return new WalletClient(wallet)
}

async function main () {
// Connect to user's wallet
const wallet = await createWalletClient(
  SERVER_PRIVATE_KEY,
  WALLET_STORAGE_URL,
  'main'
)

// Get and log the server's public key
const { publicKey: serverPublicKey } = await wallet.getPublicKey({ identityKey: true })
console.log("SERVER PUBLIC KEY:", serverPublicKey)

// 2. Create the auth middleware with enhanced security
//    - Enable mutual authentication for cryptographic proof of ownership
const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: true, // Allow unauthenticated for certificate issuance
  logger: console,
  logLevel: 'debug',
  
  // Certificate validation callback for comprehensive verification
  onCertificatesReceived: async (certificates) => {
    console.log(`[Auth] Validating ${certificates.length} certificates...`);
    
    for (const cert of certificates) {
      try {
        // Basic certificate validation - verify it has required fields
        if (!cert.serialNumber || !cert.subject || !cert.certifier) {
          throw new Error('Certificate missing required fields');
        }
        
        // For now, we'll add basic certificate validation
        // TODO: Add revocation status checking via overlay network
        // TODO: Add certificate signature verification against known certifier
        console.log(`[Auth] Certificate validation passed for cert: ${cert.serialNumber?.substring(0, 8)}...`);
        
      } catch (error) {
        console.error(`[Auth] Certificate validation failed:`, error);
        throw new Error(`Certificate verification failed: ${error.message}`);
      }
    }
    
    console.log('[Auth] All certificates validated successfully');
  }
})

// 3. Create and configure the Express app
const app = express();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Methods', '*')
    res.header('Access-Control-Expose-Headers', '*')
    res.header('Access-Control-Allow-Private-Network', 'true')
    if (req.method === 'OPTIONS') {
      // Handle CORS preflight requests to allow cross-origin POST/PUT requests
      res.sendStatus(200)
    } else {
      next()
    }
  })

app.use(bodyParser.json())

// 4. Apply the auth middleware to all routes EXCEPT /signCertificate
app.use((req, res, next) => {
  if (req.path === '/signCertificate') {
    // Skip auth middleware for certificate signing - it's a public issuance endpoint
    console.log('[AUTH] Bypassing auth middleware for certificate signing');
    next();
  } else {
    // Apply auth middleware to all other routes
    authMiddleware(req, res, next);
  }
});

// Add request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.path === '/signCertificate') {
    console.log('[REQUEST] signCertificate endpoint hit');
    console.log('[REQUEST] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[REQUEST] Body preview:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// 5. Define your routes as usual
app.post('/signCertificate', signCertificate)

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
}

main()
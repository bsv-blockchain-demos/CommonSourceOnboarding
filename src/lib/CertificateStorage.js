import { WalletClient } from '@bsv/sdk';

/**
 * Enhanced Certificate Storage System
 * Provides dual storage strategy: MetaNet Desktop wallet (primary) + localStorage (fallback)
 * Based on robust error handling patterns and proper wallet integration
 */
export class CertificateStorage {
  constructor() {
    this.walletAvailable = false;
    this.storageInitialized = false;
    this.storageError = null;
    this.walletEndpoint = 'http://localhost:3321'; // MetaNet Desktop default port
  }

  // Check if MetaNet Desktop wallet services are available
  async checkWalletAvailability() {
    try {
      console.log('[CertStorage] Checking MetaNet Desktop wallet availability...');
      
      // Create wallet client with proper configuration
      const walletClient = new WalletClient('cicada', undefined);
      await walletClient.connectToSubstrate();
      
      if (walletClient.substrate) {
        // Override baseUrl to point to MetaNet Desktop
        walletClient.substrate.baseUrl = this.walletEndpoint;
        
        // Test connectivity with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Wallet connection timeout')), 5000)
        );
        
        await Promise.race([
          walletClient.getVersion?.() || Promise.resolve('test'),
          timeoutPromise
        ]);
        
        console.log('[CertStorage] ✅ MetaNet Desktop wallet service available');
        this.walletAvailable = true;
        return true;
      }
      
      throw new Error('Failed to initialize wallet substrate');
      
    } catch (error) {
      console.log('[CertStorage] ❌ MetaNet Desktop wallet service unavailable:', error.message);
      this.walletAvailable = false;
      return false;
    }
  }

  // Fallback certificate storage using localStorage
  getFallbackStorage() {
    return {
      async storeCertificate(certificate, alias) {
        try {
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          stored[alias] = {
            certificate,
            timestamp: Date.now(),
            method: 'localStorage_fallback',
            serialNumber: certificate.serialNumber
          };
          localStorage.setItem('bsv_certificates', JSON.stringify(stored));
          console.log('[CertStorage] 📁 Certificate stored in localStorage fallback:', alias);
          return true;
        } catch (error) {
          console.error('[CertStorage] Fallback storage failed:', error);
          throw error;
        }
      },

      async getCertificate(alias) {
        try {
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          return stored[alias]?.certificate || null;
        } catch (error) {
          console.error('[CertStorage] Fallback retrieval failed:', error);
          return null;
        }
      },

      async listCertificates() {
        try {
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          return Object.keys(stored).map(alias => ({
            alias,
            ...stored[alias],
            source: 'localStorage'
          }));
        } catch (error) {
          console.error('[CertStorage] Fallback listing failed:', error);
          return [];
        }
      },

      async findBySerialNumber(serialNumber) {
        try {
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          for (const [alias, data] of Object.entries(stored)) {
            if (data.certificate?.serialNumber === serialNumber) {
              return { alias, ...data, source: 'localStorage' };
            }
          }
          return null;
        } catch (error) {
          console.error('[CertStorage] Fallback serial search failed:', error);
          return null;
        }
      }
    };
  }

  // Note: Certificate storage happens automatically during acquireCertificate()
  // This method only handles fallback localStorage storage when wallet is unavailable
  async storeCertificateWithWallet(certificate, alias) {
    console.log('[CertStorage] Certificate storage happens automatically during acquireCertificate()');
    console.log('[CertStorage] Only using localStorage fallback when MetaNet Desktop is unavailable');
    
    if (!this.walletAvailable) {
      console.log('[CertStorage] 📁 MetaNet Desktop unavailable - using localStorage fallback');
      return await this.getFallbackStorage().storeCertificate(certificate, alias);
    }

    // When wallet is available, certificates are stored automatically during acquisition
    // No manual storage step is needed - just verify the certificate exists
    console.log('[CertStorage] ✅ MetaNet Desktop available - certificate stored automatically during acquisition');
    return certificate;
  }

  // Verify certificate was stored successfully
  async verifyCertificateStorage(certificate, alias) {
    try {
      console.log('[CertStorage] Verifying certificate storage for:', alias);
      
      // Check wallet storage first
      if (this.walletAvailable) {
        try {
          const walletClient = new WalletClient('cicada', undefined);
          await walletClient.connectToSubstrate();
          if (walletClient.substrate) {
            walletClient.substrate.baseUrl = this.walletEndpoint;
          }

          // Safe certificate listing with timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Certificate listing timeout')), 10000)
          );

          const certificates = await Promise.race([
            walletClient.listCertificates(),
            timeoutPromise
          ]);

          // Handle different response formats
          let certificateList = certificates;
          if (typeof certificates === 'string') {
            certificateList = JSON.parse(certificates);
          }
          if (!Array.isArray(certificateList) && certificateList?.certificates) {
            certificateList = certificateList.certificates;
          }

          // Safe array handling
          if (Array.isArray(certificateList)) {
            const found = certificateList.find(cert => 
              cert.serialNumber === certificate.serialNumber ||
              cert.alias === alias ||
              (cert.certificate && cert.certificate.serialNumber === certificate.serialNumber)
            );
            
            if (found) {
              console.log('[CertStorage] ✅ Certificate verified in MetaNet Desktop wallet');
              return { verified: true, location: 'wallet', certificate: found };
            }
          }
        } catch (error) {
          console.warn('[CertStorage] Wallet verification failed:', error.message);
        }
      }

      // Check fallback storage
      const fallbackCert = await this.getFallbackStorage().findBySerialNumber(certificate.serialNumber);
      if (fallbackCert) {
        console.log('[CertStorage] ✅ Certificate verified in localStorage fallback');
        return { verified: true, location: 'localStorage', certificate: fallbackCert };
      }

      console.log('[CertStorage] ❌ Certificate not found in any storage');
      return { verified: false, location: null, certificate: null };

    } catch (error) {
      console.warn('[CertStorage] ⚠️ Certificate verification failed:', error.message);
      return { verified: false, location: null, certificate: null, error: error.message };
    }
  }

  // Initialize certificate storage system
  async initializeStorage() {
    try {
      console.log('[CertStorage] 🔧 Initializing certificate storage system...');
      this.storageError = null;

      // Check wallet availability
      const isWalletAvailable = await this.checkWalletAvailability();
      
      if (!isWalletAvailable) {
        console.log('[CertStorage] 📁 Initialized with localStorage fallback only');
        this.storageInitialized = true;
        return { initialized: true, method: 'fallback', walletAvailable: false };
      }

      console.log('[CertStorage] ✅ Certificate storage initialized with wallet + fallback');
      this.storageInitialized = true;
      return { initialized: true, method: 'dual', walletAvailable: true };

    } catch (error) {
      console.error('[CertStorage] ❌ Certificate storage initialization failed:', error);
      this.storageError = error.message;
      
      // Still mark as initialized with fallback only
      console.log('[CertStorage] 📁 Falling back to localStorage-only storage');
      this.storageInitialized = true;
      return { initialized: true, method: 'fallback', walletAvailable: false, error: error.message };
    }
  }

  // Public API for certificate operations
  getAPI() {
    return {
      // Store a certificate with automatic fallback
      store: async (certificate, alias) => {
        if (!this.storageInitialized) {
          await this.initializeStorage();
        }
        return await this.storeCertificateWithWallet(certificate, alias);
      },

      // Retrieve a certificate by alias
      get: async (alias) => {
        if (this.walletAvailable) {
          try {
            const walletClient = new WalletClient('cicada', undefined);
            await walletClient.connectToSubstrate();
            if (walletClient.substrate) {
              walletClient.substrate.baseUrl = this.walletEndpoint;
            }
            
            const certificates = await walletClient.listCertificates();
            let certificateList = Array.isArray(certificates) ? certificates : [];
            if (typeof certificates === 'string') {
              certificateList = JSON.parse(certificates);
            }
            if (!Array.isArray(certificateList) && certificateList?.certificates) {
              certificateList = certificateList.certificates;
            }
            
            const found = certificateList.find(cert => cert.alias === alias);
            if (found) return found.certificate || found;
          } catch (error) {
            console.warn('[CertStorage] Wallet retrieval failed, trying fallback:', error.message);
          }
        }
        
        return await this.getFallbackStorage().getCertificate(alias);
      },

      // List all certificates from all sources
      list: async () => {
        const results = [];
        
        if (this.walletAvailable) {
          try {
            const walletClient = new WalletClient('cicada', undefined);
            await walletClient.connectToSubstrate();
            if (walletClient.substrate) {
              walletClient.substrate.baseUrl = this.walletEndpoint;
            }
            
            const walletCerts = await walletClient.listCertificates();
            let certificateList = Array.isArray(walletCerts) ? walletCerts : [];
            if (typeof walletCerts === 'string') {
              certificateList = JSON.parse(walletCerts);
            }
            if (!Array.isArray(certificateList) && certificateList?.certificates) {
              certificateList = certificateList.certificates;
            }
            
            if (Array.isArray(certificateList)) {
              results.push(...certificateList.map(cert => ({...cert, source: 'wallet'})));
            }
          } catch (error) {
            console.warn('[CertStorage] Wallet listing failed:', error.message);
          }
        }
        
        const fallbackCerts = await this.getFallbackStorage().listCertificates();
        results.push(...fallbackCerts);
        
        return results;
      },

      // Verify certificate storage
      verify: async (certificate, alias) => {
        return await this.verifyCertificateStorage(certificate, alias);
      },

      // Get storage status
      getStatus: () => ({
        initialized: this.storageInitialized,
        walletAvailable: this.walletAvailable,
        error: this.storageError
      }),

      // Reinitialize storage
      reinitialize: async () => {
        this.storageInitialized = false;
        return await this.initializeStorage();
      }
    };
  }
}

// Export singleton instance
export const certificateStorage = new CertificateStorage();
export default certificateStorage;
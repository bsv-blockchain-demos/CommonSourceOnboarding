"use client"

import { WalletClient } from '@bsv/sdk';

/**
 * Singleton WalletService that manages a single WalletClient instance
 * across the entire application to prevent connection conflicts
 */
class WalletService {
  constructor() {
    this.walletInstance = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.publicKey = null;
    this.isAuthenticated = false;
  }

  /**
   * Get the singleton wallet instance, creating it if necessary
   */
  async getWallet() {
    // If we already have a connected wallet, return it
    if (this.walletInstance && this.isAuthenticated) {
      console.log('[WalletService] Returning existing wallet instance');
      return this.walletInstance;
    }

    // If we're already in the process of connecting, wait for it
    if (this.isConnecting && this.connectionPromise) {
      console.log('[WalletService] Already connecting, waiting for existing promise');
      return this.connectionPromise;
    }

    // Start new connection
    this.isConnecting = true;
    this.connectionPromise = this._initializeWallet();
    
    try {
      const wallet = await this.connectionPromise;
      this.isConnecting = false;
      return wallet;
    } catch (error) {
      this.isConnecting = false;
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Internal method to initialize the wallet
   */
  async _initializeWallet() {
    try {
      console.log('[WalletService] Initializing singleton wallet...');
      
      // Try different substrates in order of preference
      const substrates = [
        //{ name: 'auto', config: 'auto' },
        //{ name: 'window.CWI', config: 'window.CWI' },
        //{ name: 'cicada', config: 'cicada' },
        { name: 'json-api', config: 'json-api' }
      ];
      let wallet = null;
      let lastError = null;
      const errors = [];

      for (const substrate of substrates) {
        try {
          console.log(`[WalletService] 🔄 Trying substrate: ${substrate.name}`);
          // Use the certificate server URL for HTTP substrates
          wallet = new WalletClient(substrate.config, 'localhost');
          
          // Force connection to substrate
          console.log(`[WalletService] Connecting to substrate...`);
          await wallet.connectToSubstrate();
          console.log(`[WalletService] ✅ Connected to substrate: ${substrate.name}`);
          
          // Test authentication
          console.log(`[WalletService] Checking authentication...`);
          const isAuthenticated = await wallet.isAuthenticated();
          console.log(`[WalletService] Authentication result: ${isAuthenticated}`);
          
          if (isAuthenticated) {
            // Get public key to verify full functionality
            console.log(`[WalletService] Getting public key...`);
            const { publicKey } = await wallet.getPublicKey({ identityKey: true });
            console.log(`[WalletService] Got public key: ${publicKey?.substring(0, 16)}...`);

            
            // Success! Store the working configuration
            this.walletInstance = wallet;
            this.publicKey = publicKey;
            this.isAuthenticated = true;
            
            console.log(`[WalletService] 🎉 Wallet successfully initialized with substrate: ${substrate.name}`);
            return wallet;
          } else {
            console.warn(`[WalletService] ❌ Substrate ${substrate.name} connected but not authenticated`);
            errors.push(`${substrate.name}: Connected but not authenticated`);
          }
        } catch (error) {
          console.error(`[WalletService] ❌ Substrate ${substrate.name} failed:`, error.message);
          errors.push(`${substrate.name}: ${error.message}`);
          lastError = error;
          continue;
        }
      }

      // Log all errors for debugging
      console.error('[WalletService] All substrate attempts failed:');
      errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });

      // If we get here, all substrates failed
      throw new Error(`Failed to initialize wallet with any substrate. Last error: ${lastError?.message}`);

    } catch (error) {
      console.error('[WalletService] Failed to initialize wallet:', error);
      this.walletInstance = null;
      this.isAuthenticated = false;
      this.publicKey = null;
      throw error;
    }
  }

  /**
   * Get the user's public key (cached)
   */
  getPublicKey() {
    return this.publicKey;
  }

  /**
   * Check if wallet is authenticated (cached)
   */
  isWalletAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * Reset the wallet connection (for troubleshooting)
   */
  reset() {
    console.log('[WalletService] Resetting wallet connection...');
    this.walletInstance = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.publicKey = null;
    this.isAuthenticated = false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      hasWallet: !!this.walletInstance,
      isAuthenticated: this.isAuthenticated,
      isConnecting: this.isConnecting,
      publicKey: this.publicKey
    };
  }
}

// Export singleton instance
export const walletService = new WalletService();

// Export the class for testing if needed
export { WalletService };
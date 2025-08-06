import { WalletClient, Utils, Hash, PushDrop } from '@bsv/sdk';

/**
 * BSV DID Service for CommonSource
 * 
 * This service handles DID creation and resolution using BSV blockchain
 * while maintaining compatibility with the existing certificate system.
 */
export class BsvDidService {
  constructor(walletClient, overlayServiceUrl = null) {
    this.walletClient = walletClient;
    this.overlayServiceUrl = overlayServiceUrl;
    this.topic = 'bsv_did';
    this.protocolId = 'CMSRC';
  }

  /**
   * Create a new DID for a user
   * This integrates with the existing wallet system
   */
  async createUserDid(publicKey = null) {
    try {
      console.log('[BsvDidService] Creating user DID...');
      
      if (!this.walletClient) {
        throw new Error('WalletClient not initialized');
      }

      // Get user's identity key if not provided
      let userPublicKey = publicKey;
      if (!userPublicKey) {
        const keyResult = await this.walletClient.getPublicKey({ identityKey: true });
        userPublicKey = keyResult.publicKey;
      }

      // Create unique serial number for DID
      const uniqueData = {
        publicKey: userPublicKey,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };
      const serialNumberBytes = Hash.sha256(JSON.stringify(uniqueData));
      const serialNumber = Utils.toHex(serialNumberBytes);

      // Create DID identifier
      const did = `did:bsv:${this.topic}:${serialNumber}`;

      // Create DID document
      const didDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [{
          id: `${did}#key-1`,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: this.publicKeyToJwk(userPublicKey)
        }],
        authentication: [`${did}#key-1`],
        assertionMethod: [`${did}#key-1`],
        keyAgreement: [],
        capabilityDelegation: [],
        capabilityInvocation: []
      };

      // Store DID document on BSV blockchain
      const txResult = await this.storeDIDDocument(didDocument, serialNumber);

      console.log(`[BsvDidService] Created DID: ${did}`);
      return {
        did,
        didDocument,
        txid: txResult.txid,
        serialNumber
      };

    } catch (error) {
      console.error('[BsvDidService] Error creating DID:', error);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }

  /**
   * Store DID document on BSV blockchain using PushDrop
   */
  async storeDIDDocument(didDocument, serialNumber) {
    try {
      // Create PushDrop fields for BSV transaction
      const fields = [
        Utils.toArray(this.protocolId, 'utf8'),        // CMSRC protocol
        Utils.toArray(this.topic, 'utf8'),             // bsv_did topic
        Utils.toArray(JSON.stringify(didDocument), 'utf8') // DID document
      ];

      // Create PushDrop instance
      const pushDrop = new PushDrop(this.walletClient);
      
      // Create locking script
      const lockingScript = await pushDrop.lock(
        fields,
        [0, 'bsv-did'],  // Protocol ID for wallet
        didDocument.id,  // Key ID
        'self',          // Counterparty
        true,            // For self
        true,            // Include signature
        'before'         // Lock position
      );

      // Create transaction
      const createActionResult = await this.walletClient.createAction({
        description: 'Create DID document on BSV',
        outputs: [{
          satoshis: 1,
          lockingScript: lockingScript.toHex(),
          outputDescription: 'DID Document',
          basket: 'bsv-did',
          customInstructions: JSON.stringify({
            protocolId: this.protocolId,
            topic: this.topic,
            didId: didDocument.id,
            type: 'DID_DOCUMENT'
          })
        }],
        options: {
          randomizeOutputs: false,
          noSend: false // Send to blockchain
        },
        labels: ['bsv-did', 'create']
      });

      return {
        txid: createActionResult.txid,
        vout: 0
      };

    } catch (error) {
      console.error('[BsvDidService] Error storing DID document:', error);
      throw error;
    }
  }

  /**
   * Resolve a DID to its DID document
   * This will be enhanced later with overlay service integration
   */
  async resolveDID(did) {
    try {
      console.log(`[BsvDidService] Resolving DID: ${did}`);
      
      // Parse DID to extract components
      const didParts = did.split(':');
      if (didParts.length !== 4 || didParts[0] !== 'did' || didParts[1] !== 'bsv') {
        throw new Error('Invalid DID format');
      }

      const topic = didParts[2];
      const serialNumber = didParts[3];

      // For now, return a placeholder - this will be enhanced with database lookup
      // and overlay service integration in later phases
      console.log(`[BsvDidService] DID resolution not yet fully implemented for: ${did}`);
      return null;

    } catch (error) {
      console.error('[BsvDidService] Error resolving DID:', error);
      throw error;
    }
  }

  /**
   * Convert BSV public key to JWK format
   */
  publicKeyToJwk(publicKeyHex) {
    try {
      // Basic JWK structure for secp256k1 key
      // This is a simplified implementation - in production you'd want more robust key handling
      return {
        kty: 'EC',
        crv: 'secp256k1',
        x: publicKeyHex.substring(2, 66), // X coordinate
        y: publicKeyHex.substring(66),    // Y coordinate (if uncompressed)
        use: 'sig'
      };
    } catch (error) {
      console.error('[BsvDidService] Error converting public key to JWK:', error);
      throw error;
    }
  }

  /**
   * Generate a simple UUID for VC IDs
   * This replaces the need for the uuid package dependency
   */
  generateId() {
    return 'urn:uuid:' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
"use client";

import { useContext, createContext, useState, useCallback, useEffect, useRef } from "react";
import { Utils } from "@bsv/sdk";
import { BsvDidService } from "../lib/bsv/BsvDidService";
import { BsvVcService } from "../lib/bsv/BsvVcService";

const DidContext = createContext();

export const DidContextProvider = ({ children, userWallet, userPubKey }) => {
  const [userDid, setUserDid] = useState(null);
  const [didDocument, setDidDocument] = useState(null);
  const [bsvDidService, setBsvDidService] = useState(null);
  const [bsvVcService, setBsvVcService] = useState(null);
  
  // Initialization tracking to prevent infinite loops
  const hasInitialized = useRef(false);
  const migrationAttempts = useRef(new Map()); // Track attempts by pubkey
  const walletErrorCount = useRef(0);
  const maxWalletErrors = 5; // Increased from 3 to 5 for legitimate operations

  // Check wallet for existing DID certificates with circuit breaker
  const checkWalletForDIDCertificates = useCallback(async () => {
    if (!userWallet) {
      console.log('[DidContext] No wallet available for DID certificate check');
      return null;
    }
    
    // Circuit breaker: if we've had too many wallet errors, skip wallet operations
    if (walletErrorCount.current >= maxWalletErrors) {
      console.log('[DidContext] ⚠️ Skipping wallet check - too many previous errors');
      return null;
    }
    
    try {
      console.log('[DidContext] Checking wallet for existing DID certificates...');
      
      let certificates;
      try {
        console.log('[DidContext] Using BSV SDK wallet for certificate listing');
        certificates = await userWallet.listCertificates();
      } catch (listError) {
        console.warn(`[DidContext] Failed to list certificates:`, listError);
        
        // Check for common certificate listing errors that should be ignored
        if (listError.message && (
          listError.message.includes('JSON Parse error') ||
          listError.message.includes('Unexpected EOF') ||
          listError.message.includes('400 (Bad Request)') ||
          listError.message.includes('connection refused') ||
          listError.message.includes('ECONNREFUSED')
        )) {
          console.log('[DidContext] Certificate storage service unavailable or empty - treating as no certificates');
          return null;
        }
        
        // Only count real network/server errors
        walletErrorCount.current++;
        console.warn(`[DidContext] Network/server error count: ${walletErrorCount.current}/${maxWalletErrors}`);
        
        // Re-throw other errors if we haven't exceeded limit
        if (walletErrorCount.current < maxWalletErrors) {
          throw listError;
        } else {
          console.error('[DidContext] ⚠️ Maximum network errors reached, disabling wallet operations');
          return null;
        }
      }
      
      // Handle different response formats
      let certificateList = certificates;
      if (typeof certificates === 'string') {
        try {
          certificateList = JSON.parse(certificates);
        } catch (parseError) {
          console.warn('[DidContext] Failed to parse certificate response:', parseError);
          return null;
        }
      }
      
      // Ensure we have an array
      if (!Array.isArray(certificateList)) {
        if (certificateList && certificateList.certificates && Array.isArray(certificateList.certificates)) {
          certificateList = certificateList.certificates;
        } else {
          console.log('[DidContext] Certificate response is not an array:', typeof certificateList);
          return null;
        }
      }
      
      console.log('[DidContext] Found', certificateList.length, 'total certificates');
      
      // Filter for CommonSource identity certificates that contain DID data (isDID field)
      const commonSourceType = Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8'));
      const didCerts = certificateList.filter(cert => 
        cert.type === commonSourceType && 
        cert.fields && 
        cert.fields.isDID === 'true'
      );
      console.log('[DidContext] Found', didCerts.length, 'DID certificates (CommonSource identity type with isDID=true)');
      
      if (didCerts.length > 0) {
        const firstDIDCert = didCerts[0];
        
        console.log('[DidContext] ✅ Found existing DID certificate:', firstDIDCert.fields.didId);
        // Reset error count on successful operation
        walletErrorCount.current = 0;
        
        return {
          did: firstDIDCert.fields.didId,
          didDocument: null, // DID document not stored in certificate anymore
          certificate: firstDIDCert,
          serialNumber: firstDIDCert.serialNumber
        };
      }
      
      console.log('[DidContext] No DID certificates found in wallet');
      // Reset error count on successful operation
      walletErrorCount.current = 0;
      return null;
      
    } catch (error) {
      console.error('[DidContext] Error checking wallet for DID certificates:', error);
      return null;
    }
  }, [userWallet]);

  // Check localStorage for existing DID (legacy storage)
  const checkLocalStorageDID = useCallback(() => {
    if (!userPubKey) return null;
    
    try {
      const storedDidKey = `user_did_${userPubKey}`;
      const storedDid = localStorage.getItem(storedDidKey);
      
      if (storedDid) {
        const didData = JSON.parse(storedDid);
        console.log('[DidContext] Found existing DID in localStorage:', didData.did);
        return didData;
      }
      
      return null;
    } catch (error) {
      console.error('[DidContext] Error checking localStorage for DID:', error);
      return null;
    }
  }, [userPubKey]);

  // Store DID as certificate (switched back to official BSV SDK acquireCertificate)
  const storeDIDCertificate = useCallback(async (didData) => {
    try {
      console.log('[DidContext] Storing DID as certificate...');
      
      if (!userWallet) {
        throw new Error('Wallet not available for certificate storage');
      }

      // Create certificate fields for the DID (simplified to avoid P2P serialization issues)
      const certificateFields = {
        didId: didData.did,
        didType: "BSV DID",
        version: "1.0",
        created: didData.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        isDID: "true"  // DID certificate identifier (similar to isVC for VC certificates)
      };

      console.log('[DidContext] Preparing DID certificate with fields:', {
        didId: certificateFields.didId,
        didType: certificateFields.didType,
        version: certificateFields.version
      });

      // Get subject public key from wallet
      let subject;
      try {
        console.log('[DidContext] Getting public key from wallet');
        const { publicKey } = await userWallet.getPublicKey({ identityKey: true });
        subject = publicKey;
      } catch (error) {
        console.warn('[DidContext] Failed to get public key from wallet, using userPubKey from context:', error);
        subject = userPubKey;
      }
      
      if (!subject) {
        throw new Error('Could not determine subject public key for certificate');
      }
      
      console.log('[DidContext] Using subject public key:', subject);

      // Use official BSV SDK acquireCertificate method now that user has modified SDK
      console.log('[DidContext] Using official BSV SDK acquireCertificate for DID certificates...');
      
      const serverPublicKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4";
      const certifierUrl = process.env.NEXT_PUBLIC_CERTIFIER_URL || "http://localhost:8080";
      
      const certificateResult = await userWallet.acquireCertificate({
        type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
        fields: certificateFields,
        certifier: serverPublicKey,
        acquisitionProtocol: "direct",
        keyringRevealer: certifierUrl,
        serialNumber: Utils.toBase64(Utils.toArray(Date.now().toString(), 'utf8'))
      });
      
      console.log('[DidContext] ✅ DID certificate acquired via BSV SDK:', {
        type: certificateResult.type,
        serialNumber: certificateResult.serialNumber?.substring(0, 16) + '...',
        subject: certificateResult.subject?.substring(0, 16) + '...',
        certifier: certificateResult.certifier?.substring(0, 16) + '...'
      });
      
      return {
        ...didData,
        certificate: certificateResult,
        serialNumber: certificateResult.serialNumber
      };

      /* COMMENTED OUT: Previous working HTTP-based certificate acquisition (from commit 6ec9264)
      // This bypassed the BSV SDK P2P issues that were causing "Array.from" errors
      console.log('[DidContext] Using working custom HTTP certificate acquisition for DID documents...');
      
      // Generate client nonce for replay protection
      const serverPublicKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4";
      console.log('[DID Cert] Generating client nonce...');
      const clientNonce = await createNonce(userWallet, serverPublicKey);
      console.log('[DID Cert] Client nonce generated:', clientNonce?.substring(0, 16) + '...');
      
      // Make direct HTTP request to certificate server (working pattern)
      const certifierUrl = process.env.NEXT_PUBLIC_CERTIFIER_URL || "http://localhost:8080";
      console.log('[DID Cert] Making request to:', certifierUrl + '/signCertificate');
      
      const response = await fetch(certifierUrl + '/signCertificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bsv-auth-identity-key': subject  // BSV auth header
        },
        body: JSON.stringify({
          clientNonce: clientNonce,  // Required for replay protection
          type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
          fields: certificateFields,
          acquisitionProtocol: "issuance",  // Required by server
          certifier: serverPublicKey,
          certifierUrl: process.env.NEXT_PUBLIC_CERTIFIER_URL || "http://localhost:8080"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Certificate server responded with ${response.status}: ${response.statusText}`);
      }
      
      // Server returns binary certificate data in BSV SDK format (success byte + certificate binary)
      const responseBuffer = await response.arrayBuffer();
      console.log('[DID Cert] Received response buffer, length:', responseBuffer.byteLength);
      
      // Parse BSV SDK response format: success_byte + certificate_binary
      const responseArray = new Uint8Array(responseBuffer);
      const successByte = responseArray[0];
      
      if (successByte !== 0) {
        throw new Error(`Certificate issuance failed with status code: ${successByte}`);
      }
      
      // Extract the certificate binary data (everything after the success byte)
      const certificateData = responseArray.slice(1);
      console.log('[DID Cert] Extracted certificate binary, length:', certificateData.length);
      
      // Deserialize the certificate using BSV SDK
      const certificate = Certificate.fromBinary(certificateData);
      console.log('[DID Cert] Certificate deserialized successfully:', {
        type: certificate.type,
        serialNumber: certificate.serialNumber?.substring(0, 16) + '...',
        subject: certificate.subject?.substring(0, 16) + '...',
        certifier: certificate.certifier?.substring(0, 16) + '...'
      });
      
      // Store the certificate in the wallet (this was the missing piece!)
      await userWallet.storeCertificate(certificate);
      console.log('[DidContext] ✅ DID certificate stored in MetaNet Desktop wallet');
      
      return {
        ...didData,
        certificate: certificate,
        serialNumber: certificate.serialNumber
      };
      */

    } catch (error) {
      console.error('[DidContext] Error storing DID as certificate, falling back to localStorage:', error);
      
      // Check for specific certificate acquisition errors
      let errorType = 'unknown';
      if (error.message && (
        error.message.includes('Failed to send message to peer') ||
        error.message.includes('connection refused') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Network error') ||
        error.message.includes('400 (Bad Request)') ||
        error.message.includes('acquireCertificate')
      )) {
        // Check if this is a wallet storage issue (certificate was signed but storage failed)
        if (error.message.includes('3321') || error.message.includes('Bad Request')) {
          errorType = 'wallet_storage_failed';
          console.log('[DidContext] ℹ️  Certificate was signed successfully but wallet storage failed - this is normal when MetaNet Desktop is not running');
        } else {
          errorType = 'certificate_server_unavailable';
          console.log('[DidContext] Certificate signing server unavailable');
        }
      }
      
      // Re-throw with more context for the fallback handlers
      const enhancedError = new Error(`Certificate storage failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.errorType = errorType;
      throw enhancedError;
    }
  }, [userWallet, userPubKey]);

  // Migrate localStorage DID to certificate storage with attempt tracking
  const migrateDIDToCertificate = useCallback(async (didData) => {
    if (!userPubKey) {
      console.log('[DidContext] No userPubKey available for migration');
      return didData;
    }

    // Check if we've already attempted migration for this pubkey
    const attemptKey = `${userPubKey}_${didData.did}`;
    const previousAttempts = migrationAttempts.current.get(attemptKey) || 0;
    const maxAttempts = 3; // Increased from 2 to 3 attempts
    
    if (previousAttempts >= maxAttempts) {
      console.log(`[DidContext] ⚠️ Skipping migration - already attempted ${previousAttempts} times for ${attemptKey}`);
      return didData;
    }

    // Skip migration if wallet errors are too high
    if (walletErrorCount.current >= maxWalletErrors) {
      console.log('[DidContext] ⚠️ Skipping migration - wallet errors too high');
      return didData;
    }

    try {
      console.log(`[DidContext] Migrating DID from localStorage to certificate (attempt ${previousAttempts + 1}/${maxAttempts})...`);
      
      // Record attempt
      migrationAttempts.current.set(attemptKey, previousAttempts + 1);
      
      // First try to store as certificate
      const result = await storeDIDCertificate(didData);
      
      // If successful, clean up localStorage
      const storedDidKey = `user_did_${userPubKey}`;
      localStorage.removeItem(storedDidKey);
      console.log('[DidContext] ✅ DID migrated to certificate and localStorage cleaned up');
      
      // Clear attempt tracking on success
      migrationAttempts.current.delete(attemptKey);
      
      return result;

    } catch (error) {
      console.error('[DidContext] Error migrating DID to certificate, keeping localStorage:', error);
      // Return original data on migration failure
      return didData;
    }
  }, [userPubKey, storeDIDCertificate]);

  // Initialize BSV services when wallet is available
  const initializeBsvServices = useCallback(() => {
    if (userWallet && !bsvDidService) {
      console.log('[DidContext] Initializing BSV DID services...');
      const didService = new BsvDidService(userWallet);
      const vcService = new BsvVcService(didService);
      setBsvDidService(didService);
      setBsvVcService(vcService);
      return { didService, vcService };
    }
    return { didService: bsvDidService, vcService: bsvVcService };
  }, [userWallet, bsvDidService, bsvVcService]);

  // Unified DID loading - checks certificates first, then localStorage
  const loadExistingDID = useCallback(async () => {
    try {
      console.log('[DidContext] Loading existing DID with unified approach...');
      
      // 1. Check wallet certificates first (primary storage)
      const walletDID = await checkWalletForDIDCertificates();
      if (walletDID) {
        console.log('[DidContext] ✅ Loaded DID from wallet certificate:', walletDID.did);
        setUserDid(walletDID.did);
        setDidDocument(walletDID.didDocument);
        return walletDID;
      }
      
      // 2. Check localStorage (secondary/legacy storage)
      const localStorageDID = checkLocalStorageDID();
      if (localStorageDID) {
        console.log('[DidContext] Found DID in localStorage, attempting migration...');
        const migratedDID = await migrateDIDToCertificate(localStorageDID);
        setUserDid(migratedDID.did);
        setDidDocument(migratedDID.didDocument);
        return migratedDID;
      }
      
      console.log('[DidContext] No existing DID found in wallet certificates or localStorage');
      return null;
      
    } catch (error) {
      console.error('[DidContext] Error loading existing DID:', error);
      return null;
    }
  }, [checkWalletForDIDCertificates, checkLocalStorageDID, migrateDIDToCertificate]);

  // Create a DID for the user (unified approach)
  const createUserDid = useCallback(async () => {
    try {
      console.log('[DidContext] Creating user DID with unified approach...');
      
      // First try to load existing DID from certificates or localStorage
      const existingDID = await loadExistingDID();
      if (existingDID) {
        console.log('[DidContext] Using existing DID:', existingDID.did);
        return existingDID;
      }
      
      // No existing DID found, create new one
      console.log('[DidContext] Creating new DID using BSV SDK...');
      const { didService } = initializeBsvServices();
      if (!didService) {
        throw new Error('BSV DID service not initialized');
      }

      const result = await didService.createUserDid(userPubKey);
      
      setUserDid(result.did);
      setDidDocument(result.didDocument);
      
      // Try to store as certificate first (preferred method)
      try {
        console.log('[DidContext] Attempting to store new DID as certificate...');
        const certificateResult = await storeDIDCertificate(result);
        console.log('[DidContext] ✅ New DID stored as certificate:', certificateResult.did);
        return certificateResult;
      } catch (certError) {
        console.log('[DidContext] Failed to store DID as certificate, falling back to localStorage');
        
        // Provide specific feedback based on error type
        if (certError.errorType === 'wallet_storage_failed') {
          console.log('[DidContext] ℹ️  Certificate was signed successfully but wallet storage failed - using localStorage (this is normal when MetaNet Desktop is not fully running)');
        } else if (certError.errorType === 'certificate_server_unavailable') {
          console.log('[DidContext] ℹ️  Certificate signing server is not running - using localStorage storage (this is normal)');
        } else if (certError.message.includes('Network error')) {
          console.log('[DidContext] Network error - using localStorage storage');
        } else {
          console.warn('[DidContext] Unexpected certificate storage error:', certError.message);
        }
        
        // Fallback to localStorage if certificate storage fails
        const storedDidKey = `user_did_${userPubKey}`;
        localStorage.setItem(storedDidKey, JSON.stringify(result));
        console.log('[DidContext] ⚠️  New DID stored in localStorage as fallback');
        return result;
      }

    } catch (error) {
      console.error('[DidContext] Error creating user DID:', error);
      throw error;
    }
  }, [userPubKey, loadExistingDID, initializeBsvServices, storeDIDCertificate]);

  // Create VC data structure for use in certificates
  const createIdentityVCData = useCallback((identityFields) => {
    try {
      console.log('[DidContext] Creating identity VC data...');
      
      const { vcService } = initializeBsvServices();
      if (!vcService) {
        throw new Error('BSV VC service not initialized');
      }

      if (!userDid) {
        throw new Error('User DID not available - create DID first');
      }

      // Server DID - this should come from environment config
      const serverDid = process.env.NEXT_PUBLIC_SERVER_DID || `did:bsv:${process.env.NEXT_PUBLIC_DID_TOPIC || 'tm_did'}:server`;

      const vcData = vcService.createIdentityCredentialData({
        issuerDid: serverDid,
        subjectDid: userDid,
        ...identityFields
      });

      console.log('[DidContext] Identity VC data created');
      return vcData;

    } catch (error) {
      console.error('[DidContext] Error creating identity VC data:', error);
      throw error;
    }
  }, [userDid, initializeBsvServices]);

  // Verify a certificate containing VC data
  const verifyCertificateVC = useCallback((certificate) => {
    try {
      const { vcService } = initializeBsvServices();
      if (!vcService) {
        throw new Error('BSV VC service not initialized');
      }

      return vcService.verifyCertificateVC(certificate);

    } catch (error) {
      console.error('[DidContext] Error verifying certificate VC:', error);
      return { valid: false, error: error.message };
    }
  }, [initializeBsvServices]);

  // Check if a certificate is in VC format
  const isVCCertificate = useCallback((certificate) => {
    try {
      const { vcService } = initializeBsvServices();
      if (!vcService) {
        return false;
      }

      return vcService.isVCCertificate(certificate);

    } catch (error) {
      console.error('[DidContext] Error checking VC certificate:', error);
      return false;
    }
  }, [initializeBsvServices]);

  // Auto-load existing DID when wallet connects (unified approach with loop prevention)
  // This useEffect must be defined AFTER all the useCallbacks it depends on
  useEffect(() => {
    // Only initialize if we have wallet + pubkey and haven't already initialized for this combination
    if (userWallet && userPubKey && !hasInitialized.current) {
      console.log('[DidContext] Wallet connected, initializing DID system...');
      hasInitialized.current = true;
      
      // Reset error counters for new initialization
      walletErrorCount.current = 0;
      migrationAttempts.current.clear();
      
      loadExistingDID()
        .then((result) => {
          if (result) {
            console.log(`[DidContext] ✅ Initialization complete - DID loaded: ${result.did}`);
          } else {
            console.log('[DidContext] ✅ Initialization complete - no existing DID found');
          }
        })
        .catch(error => {
          console.error('[DidContext] ❌ Error during initialization:', error);
          // Don't reset hasInitialized on error - prevent retry loops
        });
    }
  }, [userWallet, userPubKey, loadExistingDID]);
  
  // Reset initialization flag when wallet/pubkey changes (new user/wallet connection)
  useEffect(() => {
    // If wallet or pubkey changed, reset initialization
    if (!userWallet || !userPubKey) {
      hasInitialized.current = false;
      setUserDid(null);
      setDidDocument(null);
    }
  }, [userWallet, userPubKey]);
  
  // Reset initialization when DID is manually created to allow re-discovery
  const resetInitializationFlag = useCallback(() => {
    console.log('[DidContext] Resetting initialization flag to allow re-discovery');
    hasInitialized.current = false;
    walletErrorCount.current = 0;
    migrationAttempts.current.clear();
  }, []);

  // Debug helper to check storage state
  const debugStorageState = useCallback(async () => {
    console.log('[DidContext] === STORAGE DEBUG ===');
    
    // Check localStorage
    if (userPubKey) {
      const storedDidKey = `user_did_${userPubKey}`;
      const localDID = localStorage.getItem(storedDidKey);
      console.log('[DidContext] localStorage DID:', localDID ? JSON.parse(localDID).did : 'None');
    }
    
    // Check wallet certificates
    if (userWallet) {
      try {
        const allCerts = await userWallet.listCertificates();
        console.log('[DidContext] Total wallet certificates:', Array.isArray(allCerts) ? allCerts.length : 'Response not array');
        
        const didDocumentType = Utils.toBase64(Utils.toArray('DID Document', 'utf8'));
        const didCerts = Array.isArray(allCerts) ? allCerts.filter(cert => cert.type === didDocumentType) : [];
        console.log('[DidContext] DID Document certificates:', didCerts.length);
        
        didCerts.forEach((cert, i) => {
          if (cert.fields && cert.fields.didDocument) {
            const doc = JSON.parse(cert.fields.didDocument);
            console.log(`[DidContext] Certificate ${i + 1} DID:`, doc.id);
          }
        });
      } catch (error) {
        console.log('[DidContext] Error checking certificates:', error.message);
      }
    }
    
    console.log('[DidContext] Current userDid state:', userDid);
    console.log('[DidContext] === END DEBUG ===');
  }, [userPubKey, userWallet, userDid]);

  return (
    <DidContext.Provider value={{
      userDid,
      didDocument,
      createUserDid,
      loadExistingDID,
      checkWalletForDIDCertificates,
      storeDIDCertificate,
      createIdentityVCData,
      verifyCertificateVC,
      isVCCertificate,
      resetInitializationFlag,
      debugStorageState,
      didService: bsvDidService,
      vcService: bsvVcService,
      bsvDidService,
      bsvVcService
    }}>
      {children}
    </DidContext.Provider>
  );
};

export const useDidContext = () => useContext(DidContext);
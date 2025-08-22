"use client";

import { useContext, createContext, useState, useCallback, useEffect } from "react";
import { useWalletContext } from "./walletContext";
import { BsvDidService } from "../lib/bsv/BsvDidService";
import { BsvVcService } from "../lib/bsv/BsvVcService";

const DidContext = createContext();

export const DidContextProvider = ({ children }) => {
  const { userWallet, userPubKey } = useWalletContext();
  const [userDid, setUserDid] = useState(null);
  const [didDocument, setDidDocument] = useState(null);
  const [bsvDidService, setBsvDidService] = useState(null);
  const [bsvVcService, setBsvVcService] = useState(null);
  
  // Auto-load existing DID when wallet connects (unified approach)
  useEffect(() => {
    if (userWallet && userPubKey && !userDid) {
      console.log('[DidContext] Wallet connected, auto-loading existing DID...');
      loadExistingDID().catch(error => {
        console.error('[DidContext] Error auto-loading existing DID:', error);
      });
    }
  }, [userWallet, userPubKey, userDid, loadExistingDID]);

  // Check wallet for existing DID certificates
  const checkWalletForDIDCertificates = useCallback(async () => {
    if (!userWallet) {
      console.log('[DidContext] No wallet available for DID certificate check');
      return null;
    }
    
    try {
      console.log('[DidContext] Checking wallet for existing DID certificates...');
      const certificates = await userWallet.listCertificates();
      console.log('[DidContext] Found', certificates.length, 'total certificates');
      
      const didDocumentType = btoa("DID Document");
      const didCerts = certificates.filter(cert => cert.type === didDocumentType);
      console.log('[DidContext] Found', didCerts.length, 'DID document certificates');
      
      if (didCerts.length > 0) {
        const firstDIDCert = didCerts[0];
        const didDocument = JSON.parse(firstDIDCert.fields.didDocument);
        
        console.log('[DidContext] ✅ Found existing DID certificate:', didDocument.id);
        return {
          did: didDocument.id,
          didDocument: didDocument,
          certificate: firstDIDCert,
          serialNumber: firstDIDCert.serialNumber
        };
      }
      
      console.log('[DidContext] No DID certificates found in wallet');
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

  // Store DID as certificate (similar to testDidDocumentCertificate but for production use)
  const storeDIDCertificate = useCallback(async (didData) => {
    try {
      console.log('[DidContext] Storing DID as certificate...');
      
      if (!userWallet) {
        throw new Error('Wallet not available for certificate storage');
      }

      // Create certificate fields for the DID
      const certificateFields = {
        didId: didData.did,
        didDocument: JSON.stringify(didData.didDocument),
        version: "1.0",
        created: didData.created || new Date().toISOString(),
        updated: new Date().toISOString()
      };

      console.log('[DidContext] Preparing DID certificate with fields:', {
        didId: certificateFields.didId,
        documentSize: certificateFields.didDocument.length,
        version: certificateFields.version
      });

      // Get server public key from environment
      const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;
      if (!serverPubKey) {
        throw new Error('Server public key not configured');
      }

      // Use custom certificate acquisition (same logic as testDidDocumentCertificate)
      const { publicKey: subject } = await userWallet.getPublicKey({ identityKey: true });
      
      // Create BSV auth headers
      const authHeaders = {
        'x-bsv-auth-identity-key': subject,
        'x-bsv-auth-url': (process.env.NEXT_PUBLIC_SERVER_URL || 'https://common-source-server-production.up.railway.app') + '/signCertificate'
      };

      // Phase 1: Get certificate from server
      const requestBody = {
        type: "DID Document",
        fields: certificateFields,
        acquisitionProtocol: 'issuance'
      };

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://common-source-server-production.up.railway.app';
      const response = await fetch(serverUrl + '/signCertificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const serverCertificate = await response.json();
      console.log('[DidContext] DID certificate signed by server');

      // Phase 2: Store in wallet using direct protocol
      const directResult = await userWallet.acquireCertificate({
        type: serverCertificate.type,
        serialNumber: serverCertificate.serialNumber,
        subject: serverCertificate.subject,
        certifier: serverCertificate.certifier,
        revocationOutpoint: serverCertificate.revocationOutpoint,
        signature: serverCertificate.signature,
        fields: serverCertificate.fields,
        acquisitionProtocol: 'direct'
      });

      console.log('[DidContext] ✅ DID certificate stored in wallet:', directResult.type);
      
      return {
        ...didData,
        certificate: directResult,
        serialNumber: directResult.serialNumber
      };

    } catch (error) {
      console.error('[DidContext] Error storing DID certificate:', error);
      throw error;
    }
  }, [userWallet]);

  // Migrate localStorage DID to certificate storage
  const migrateDIDToCertificate = useCallback(async (didData) => {
    try {
      console.log('[DidContext] Migrating DID from localStorage to certificate...');
      
      // First try to store as certificate
      const result = await storeDIDCertificate(didData);
      
      // If successful, clean up localStorage
      const storedDidKey = `user_did_${userPubKey}`;
      localStorage.removeItem(storedDidKey);
      console.log('[DidContext] ✅ DID migrated to certificate and localStorage cleaned up');
      
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
      console.log('[DidContext] Creating new DID...');
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
        console.error('[DidContext] Failed to store DID as certificate, falling back to localStorage:', certError);
        
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
  }, [userPubKey, loadExistingDID, initializeBsvServices]);

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
      const serverDid = process.env.NEXT_PUBLIC_SERVER_DID || 'did:bsv:tm did:server';

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
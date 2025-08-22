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
  
  // Load existing DID from storage when user key is available
  useEffect(() => {
    if (userPubKey && !userDid) {
      const storedDidKey = `user_did_${userPubKey}`;
      const storedDid = localStorage.getItem(storedDidKey);
      
      if (storedDid) {
        const didData = JSON.parse(storedDid);
        console.log('[DidContext] Loaded existing DID from storage:', didData.did);
        setUserDid(didData.did);
        setDidDocument(didData.didDocument);
      }
    }
  }, [userPubKey, userDid]);

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

  // Create a DID for the user
  const createUserDid = useCallback(async () => {
    try {
      console.log('[DidContext] Creating user DID...');
      
      // Check if we already have a DID stored for this user
      const storedDidKey = `user_did_${userPubKey}`;
      const storedDid = localStorage.getItem(storedDidKey);
      
      if (storedDid) {
        const didData = JSON.parse(storedDid);
        console.log('[DidContext] Found existing DID in storage:', didData.did);
        setUserDid(didData.did);
        setDidDocument(didData.didDocument);
        return didData;
      }
      
      const { didService } = initializeBsvServices();
      if (!didService) {
        throw new Error('BSV DID service not initialized');
      }

      const result = await didService.createUserDid(userPubKey);
      
      setUserDid(result.did);
      setDidDocument(result.didDocument);
      
      // Persist DID to localStorage
      localStorage.setItem(storedDidKey, JSON.stringify(result));
      
      console.log(`[DidContext] User DID created and stored: ${result.did}`);
      return result;

    } catch (error) {
      console.error('[DidContext] Error creating user DID:', error);
      throw error;
    }
  }, [userPubKey, initializeBsvServices]);

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
      createIdentityVCData,
      verifyCertificateVC,
      isVCCertificate,
      bsvDidService,
      bsvVcService
    }}>
      {children}
    </DidContext.Provider>
  );
};

export const useDidContext = () => useContext(DidContext);
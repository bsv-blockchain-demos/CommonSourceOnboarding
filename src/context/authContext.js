"use client";

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../context/walletContext";
import { useDidContext } from "../context/DidContext";
import { unifiedAuth } from '../lib/authentication';

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const { setCertificate, userWallet } = useWalletContext();
  const { verifyCertificateVC, isVCCertificate, bsvDidService, bsvVcService } = useDidContext();

  // Enhanced login with unified authentication and VC verification
  const loginWithCertificate = useCallback(async () => {
    try {
      if (!userWallet) {
        console.log('[AuthContext] No wallet available for login');
        return;
      }

      const { publicKey } = await userWallet.getPublicKey({ identityKey: true });
      console.log('[AuthContext] Starting enhanced login process...');

      // Use unified authentication service for comprehensive verification
      const authResult = await unifiedAuth.authenticateUser(userWallet, publicKey);
      
      if (authResult.success) {
        const certificate = authResult.certificate;
        
        // Enhanced VC verification with DID services
        const vcVerificationResult = await unifiedAuth.verifyVCCertificate(
          certificate, 
          bsvDidService, // DID service for resolution
          bsvVcService || { verifyCertificateVC, isVCCertificate } // VC service methods
        );
        
        if (vcVerificationResult.valid) {
          if (vcVerificationResult.format === 'vc') {
            console.log('[AuthContext] VC certificate verification passed');
            const claims = unifiedAuth.extractIdentityClaims(certificate);
            console.log('[AuthContext] Identity claims extracted:', claims);
          } else {
            console.log('[AuthContext] Legacy certificate format verified');
          }
          
          setCertificate(certificate);
          console.log('[AuthContext] Login successful');
          
        } else {
          console.warn('[AuthContext] Certificate verification failed:', vcVerificationResult.error);
        }
      } else {
        console.log('[AuthContext] No certificate found for login');
      }
      
    } catch (error) {
      console.error('[AuthContext] Error during enhanced login:', error);
    }
  }, [userWallet, verifyCertificateVC, isVCCertificate, setCertificate, bsvDidService, bsvVcService]);

  useEffect(() => {
    loginWithCertificate();
  }, [loginWithCertificate]);

  return (
    <AuthContext.Provider value={{ loginWithCertificate }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

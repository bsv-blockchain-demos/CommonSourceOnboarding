"use client";

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../context/walletContext";
import { useDidContext } from "../context/DidContext";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const { setCertificate, userWallet } = useWalletContext();
  const { verifyCertificateVC, isVCCertificate } = useDidContext();

  // Lets the user login with their certificate if it's saved in the DB
  const loginWithCertificate = useCallback(async () => {
    try {
      if (!userWallet) return;

      const { publicKey } = await userWallet.getPublicKey({ identityKey: true });

    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject: publicKey }),
    });

    const data = await response.json();

    if (data?.certificate) {
      // Check if this is a VC certificate and verify it
      if (isVCCertificate(data.certificate)) {
        console.log('[AuthContext] Found VC certificate, verifying...');
        const verificationResult = verifyCertificateVC(data.certificate);
        
        if (verificationResult.valid) {
          console.log('[AuthContext] VC certificate verification passed');
          console.log('Identity claims:', verificationResult.claims);
        } else {
          console.warn('[AuthContext] VC certificate verification failed:', verificationResult.error);
        }
      } else {
        console.log('[AuthContext] Found legacy certificate format');
      }
      
      setCertificate(data.certificate);
    }
    } catch (error) {
      console.error('[AuthContext] Error logging in with certificate:', error);
    }
  }, [userWallet, verifyCertificateVC, isVCCertificate, setCertificate]);

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

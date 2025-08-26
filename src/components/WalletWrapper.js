"use client"

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { toast } from 'react-hot-toast';
import { walletService } from '../lib/WalletService';
import { DidContextProvider } from "../context/DidContext";
import { AuthContextProvider } from "../context/authContext";

// Create WalletContext
const WalletContext = createContext(null);

export const WalletWrapper = ({ children }) => {
  const [userWallet, setUserWallet] = useState(null);
  const [userPubKey, setUserPubKey] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize wallet using singleton service
  const initializeWallet = useCallback(async () => {
    if (isConnecting) {
      console.log('[WalletWrapper] Already connecting, skipping...');
      return userWallet;
    }

    try {
      setIsConnecting(true);
      console.log('[WalletWrapper] Initializing wallet via singleton service...');
      
      const wallet = await walletService.getWallet();
      const publicKey = walletService.getPublicKey();
      
      setUserWallet(wallet);
      setUserPubKey(publicKey);
      
      toast.success('Wallet connected successfully', {
        duration: 5000,
        position: 'top-center',
      });
      
      console.log('[WalletWrapper] ✅ Wallet initialized successfully');
      return wallet;
      
    } catch (error) {
      console.error('[WalletWrapper] Failed to initialize wallet:', error);
      
      let errorMessage = 'Failed to connect wallet. Please ensure you have a compatible BSV wallet available.';
      if (error.message.includes('not authenticated')) {
        errorMessage = 'Wallet authentication failed. Please unlock your wallet.';
      } else if (error.message.includes('window.CWI')) {
        errorMessage = 'No browser wallet extension found. Please install a BSV wallet.';
      }
      
      toast.error(errorMessage, {
        duration: 7000,
        position: 'top-center',
      });
      
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);
  
  // Initialize wallet on component mount (only once)
  useEffect(() => {
    // Only initialize if we don't already have a wallet
    if (!userWallet && !isConnecting) {
      initializeWallet();
    }
  }, []); // Empty dependency array - only run once on mount

  // Debug: Log what we have in WalletWrapper
  console.log('[WalletWrapper] State:', {
    userWallet: !!userWallet,
    userPubKey: !!userPubKey,
    certificate: !!certificate,
    isConnecting
  });

  return (
    <WalletContext.Provider value={{
      userWallet,
      userPubKey,
      certificate,
      setCertificate,
      initializeWallet
    }}>
      <DidContextProvider userWallet={userWallet} userPubKey={userPubKey}>
        <AuthContextProvider userWallet={userWallet} setCertificate={setCertificate}>
          {children}
        </AuthContextProvider>
      </DidContextProvider>
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletWrapper');
  }
  return context;
};
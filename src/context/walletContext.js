"use client"

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { WalletClient } from "@bsv/sdk";
import { toast } from 'react-hot-toast';
import { unifiedAuth } from '../lib/authentication';

const WalletContext = createContext();

export const WalletContextProvider = ({ children }) => {
    const [userWallet, setUserWallet] = useState(null);
    const [userPubKey, setUserPubKey] = useState(null);
    const [certificate, setCertificate] = useState(null);

    // Initialize the user's wallet
    const initializeWallet = useCallback(async () => {
        try {
            const newWallet = new WalletClient('auto', 'localhost');

            const isConnected = await newWallet.isAuthenticated();
            if (!isConnected) {
                console.error('Wallet not authenticated');
                return;
            }

            const { publicKey } = await newWallet.getPublicKey({ identityKey: true });

            // Only update state once everything is fetched
            setUserPubKey(publicKey);
            setUserWallet(newWallet);
            toast.success('Wallet connected successfully', {
                duration: 5000,
                position: 'top-center',
                id: 'wallet-connect-success',
            });
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
            toast.error('Failed to connect wallet.', {
                duration: 5000,
                position: 'top-center',
                id: 'wallet-connect-error',
            });
        }
    }, []);

    useEffect(() => {
        initializeWallet();
    }, [initializeWallet]);

    // Check for certificate using unified authentication service
    useEffect(() => {
        async function authenticateUser() {
            if (!userWallet || !userPubKey) return;

            console.log('[WalletContext] Starting unified authentication...');
            
            try {
                const authResult = await unifiedAuth.authenticateUser(userWallet, userPubKey);
                
                if (authResult.success) {
                    console.log(`[WalletContext] Authentication successful from ${authResult.source}`);
                    
                    if (authResult.source === 'wallet') {
                        toast.success('Certificate found and verified from wallet', {
                            duration: 5000,
                            position: 'top-center'
                        });
                    } else {
                        toast.success('Certificate found and verified from database', {
                            duration: 5000,
                            position: 'top-center'
                        });
                    }
                    
                    setCertificate(authResult.certificate);
                } else {
                    console.log('[WalletContext] No certificate found - user needs to generate one');
                    // Don't show error toast here - this is normal for new users
                }
            } catch (error) {
                console.error('[WalletContext] Authentication error:', error);
                toast.error('Error during authentication process', {
                    duration: 5000,
                    position: 'top-center'
                });
            }
        }
        
        authenticateUser();
    }, [userWallet, userPubKey]);

    return (
        <WalletContext.Provider value={{ userWallet, userPubKey, initializeWallet, certificate, setCertificate }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWalletContext = () => useContext(WalletContext);
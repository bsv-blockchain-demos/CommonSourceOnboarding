"use client"

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { WalletClient } from "@bsv/sdk";

const WalletContext = createContext();

export const WalletContextProvider = ({ children }) => {
    const [userWallet, setUserWallet] = useState(null);
    const [userPubKey, setUserPubKey] = useState(null);

    const initializeWallet = useCallback(async () => {
        try {
            const newWallet = new WalletClient('auto', 'localhost:3000');

            const isConnected = await newWallet.isAuthenticated();
            if (!isConnected) {
                console.error('Wallet not authenticated');
                return;
            }

            const identityKey = await newWallet.getPublicKey({ identityKey: true });

            // Only update state once everything is fetched
            setUserWallet(newWallet);
            setUserPubKey(identityKey);
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
        }
    }, []);

    useEffect(() => {
        initializeWallet();
    }, []);

    return (
        <WalletContext.Provider value={{ userWallet, userPubKey }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWalletContext = () => useContext(WalletContext);
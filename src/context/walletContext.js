"use client"

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { WalletClient, Utils } from "@bsv/sdk";
import { toast } from 'react-hot-toast';

const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

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
    }, []);

    // Check user wallet for certificate of our type
    useEffect(() => {
        async function checkCertificate() {
            if (!userWallet) return;

            const certificate = await userWallet.listCertificates({
                types: [Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8'))],
                certifiers: [serverPubKey],
                limit: 1,
            });
            // In production check if this certificate is valid before proceeding
            // EX: Check if the certificate field keys are the ones we expect

            if (certificate.totalCertificates > 0) {
                // save to db with api route if it exists
                const response = await fetch('/save-certificate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ certificate: certificate.certificates[0], subject: userPubKey }),
                });
                const data = await response.json();
                
                // On successful save, set the certificate to log in the user
                // If the user already has a certificate, set the certificate to log in the user
                if (response.ok) {
                    toast.success('Certificate saved successfully from wallet');
                    setCertificate(certificate.certificates[0]);
                } else if (data.message === 'User already has a certificate') {
                    setCertificate(certificate.certificates[0]);
                } else {
                    toast.error(`${data.message}`);
                }
            }
        }
        checkCertificate();
    }, [userWallet]);

    return (
        <WalletContext.Provider value={{ userWallet, userPubKey, initializeWallet, certificate, setCertificate }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWalletContext = () => useContext(WalletContext);
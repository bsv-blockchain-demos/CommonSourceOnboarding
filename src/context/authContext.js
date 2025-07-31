"use client"

import { useContext, createContext, useState, useEffect } from "react";
import { useWalletContext } from "../context/walletContext";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
    const [certificate, setCertificate] = useState(null);
    const { userWallet } = useWalletContext();

    useEffect(() => {
        async function loginWithCertificate() {
          // Check db for user certificate
          if (!userWallet) {
            return;
          }
          
          const { publicKey } = userWallet.getPublicKey({ identityKey: true });

          const response = await fetch('/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subject: publicKey }),
          });
    
          const data = await response.json();
    
          if (!data.certificate) {
            return;
          }

          setCertificate(data.certificate);
        }
        loginWithCertificate();
      }, [])

    return (
        <AuthContext.Provider value={{ certificate, loginWithCertificate }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => useContext(AuthContext);
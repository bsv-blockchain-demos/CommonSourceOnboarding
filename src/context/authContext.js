"use client";

import { useContext, createContext, useState, useEffect, useCallback } from "react";
import { useWalletContext } from "../context/walletContext";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const { setCertificate, userWallet } = useWalletContext();

  // Lets the user login with their certificate if it's saved in the DB
  const loginWithCertificate = useCallback(async () => {
    if (!userWallet) return;

    const { publicKey } = userWallet.getPublicKey({ identityKey: true });

    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject: publicKey }),
    });

    const data = await response.json();

    if (data?.certificate) {
      setCertificate(data.certificate);
    }
  }, [userWallet]);

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

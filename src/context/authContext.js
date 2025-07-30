"use client"

import { useContext, createContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
    const [certificate, setCertificate] = useState(null);

    useEffect(() => {
        async function loginWithCertificate() {
          // Check db for user certificate
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
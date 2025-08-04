import React from "react";
import { useWalletContext } from "../context/walletContext";

// TODO add revocation button

const LoggedInPage = () => {
    const { certificate, userPubKey } = useWalletContext();

    const handleRevoke = async () => {
        if (!certificate) return;

        // Spend the revocation outpoint with the serverWallet
        // After successful redemption delete the certificate from the database
        // and call relinquishCertificate

        // const res = await fetch('/api/delete-certificate', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({ publicKey: userPubKey, certificate }),
        // });
        // if (!res.ok) {
        //     toast.error("Something failed, please try again");
        //     return;
        // }
    }

    return (
        <div className="w-full max-w-md">
            <div className="bg-slate-800 rounded-lg p-8 shadow-xl">
                <h1 className="text-2xl font-semibold text-white mb-6 text-center">Welcome Back!</h1>
                <p className="text-slate-400 text-center mb-6">You are successfully logged in with your certificate.</p>
                
                <div className="space-y-4">
                    <button 
                        onClick={handleRevoke}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                        Revoke Certificate
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LoggedInPage;

import React from "react";
import { useWalletContext } from "../context/walletContext";
import { toast } from 'react-hot-toast';

const LoggedInPage = () => {
    const { certificate, userPubKey, setCertificate } = useWalletContext();

    const handleRevoke = async () => {
        if (!certificate) return;

        // Spend the revocation outpoint with the serverWallet
        // After successful redemption delete the certificate from the database
        // and call relinquishCertificate

        const res = await fetch('/delete-certificate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ publicKey: userPubKey, certificate }),
        });
        const data = await res.json();
        if (!res.ok) {
            toast.error(data.message || "Something failed, please try again");
            return;
        }

        toast.success("Certificate revoked successfully");
        setCertificate(null);
    }

    const handleLogout = () => {
        // Simple logout - just clear the certificate from state
        setCertificate(null);
        toast.success("Logged out successfully");
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header Navigation */}
            <header className="bg-slate-800 shadow-lg w-full">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center py-8 relative min-h-[80px] w-full">
                        {/* Logo on the left - stacked vertically */}
                        <div className="flex items-center space-x-4 absolute left-4">
                            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xl">🔗</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-semibold text-teal-400 leading-tight">COMMONSource</span>
                                <span className="text-sm text-gray-300 leading-tight">IDENTITY PLATFORM</span>
                            </div>
                        </div>
                        
                        {/* Centered navigation */}
                        <nav className="hidden md:flex space-x-10 absolute left-1/2 transform -translate-x-1/2">
                            <a href="#" className="text-teal-400 hover:text-teal-300 transition-colors font-medium text-lg">Home</a>
                            <a href="#" className="text-gray-300 hover:text-teal-400 transition-colors text-lg">Certificates</a>
                            <a href="#" className="text-gray-300 hover:text-teal-400 transition-colors text-lg">Identity</a>
                            <a href="#" className="text-gray-300 hover:text-teal-400 transition-colors text-lg">About</a>
                            <a href="#" className="text-gray-300 hover:text-teal-400 transition-colors text-lg">Support</a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Content Section */}
            <section className="py-16 bg-slate-900">
                <div className="max-w-4xl mx-auto text-center px-4">
                    <h2 className="text-4xl font-bold mb-8 text-teal-400">
                        Secure Digital Identity<br />
                        Made Simple
                    </h2>
                    
                    <div className="text-lg text-gray-300 leading-relaxed mb-8 max-w-3xl mx-auto">
                        <p className="mb-4">
                            Your digital identity is now secured with blockchain-based certificates. COMMONSource provides you with 
                            verifiable credentials that you own and control, ensuring privacy and authenticity in every interaction.
                        </p>
                        
                        <p className="text-teal-400 font-semibold">
                            Welcome to the future of digital identity.
                        </p>
                        
                        <p className="mt-4">
                            Manage your certificates, verify your identity, and connect with confidence. Your credentials are 
                            cryptographically secured and always under your control.
                        </p>
                    </div>

                    {/* Welcome Back Card */}
                    <div className="bg-slate-800 rounded-lg p-8 mt-12 border border-slate-600 max-w-md mx-auto">
                        <h3 className="text-2xl font-semibold text-teal-400 mb-4">Welcome Back!</h3>
                        <p className="text-gray-300 mb-6">You are successfully logged in with your certificate.</p>
                        
                        <div className="space-y-4">
                            <button 
                                onClick={handleRevoke}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                                Revoke Certificate
                            </button>
                            <button 
                                onClick={handleLogout}
                                className="w-full bg-slate-600 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                                Logout (Keep Certificate)
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default LoggedInPage;

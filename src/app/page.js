"use client"

import React, { useState } from "react";
import { WalletClient } from "@bsv/sdk";
import { sendEmailFunc, verifyCode } from "../hooks/emailVerification";
import { useWalletContext } from "../context/walletContext";

export default function Home() {
  const [username, setUsername] = useState('');
  const [residence, setResidence] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [work, setWork] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const { userWallet, initializeWallet } = useWalletContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  const handleGenerateCert = async () => {
    // Make cert with API
    if (!userWallet) {
      await initializeWallet();
    }
    const wallet = userWallet;

    const certResponse = await wallet.acquireCertificate({
      type: Buffer.from("CommonSource user identity").toString('base64'),
      fields: {
        username: username,
        residence: residence,
        age: age,
        gender: gender,
        email: email,
        work: work,
      },
      acquisitionProtocol: "issuance",
      certifier: serverPubKey,
      certifierUrl: "localhost:3000/api/certificate",
    });
    console.log(certResponse);
  }

  // For demo purpose we proceed as if the user is always validated
  const handleEmailVerify = async () => {
    // const verifyRes = await verifyCode({ email, verificationCode });
    // if (verifyRes.verificationStatus === false) {
    //   return;
    // }

    setEmailVerified(true);
    return;
  }

  const handleSendEmail = async () => {
    // const emailRes = await sendEmailFunc({ email });
    // if (emailRes.textSentStatus === false) {
    //   return;
    // }

    setEmailSent(true);
    return;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <button disabled={userWallet} onClick={initializeWallet}>Initialize wallet</button>
      <div className="w-full max-w-md">
        {emailVerified ? (
          <div className="bg-slate-800 rounded-lg p-8 shadow-xl">
            <h1 className="text-2xl font-semibold text-white mb-6 text-center">User Information</h1>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input 
                type="text" 
                placeholder="Residence" 
                value={residence} 
                onChange={(e) => setResidence(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input 
                type="text" 
                placeholder="Age" 
                value={age} 
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input 
                type="text" 
                placeholder="Gender" 
                value={gender} 
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input 
                type="text" 
                placeholder="Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input 
                type="text" 
                placeholder="Work" 
                value={work} 
                onChange={(e) => setWork(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button 
                onClick={handleGenerateCert}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                Generate Certificate
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-8 shadow-xl">
            {emailSent ? (
              <div>
                <h1 className="text-2xl font-semibold text-white mb-6 text-center">Check your email for a verification code</h1>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Verification Code" 
                    value={verificationCode} 
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button 
                    onClick={handleEmailVerify}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                  >
                    Verify
                  </button>
                  <button 
                    onClick={() => setEmailSent(false)}
                    className="w-full bg-transparent border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                  >
                    Go back
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-semibold text-white mb-2 text-center">Certify your identity using your email address</h1>
                <p className="text-slate-400 text-center mb-6">We'll send you an email to verify</p>
                <div className="space-y-4">
                  <input 
                    type="email" 
                    placeholder="example@email.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <button 
                    onClick={handleSendEmail}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

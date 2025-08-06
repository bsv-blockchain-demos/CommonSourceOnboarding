"use client"

import React, { useState } from "react";
import { sendEmailFunc, verifyCode } from "../hooks/emailVerification";
import { useWalletContext } from "../context/walletContext";
import { useDidContext } from "../context/DidContext";
import { Utils } from "@bsv/sdk";
import { toast } from 'react-hot-toast';
import { useAuthContext } from "../context/authContext";
import LoggedInPage from "../components/loggedInPage";

export default function Home() {
  const [username, setUsername] = useState('');
  const [residence, setResidence] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [work, setWork] = useState('');
  // Skip email verification for testing
  const [emailVerified, setEmailVerified] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [generated, setGenerated] = useState(false);

  const { userWallet, initializeWallet, certificate } = useWalletContext();
  const { createUserDid, createIdentityVCData } = useDidContext();
  const { loginWithCertificate } = useAuthContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  const handleGenerateCert = async () => {
    try {
      // Initialize wallet if needed
      if (!userWallet) {
        await initializeWallet();
      }
      const wallet = userWallet;

      // Step 1: Create user DID first
      console.log('Creating user DID...');
      const didResult = await createUserDid();
      toast.success('DID created successfully');

      // Step 2: Create VC data structure for certificate
      console.log('Creating VC data structure...');
      const vcData = createIdentityVCData({
        username,
        residence,
        age,
        gender,
        email,
        work
      });

      // Step 3: Acquire certificate with VC data as fields
      console.log('Acquiring certificate with VC data...');
      const certResponse = await wallet.acquireCertificate({
        type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
        fields: vcData, // Use VC structure instead of flat fields
        acquisitionProtocol: "issuance",
        certifier: serverPubKey,
        certifierUrl: "http://localhost:8080",
      });
      
      console.log('Certificate with VC data acquired:', certResponse);
      toast.success('Identity certificate generated successfully');
      setGenerated(true);

    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error(`Failed to generate certificate: ${error.message}`);
    }
  }

  //Verify user by email
  const handleEmailVerify = async () => {
    const verifyRes = await verifyCode(email, verificationCode);

    if (verifyRes.verificationStatus === false) {
      toast.error(verifyRes.message);
      return;
    }

    // On successful verification, delete the email from the database
    const res = await fetch('/emailVerify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, type: 'delete-on-verified' }),
    });
    if (!res.ok) {
      toast.error("Something failed, please try again");
      return;
    }

    setEmailVerified(true);
    return;
  }

  // Send email with verification code
  const handleSendEmail = async () => {
    const emailResponse = await sendEmailFunc(email);
    
    if (!emailResponse?.sentStatus) {
      toast.error("Failed to send email");
      return;
    }

    setEmailSent(true);
    return;
  }

  const handleLogin = async () => {
    await loginWithCertificate();
  }

  if (generated && !certificate) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <button
            onClick={handleLogin}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Login
          </button>
        </div>
      </div>
    )
  }

  if (certificate) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <LoggedInPage />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={initializeWallet}
          disabled={userWallet}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {userWallet ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </div>

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

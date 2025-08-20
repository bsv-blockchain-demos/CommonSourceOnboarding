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
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [generated, setGenerated] = useState(false);
  const [didCreated, setDidCreated] = useState(false);

  const { userWallet, initializeWallet, certificate } = useWalletContext();
  const { createUserDid, createIdentityVCData, userDid } = useDidContext();
  const { loginWithCertificate } = useAuthContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  const handleCreateDid = async () => {
    try {
      // Initialize wallet if needed
      let wallet = userWallet;
      if (!wallet) {
        console.log('Initializing wallet...');
        wallet = await initializeWallet();
        if (!wallet) {
          throw new Error('Failed to initialize wallet');
        }
      }
      
      // Log the user's identity key to help with funding
      const identityKey = await wallet.getPublicKey({ identityKey: true });
      console.log('User wallet identity key (needs funding):', identityKey);
      
      // Check wallet balance
      try {
        const balance = await wallet.getBalance();
        console.log('User wallet balance:', balance, 'satoshis');
        if (balance < 10) {
          toast.error(`Insufficient funds in wallet. Balance: ${balance} satoshis. Please fund your wallet.`);
          return;
        }
      } catch (balanceError) {
        console.log('Could not check balance:', balanceError);
      }
      
      // // In production check the db if the user is verified before proceeding
      // const res = await fetch('/emailVerify', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ email, type: 'check-verified' }),
      // });
      // const jsonRes = await res.json();
      // if (!jsonRes.verificationStatus) {
      //   toast.error(jsonRes.message);
      //   return;
      // }

      // Step 1: Create user DID first
      console.log('Creating user DID...');
      const didResult = await createUserDid();
      toast.success('DID created successfully');
      setDidCreated(true);

    } catch (error) {
      console.error('Error creating DID:', error);
      toast.error(`Failed to create DID: ${error.message}`);
    }
  }

  const handleGenerateCert = async () => {
    try {
      // Check if DID exists first
      if (!userDid) {
        toast.error('Please create DID first');
        return;
      }

      // Initialize wallet if needed
      let wallet = userWallet;
      if (!wallet) {
        console.log('Initializing wallet...');
        wallet = await initializeWallet();
        if (!wallet) {
          throw new Error('Failed to initialize wallet');
        }
      }

      // Create VC data structure for certificate
      console.log('Creating VC data structure...');
      const vcData = createIdentityVCData({
        username,
        residence,
        age,
        gender,
        email,
        work
      });

      console.log('VC Data created:', vcData);

      // Acquire certificate with minimal fields to avoid size limits
      console.log('Acquiring certificate with minimal VC reference...');

      // Only store minimal data in certificate fields due to encryption size limits
      // Full VC data will be stored in MongoDB separately
      const certResponse = await wallet.acquireCertificate({
        type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
        fields: {
          // Keep fields minimal to avoid database column size limits after encryption
          username: username,
          email: email,
          isVC: 'true',
          didRef: userDid ? userDid.split(':').pop().substring(0, 8) : 'pending' // Just first 8 chars of DID as reference
        },
        acquisitionProtocol: "issuance",
        certifier: serverPubKey,
        certifierUrl: "http://localhost:8080",
      });

      console.log('Certificate with VC data acquired:', certResponse);
      toast.success('Identity certificate generated successfully');
      setGenerated(true);

      // On successful certificate generation, delete the email from the database
      const res = await fetch('/emailVerify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type: 'delete-on-generated' }),
      });
      if (!res.ok) {
        toast.error("Something failed, please try again");
        return;
      }

    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error(`Failed to generate certificate: ${error.message}`);
    }
  }

  //Verify user by email
  const handleEmailVerify = async () => {
    if (!verificationCode || !email) {
      toast.error("Please enter a verification code");
      return;
    }
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
    if (!email) {
      toast.error("Please enter an email");
      return;
    }
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
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Header Navigation */}
        <header className="bg-slate-800 shadow-lg w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-8 relative min-h-[80px] w-full">
              {/* Logo on the left */}
              <div className="flex items-center space-x-4 absolute left-4">
                <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">🔗</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-semibold text-teal-400 leading-tight">COMMONSource</span>
                  <span className="text-sm text-gray-300 leading-tight">IDENTITY PLATFORM</span>
                </div>
              </div>
              
              {/* Login button on the right */}
              <button
                onClick={handleLogin}
                className="absolute right-4 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Login
              </button>
            </div>
          </div>
        </header>
        
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <div className="text-center text-gray-300">
            <p>Certificate generated successfully! Please login to continue.</p>
          </div>
        </div>
      </div>
    )
  }

  if (certificate) {
    return (
      <LoggedInPage />
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header Navigation */}
      <header className="bg-slate-800 shadow-lg w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-8 relative min-h-[80px] w-full">
            {/* Logo on the left */}
            <div className="flex items-center space-x-4 absolute left-4">
              <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">🔗</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-teal-400 leading-tight">COMMONSource</span>
                <span className="text-sm text-gray-300 leading-tight">IDENTITY PLATFORM</span>
              </div>
            </div>
            
            {/* Wallet button on the right */}
            <button
              onClick={initializeWallet}
              disabled={userWallet}
              className="absolute right-4 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {userWallet ? "Wallet Connected" : "Connect Wallet"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
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
                onClick={handleCreateDid}
                disabled={didCreated}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-3 ${didCreated
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {didCreated ? 'DID Created ✓' : 'Create DID'}
              </button>
              <button
                onClick={handleGenerateCert}
                disabled={!didCreated}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors duration-200 ${!didCreated
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 hover:cursor-pointer text-white'
                  }`}
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
                    disabled={!verificationCode || !email}
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
                <p className="text-slate-400 text-center mb-6">We&apos;ll send you an email to verify</p>
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
                    disabled={!userWallet || !email}
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
    </div>
  );
}

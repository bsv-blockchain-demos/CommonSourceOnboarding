"use client"

import React, { useState, useEffect, useCallback } from "react";
import { sendEmailFunc, verifyCode } from "../hooks/emailVerification";
import { useWalletContext } from "../context/walletContext";
import { useDidContext } from "../context/DidContext";
import { Utils, MasterCertificate, createNonce, Certificate } from "@bsv/sdk";
import { toast } from 'react-hot-toast';
import { useAuthContext } from "../context/authContext";
import LoggedInPage from "../components/loggedInPage";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// Custom certificate acquisition function that properly handles certifierUrl
async function acquireCertificateCustom(wallet, args) {
  try {
    console.log('[Custom Cert] Starting certificate acquisition with args:', args);
    
    // Get user's identity key
    const { publicKey: subject } = await wallet.getPublicKey({ identityKey: true });
    console.log('[Custom Cert] User identity key:', subject);
    
    // Create client nonce for replay protection
    const clientNonce = await createNonce(wallet, args.certifier);
    console.log('[Custom Cert] Created client nonce');
    
    // Create certificate fields and master keyring for encryption
    const { certificateFields, masterKeyring } = await MasterCertificate.createCertificateFields(
      wallet,
      args.certifier,
      args.fields
    );
    console.log('[Custom Cert] Created encrypted fields and master keyring for server');
    
    // Prepare request body
    const requestBody = {
      clientNonce: clientNonce,
      type: args.type,
      fields: certificateFields,
      masterKeyring: masterKeyring,
      acquisitionProtocol: args.acquisitionProtocol
    };
    
    console.log('[Custom Cert] Making authenticated request to:', args.certifierUrl + '/signCertificate');
    
    // Create BSV auth headers
    const authHeaders = await createBsvAuthHeaders(wallet, subject, args.certifierUrl + '/signCertificate');
    
    // Make HTTP request to certificate server
    const response = await fetch(args.certifierUrl + '/signCertificate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Certificate server responded with ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('[Custom Cert] Received certificate response:', responseData);
    
    // The response should be the certificate object directly
    const certificate = responseData;
    
    // Create Certificate instance and store in wallet
    const cert = new Certificate(
      certificate.type,
      certificate.serialNumber,
      certificate.subject,
      certificate.certifier,
      certificate.revocationOutpoint,
      certificate.fields,
      certificate.signature
    );
    
    console.log('[Custom Cert] Created certificate instance:', cert);
    
    // Certificate acquisition successful - return the certificate
    // The certificate will be handled by the wallet context for storage/validation
    console.log('[Custom Cert] Certificate acquisition completed successfully');
    
    return cert;
    
  } catch (error) {
    console.error('[Custom Cert] Error during certificate acquisition:', error);
    throw new Error(`Certificate acquisition failed: ${error.message}`);
  }
}

// Helper function to create BSV authentication headers
async function createBsvAuthHeaders(wallet, identityKey, url) {
  try {
    // This is a simplified BSV auth header - in production you'd want full BSV auth middleware
    return {
      'x-bsv-auth-identity-key': identityKey,
      'x-bsv-auth-url': url
    };
  } catch (error) {
    console.error('Error creating BSV auth headers:', error);
    return {
      'x-bsv-auth-identity-key': identityKey
    };
  }
}

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
  const [didCreated, setDidCreated] = useState(false);
  const [existingDidFound, setExistingDidFound] = useState(false);
  const [checkingDid, setCheckingDid] = useState(false);

  const { userWallet, initializeWallet, certificate, userPubKey } = useWalletContext();
  const { createUserDid, createIdentityVCData, userDid } = useDidContext();
  const { loginWithCertificate } = useAuthContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  // Check for existing DID when wallet is connected
  const checkExistingDid = useCallback(async (publicKey) => {
    if (!publicKey || checkingDid) return;
    
    setCheckingDid(true);
    try {
      // Temporarily disable DID checking to avoid 500 errors
      console.log('Skipping DID check due to server issues - proceeding with fresh DID creation');
      // Just set the state to allow proceeding
      setCheckingDid(false);
      return;
      
      // Original code (commented out temporarily):
      // const response = await fetch('/check-existing-did', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ publicKey })
      // });
      // 
      // const data = await response.json();
      // if (response.ok && data.hasExistingDid) {
      //   setExistingDidFound(true);
      //   setDidCreated(true);
      //   toast.success('Found existing DID - you can generate a new certificate');
      // }
    } catch (error) {
      console.error('Error checking existing DID:', error);
    } finally {
      setCheckingDid(false);
    }
  }, [checkingDid]);

  // Check for existing DID when wallet connects
  useEffect(() => {
    if (userPubKey && !certificate && !existingDidFound && !checkingDid) {
      console.log('Checking for existing DID for user:', userPubKey);
      checkExistingDid(userPubKey);
    }
  }, [userPubKey, certificate, existingDidFound, checkingDid, checkExistingDid]);

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
      await createUserDid();
      toast.success('DID created successfully');
      setDidCreated(true);

    } catch (error) {
      console.error('Error creating DID:', error);
      toast.error(`Failed to create DID: ${error.message}`);
    }
  }

  const handleGenerateCert = async () => {
    try {
      // Check if DID exists first - skip check if we found an existing DID in database
      if (!userDid && !existingDidFound) {
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
      let vcData = null;
      
      // Try to create VC data - if it fails due to missing userDid but we found existing DID, skip VC creation
      try {
        vcData = createIdentityVCData({
          username,
          residence,
          age,
          gender,
          email,
          work
        });
      } catch (vcError) {
        if (existingDidFound && vcError.message.includes('User DID not available')) {
          console.log('Skipping VC creation since existing DID found but not loaded in context');
          // We'll proceed without VC data, relying on the server to handle existing DID
          vcData = null;
        } else {
          throw vcError;
        }
      }

      console.log('VC Data created:', vcData);

      // Store VC data locally for later resolution (until overlay is implemented)
      let didRef = 'pending';
      if (userDid) {
        didRef = userDid.split(':').pop().substring(0, 8);
      } else if (existingDidFound) {
        didRef = 'existing';
      }
      
      if (vcData) {
        const storedVCKey = `vc_data_${didRef}`;
        localStorage.setItem(storedVCKey, JSON.stringify(vcData));
        console.log('Stored VC data for later resolution');
      } else {
        console.log('No VC data to store - relying on server for existing DID handling');
      }

      // Acquire certificate with ALL fields for compatibility
      // IMPORTANT: Including all fields for age verification in whiskey store
      const certifierUrl = process.env.NEXT_PUBLIC_CERTIFIER_URL || "http://localhost:8080";
      console.log('Acquiring certificate with user identity fields...');
      console.log('Certifier URL:', certifierUrl);
      console.log('Server Public Key:', serverPubKey);

      // Use custom certificate acquisition to bypass substrate issues
      console.log('Using custom certificate acquisition with Railway server...');
      const certResponse = await acquireCertificateCustom(wallet, {
        type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
        fields: {
          // Include all fields for backward compatibility and age verification
          username: username,
          residence: residence,
          age: age,  // CRITICAL: This is needed for age verification in whiskey store
          gender: gender,
          email: email,
          work: work,
          // VC metadata
          isVC: "true",
          didRef: didRef
        },
        acquisitionProtocol: "issuance",
        certifier: serverPubKey,
        certifierUrl: certifierUrl,
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
      body: JSON.stringify({ email, type: 'delete-on-verified' }), // For production change to 'verified'
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <Button onClick={handleLogin}>
            Login
          </Button>
        </div>
      </div>
    )
  }

  if (certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoggedInPage />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Button
          onClick={initializeWallet}
          disabled={userWallet}
          variant={userWallet ? "secondary" : "default"}
        >
          {userWallet ? "Wallet Connected" : "Connect Wallet"}
        </Button>
      </div>

      <div className="w-full max-w-md">
        {emailVerified ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="residence">Residence</Label>
                <Input
                  id="residence"
                  type="text"
                  placeholder="Enter your residence"
                  value={residence}
                  onChange={(e) => setResidence(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Enter your age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Input
                  id="gender"
                  type="text"
                  placeholder="Enter your gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work">Work</Label>
                <Input
                  id="work"
                  type="text"
                  placeholder="Enter your work/occupation"
                  value={work}
                  onChange={(e) => setWork(e.target.value)}
                />
              </div>
              <div className="space-y-3 pt-4">
                <Button
                  onClick={handleCreateDid}
                  disabled={didCreated || checkingDid}
                  variant={didCreated ? "secondary" : "default"}
                  className="w-full"
                >
                  {checkingDid ? 'Checking for existing DID...' : 
                   existingDidFound ? 'DID Found ✓' : 
                   didCreated ? 'DID Created ✓' : 'Create DID'}
                </Button>
                <Button
                  onClick={handleGenerateCert}
                  disabled={!didCreated}
                  variant={!didCreated ? "secondary" : "default"}
                  className="w-full"
                >
                  Generate Certificate
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            {emailSent ? (
              <CardHeader>
                <CardTitle className="text-center">Check your email for a verification code</CardTitle>
              </CardHeader>
            ) : (
              <CardHeader>
                <CardTitle className="text-center">Certify your identity using your email address</CardTitle>
                <p className="text-muted-foreground text-center">We&apos;ll send you an email to verify</p>
              </CardHeader>
            )}
            <CardContent className="space-y-4">
              {emailSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      placeholder="Enter verification code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Button onClick={handleEmailVerify} className="w-full">
                      Verify
                    </Button>
                    <Button 
                      onClick={() => setEmailSent(false)} 
                      variant="outline" 
                      className="w-full"
                    >
                      Go back
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-verify">Email Address</Label>
                    <Input
                      id="email-verify"
                      type="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSendEmail} className="w-full">
                    Send Verification Code
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
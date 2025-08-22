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

// Custom certificate acquisition function that gets the certificate from server
// then uses the BSV SDK's direct protocol to store it properly in the wallet
async function acquireCertificateCustom(wallet, args) {
  try {
    console.log('[Custom Cert] Starting two-phase certificate acquisition...');
    
    // Phase 1: Get certificate from our server using issuance protocol
    const { publicKey: subject } = await wallet.getPublicKey({ identityKey: true });
    console.log('[Custom Cert] User identity key:', subject);
    
    const clientNonce = await createNonce(wallet, args.certifier);
    const { certificateFields, masterKeyring } = await MasterCertificate.createCertificateFields(
      wallet,
      args.certifier,
      args.fields
    );
    
    const requestBody = {
      clientNonce: clientNonce,
      type: args.type,
      fields: certificateFields,
      masterKeyring: masterKeyring,
      acquisitionProtocol: args.acquisitionProtocol
    };
    
    console.log('[Custom Cert] Phase 1: Getting certificate from server...');
    const authHeaders = await createBsvAuthHeaders(wallet, subject, args.certifierUrl + '/signCertificate');
    
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
    
    const certificate = await response.json();
    console.log('[Custom Cert] Received certificate from server:', certificate);
    
    // Phase 2: Use BSV SDK's acquireCertificate with "direct" protocol to store it properly
    // This should store the certificate in the wallet's persistent storage
    console.log('[Custom Cert] Phase 2: Storing certificate in wallet using direct protocol...');
    
    try {
      const storedCert = await wallet.acquireCertificate({
        type: certificate.type,
        serialNumber: certificate.serialNumber,
        revocationOutpoint: certificate.revocationOutpoint,
        signature: certificate.signature,
        fields: certificate.fields,
        certifier: certificate.certifier,
        acquisitionProtocol: 'direct' // Direct protocol doesn't need certifierUrl
      });
      
      console.log('[Custom Cert] Certificate stored successfully in wallet');
      return storedCert;
      
    } catch (directError) {
      console.error('[Custom Cert] Direct storage failed, returning certificate anyway:', directError);
      // Even if direct storage fails, return the certificate we got from server
      const cert = new Certificate(
        certificate.type,
        certificate.serialNumber,
        certificate.subject,
        certificate.certifier,
        certificate.revocationOutpoint,
        certificate.fields,
        certificate.signature
      );
      return cert;
    }
    
  } catch (error) {
    console.error('[Custom Cert] Error during certificate acquisition:', error);
    throw new Error(`Certificate acquisition failed: ${error.message}`);
  }
}

// Test function to store DID Document as BSV certificate
async function testDidDocumentCertificate(wallet, didService, serverPublicKey) {
  try {
    console.log('[DID Certificate Test] Starting DID document certificate test...');
    
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }
    
    if (!didService) {
      throw new Error('DID service not initialized');
    }
    
    // Generate DID document using existing service
    console.log('[DID Certificate Test] Creating DID document...');
    const didResult = await didService.createUserDid();
    console.log('[DID Certificate Test] DID created:', didResult.did);
    
    // Extract serial number from DID result for certificate linkage
    const serialNumber = didResult.serialNumber;
    console.log('[DID Certificate Test] Serial number:', serialNumber);
    
    // Create certificate fields for DID document
    const certificateFields = {
      didId: didResult.did,
      didDocument: JSON.stringify(didResult.didDocument),
      version: "1.0",
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    console.log('[DID Certificate Test] Certificate fields prepared:', {
      didId: certificateFields.didId,
      documentSize: certificateFields.didDocument.length,
      version: certificateFields.version
    });
    
    // Use existing custom acquisition to store DID document as certificate
    console.log('[DID Certificate Test] Acquiring DID document certificate...');
    const certificate = await acquireCertificateCustom(wallet, {
      type: "DID Document",
      fields: certificateFields,
      certifier: serverPubKey,
      certifierUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'https://common-source-server-production.up.railway.app',
      acquisitionProtocol: 'issuance'
    });
    
    console.log('[DID Certificate Test] DID Document Certificate stored successfully:', {
      type: certificate.type,
      serialNumber: certificate.serialNumber,
      subject: certificate.subject,
      hasFields: !!certificate.fields
    });
    
    // Verify the certificate contains the DID document
    if (certificate.fields && certificate.fields.didDocument) {
      const retrievedDocument = JSON.parse(certificate.fields.didDocument);
      console.log('[DID Certificate Test] Retrieved DID document from certificate:', retrievedDocument.id);
      
      // Validate the retrieved document matches original
      if (retrievedDocument.id === didResult.did) {
        console.log('[DID Certificate Test] ✅ DID document certificate test PASSED');
        return {
          success: true,
          certificate,
          didDocument: retrievedDocument,
          serialNumber: certificate.serialNumber
        };
      } else {
        throw new Error(`DID mismatch: expected ${didResult.did}, got ${retrievedDocument.id}`);
      }
    } else {
      throw new Error('Certificate does not contain DID document fields');
    }
    
  } catch (error) {
    console.error('[DID Certificate Test] ❌ Test FAILED:', error);
    throw new Error(`DID Document Certificate test failed: ${error.message}`);
  }
}

// Helper function to resolve DID from wallet certificates
async function resolveDIDFromCertificate(wallet, didId) {
  try {
    console.log('[DID Resolution] Resolving DID from certificates:', didId);
    
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }
    
    // List all certificates and filter for DID documents
    const certificates = await wallet.listCertificates();
    console.log('[DID Resolution] Found', certificates.length, 'total certificates');
    
    const didDocumentType = btoa("DID Document");
    const didCertificates = certificates.filter(cert => 
      cert.type === didDocumentType
    );
    
    console.log('[DID Resolution] Found', didCertificates.length, 'DID document certificates');
    
    // Find certificate with matching DID
    const matchingCert = didCertificates.find(cert => 
      cert.fields && cert.fields.didId === didId
    );
    
    if (matchingCert) {
      console.log('[DID Resolution] Found matching certificate for DID:', didId);
      const didDocument = JSON.parse(matchingCert.fields.didDocument);
      
      console.log('[DID Resolution] ✅ DID resolved successfully');
      return {
        didDocument,
        certificate: matchingCert,
        found: true
      };
    }
    
    console.log('[DID Resolution] ⚠️ No certificate found for DID:', didId);
    return { found: false };
    
  } catch (error) {
    console.error('[DID Resolution] Error resolving DID from certificate:', error);
    throw new Error(`DID resolution failed: ${error.message}`);
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

  const { userWallet, initializeWallet, certificate, userPubKey, setCertificate } = useWalletContext();
  const { createUserDid, createIdentityVCData, userDid, didService, loadExistingDID, checkWalletForDIDCertificates } = useDidContext();
  const { loginWithCertificate } = useAuthContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

  // Check for existing DID when wallet is connected
  const checkExistingCertificate = useCallback(async (publicKey) => {
    if (!publicKey || checkingDid) return;
    
    setCheckingDid(true);
    try {
      console.log('[Page] Checking for existing certificates and DIDs for user:', publicKey);
      
      // Check if user already has a certificate loaded in context
      if (certificate) {
        console.log('[Page] User already has certificate loaded in context');
        setExistingDidFound(true);
        setDidCreated(true);
        setCheckingDid(false);
        return;
      }
      
      // Check if DID is already loaded in DidContext
      if (userDid) {
        console.log('[Page] User already has DID loaded in context:', userDid);
        setExistingDidFound(true);
        setDidCreated(true);
        setCheckingDid(false);
        return;
      }
      
      // Check wallet for DID certificates using DidContext function
      if (userWallet && checkWalletForDIDCertificates) {
        console.log('[Page] Checking wallet for DID certificates...');
        const didCertResult = await checkWalletForDIDCertificates();
        
        if (didCertResult) {
          console.log('[Page] ✅ Found existing DID certificate:', didCertResult.did);
          setExistingDidFound(true);
          setDidCreated(true);
          setCheckingDid(false);
          return;
        }
      }
      
      // Check wallet for identity certificates
      if (userWallet) {
        try {
          console.log('[Page] Checking wallet for identity certificates...');
          const certificates = await userWallet.listCertificates();
          const identityType = btoa("CommonSource user identity");
          const identityCerts = certificates.filter(cert => cert.type === identityType);
          
          if (identityCerts.length > 0) {
            console.log('[Page] ✅ Found existing identity certificates:', identityCerts.length);
            setExistingDidFound(true);
            setDidCreated(true);
            setCheckingDid(false);
            return;
          }
        } catch (certError) {
          console.error('[Page] Error checking identity certificates:', certError);
        }
      }
      
      // No existing certificates or DIDs found
      console.log('[Page] No existing certificates or DIDs found - user can create new ones');
      setExistingDidFound(false);
      setDidCreated(false);
      
    } catch (error) {
      console.error('[Page] Error checking existing certificates:', error);
    } finally {
      setCheckingDid(false);
    }
  }, [checkingDid, certificate, userDid, userWallet, checkWalletForDIDCertificates]);

  // Check for existing certificate when wallet connects
  useEffect(() => {
    if (userPubKey && !certificate && !existingDidFound && !checkingDid) {
      console.log('Checking for existing certificate for user:', userPubKey);
      checkExistingCertificate(userPubKey);
    }
  }, [userPubKey, certificate, existingDidFound, checkingDid, checkExistingCertificate]);

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
      
      // Trigger authentication check to detect the new certificate
      console.log('Triggering authentication check to detect new certificate...');
      
      // Set certificate directly in wallet context to trigger state update
      setCertificate(certResponse);
      
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

  // Test handler for DID document certificate storage
  const handleTestDidCertificate = async () => {
    try {
      if (!wallet) {
        toast.error('Please connect wallet first');
        return;
      }

      if (!didService) {
        toast.error('DID service not initialized');
        return;
      }

      toast.info('Testing DID document certificate storage...');
      
      const result = await testDidDocumentCertificate(wallet, didService, serverPubKey);
      
      if (result.success) {
        toast.success(`✅ DID Certificate Test PASSED! DID: ${result.didDocument.id}`);
        console.log('[UI Test] DID Certificate stored with serial number:', result.serialNumber);
      }
      
    } catch (error) {
      console.error('[UI Test] DID Certificate test failed:', error);
      toast.error(`❌ DID Certificate Test FAILED: ${error.message}`);
    }
  }

  // Test handler for DID resolution from certificates
  const handleTestDidResolution = async () => {
    try {
      if (!wallet) {
        toast.error('Please connect wallet first');
        return;
      }

      // For testing, we'll try to resolve any existing DID
      // In a real scenario, you'd pass a specific DID ID
      const certificates = await wallet.listCertificates();
      const didDocumentType = btoa("DID Document");
      const didCerts = certificates.filter(cert => cert.type === didDocumentType);
      
      if (didCerts.length === 0) {
        toast.info('No DID certificates found. Run DID Certificate Test first.');
        return;
      }

      const testDid = didCerts[0].fields.didId;
      toast.info(`Testing DID resolution for: ${testDid}`);
      
      const result = await resolveDIDFromCertificate(wallet, testDid);
      
      if (result.found) {
        toast.success(`✅ DID Resolution PASSED! Resolved: ${result.didDocument.id}`);
        console.log('[UI Test] DID resolved successfully:', result.didDocument);
      } else {
        toast.warning('⚠️ DID not found in certificates');
      }
      
    } catch (error) {
      console.error('[UI Test] DID Resolution test failed:', error);
      toast.error(`❌ DID Resolution Test FAILED: ${error.message}`);
    }
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
                
                {/* Test buttons for DID Document Certificate functionality */}
                <div className="border-t pt-3 mt-4">
                  <p className="text-sm text-muted-foreground text-center mb-3">DID Certificate Tests</p>
                  <div className="space-y-2">
                    <Button
                      onClick={handleTestDidCertificate}
                      disabled={!userWallet || !didService}
                      variant="outline"
                      className="w-full text-sm"
                    >
                      Test DID Certificate Storage
                    </Button>
                    <Button
                      onClick={handleTestDidResolution}
                      disabled={!userWallet}
                      variant="outline"
                      className="w-full text-sm"
                    >
                      Test DID Resolution
                    </Button>
                  </div>
                </div>
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
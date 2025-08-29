"use client"

import React, { useState, useEffect, useCallback, useRef } from "react";
import { sendEmailFunc, verifyCode } from "../hooks/emailVerification";
import { Utils, createNonce } from "@bsv/sdk";
import { useDidContext } from "../context/DidContext";
import { toast } from 'react-hot-toast';
import { useAuthContext } from "../context/authContext";
import { useWallet } from "../components/WalletWrapper";
import LoggedInPage from "../components/loggedInPage";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// Use the EXACT working pattern from pre-Vercel commit a337e5a
// This was the last known working certificate acquisition approach


// Helper function to resolve DID from wallet certificates


export default function Home() {
  
  // Get wallet context
  const { userWallet, userPubKey, certificate, setCertificate, initializeWallet } = useWallet();
  
  console.log('[Page] Wallet context received:', {
    userWallet: !!userWallet,
    userPubKey: !!userPubKey,
    certificate: !!certificate
  });
  const [username, setUsername] = useState('');
  const [residence, setResidence] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [work, setWork] = useState('');
  const [emailVerified, setEmailVerified] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [generated, setGenerated] = useState(false);
  const [didCreated, setDidCreated] = useState(false);
  const [existingDidFound, setExistingDidFound] = useState(false);
  const [checkingDid, setCheckingDid] = useState(false);
  const [autoGeneratingDid, setAutoGeneratingDid] = useState(false);
  const [autoGenerationFailed, setAutoGenerationFailed] = useState(false);
  const [hasBdidCert, setHasBdidCert] = useState(false);
  const [hasBvcCert, setHasBvcCert] = useState(false);

  const { createUserDid, createIdentityVCData, userDid, resetInitializationFlag } = useDidContext();
  const { loginWithCertificate } = useAuthContext();

  const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;
  
  // Page-level initialization tracking to prevent infinite loops
  const hasCheckedExisting = useRef(false);
  const walletCheckAttempts = useRef(new Map()); // Track attempts by pubkey
  const walletErrorCount = useRef(0);
  const maxWalletErrors = 5; // Increased from 3 to 5 for legitimate operations

  // Comprehensive certificate detection function - checks for both Bdid and Bvc certificates
  const checkAllCertificates = useCallback(async (wallet) => {
    if (!wallet) {
      console.log('[CertDetection] No wallet available');
      return { hasBdidCert: false, hasBvcCert: false, certificates: [], bdidCertificates: [], bvcCertificates: [] };
    }

    try {
      console.log('[CertDetection] Starting comprehensive certificate detection...');
      
      const serverPubKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4";
      
      // Get all certificates from the server
      let allCertificates;
      try {
        allCertificates = await wallet.listCertificates({
          certifiers: [serverPubKey],
          types: [Utils.toBase64(Utils.toArray('Bdid', 'base64')), Utils.toBase64(Utils.toArray('Bvc', 'base64'))]
      });
      } catch (listError) {
        console.warn('[CertDetection] Failed to list certificates:', listError);
        if (listError.message && listError.message.includes('JSON Parse error')) {
          console.log('[CertDetection] Wallet appears empty - treating as no certificates');
          return { hasBdidCert: false, hasBvcCert: false, certificates: [], bdidCertificates: [], bvcCertificates: [] };
        }
        throw listError;
      }

      // Handle different response formats
      let certificateList = allCertificates;
      if (typeof allCertificates === 'string') {
        try {
          certificateList = JSON.parse(allCertificates);
        } catch (parseError) {
          console.warn('[CertDetection] Failed to parse certificate response:', parseError);
          return { hasBdidCert: false, hasBvcCert: false, certificates: [], bdidCertificates: [], bvcCertificates: [] };
        }
      }

      if (!Array.isArray(certificateList)) {
        if (certificateList && certificateList.certificates && Array.isArray(certificateList.certificates)) {
          certificateList = certificateList.certificates;
        } else {
          console.log('[CertDetection] Certificate response is not an array:', typeof certificateList);
          return { hasBdidCert: false, hasBvcCert: false, certificates: [], bdidCertificates: [], bvcCertificates: [] };
        }
      }

      console.log(`[CertDetection] Found ${certificateList.length} total certificates from server`);

      // Define certificate types
      const bdidType = Utils.toBase64(Utils.toArray('Bdid', 'base64'));
      const bvcType = Utils.toBase64(Utils.toArray('Bvc', 'base64'));

      // Filter certificates by type
      const bdidCerts = certificateList.filter(cert => cert.type === bdidType);
      const bvcCerts = certificateList.filter(cert => cert.type === bvcType);

      console.log(`[CertDetection] Found ${bdidCerts.length} Bdid certificates and ${bvcCerts.length} Bvc certificates`);

      const result = {
        hasBdidCert: bdidCerts.length > 0,
        hasBvcCert: bvcCerts.length > 0,
        certificates: certificateList,
        bdidCertificates: bdidCerts,
        bvcCertificates: bvcCerts
      };

      console.log('[CertDetection] Detection complete:', {
        hasBdidCert: result.hasBdidCert,
        hasBvcCert: result.hasBvcCert,
        totalCerts: certificateList.length
      });

      return result;

    } catch (error) {
      console.error('[CertDetection] Error during certificate detection:', error);
      return { hasBdidCert: false, hasBvcCert: false, certificates: [], bdidCertificates: [], bvcCertificates: [], error: error.message };
    }
  }, [userWallet]);

  // Reset page-level tracking function
  const resetPageTracking = useCallback(() => {
    console.log('[Page] Resetting page-level tracking to allow re-check');
    hasCheckedExisting.current = false;
    walletCheckAttempts.current.clear();
    walletErrorCount.current = 0;
  }, []);

  // Automatic DID generation function for new users
  const triggerAutomaticDidGeneration = useCallback(async () => {
    if (autoGeneratingDid || autoGenerationFailed) return; // Prevent duplicate calls

    console.log('[Page] Starting automatic DID generation...');
    setAutoGeneratingDid(true);
    setAutoGenerationFailed(false);

    try {
      // Check if wallet is available
      if (!userWallet) {
        throw new Error('Wallet not connected');
      }

      // Log the user's identity key to help with funding
      const identityKey = await userWallet.getPublicKey({ identityKey: true });
      console.log('[Page] Auto-generation: User wallet identity key (needs funding):', identityKey);

      // Check wallet balance
      try {
        const balance = await userWallet.getBalance();
        console.log('[Page] Auto-generation: User wallet balance:', balance, 'satoshis');
        if (balance < 10) {
          toast.error(`Insufficient funds in wallet. Balance: ${balance} satoshis. Please fund your wallet.`);
          setAutoGenerationFailed(true);
          return;
        }
      } catch (balanceError) {
        console.log('[Page] Auto-generation: Could not check balance:', balanceError);
      }

      // Create user DID automatically
      console.log('[Page] Auto-generation: Creating user DID...');
      await createUserDid();

      // Reset tracking flags to allow re-discovery of the newly created DID
      resetInitializationFlag();
      resetPageTracking();

      // Trigger certificate detection to update UI state
      try {
        console.log('[Page] Auto-generation: Detecting newly created DID certificate...');
        const certStatus = await checkAllCertificates(userWallet);
        if (certStatus.hasBdidCert) {
          console.log('[Page] ✅ Auto-generation: DID certificate detected after creation');
          setExistingDidFound(true);
          setDidCreated(true);
          setHasBdidCert(true);
          
          toast.success('DID created automatically - you can now fill in your information');
        } else {
          console.warn('[Page] Auto-generation: DID created but certificate not detected');
          setAutoGenerationFailed(true);
        }
      } catch (detectionError) {
        console.warn('[Page] Auto-generation: Certificate detection failed after DID creation:', detectionError);
        setAutoGenerationFailed(true);
      }

    } catch (error) {
      console.error('[Page] Auto-generation: Error creating DID:', error);
      setAutoGenerationFailed(true);
      
      // Only show error toast if it's not a funding issue (already shown above)
      if (!error.message.includes('funds')) {
        toast.error(`Automatic DID creation failed: ${error.message}. You can retry manually.`);
      }
    } finally {
      setAutoGeneratingDid(false);
    }
  }, [userWallet, autoGeneratingDid, autoGenerationFailed, createUserDid, resetInitializationFlag, resetPageTracking, checkAllCertificates]);

  // Simplified certificate detection using comprehensive function
  const checkExistingCertificate = useCallback(async (publicKey) => {
    if (!publicKey || checkingDid) return;
    
    // Check if we've already attempted check for this pubkey
    const attemptKey = publicKey;
    const previousAttempts = walletCheckAttempts.current.get(attemptKey) || 0;
    const maxAttempts = 3;
    
    if (previousAttempts >= maxAttempts) {
      console.log(`[Page] ⚠️ Skipping wallet check - already attempted ${previousAttempts} times for ${attemptKey}`);
      setExistingDidFound(false);
      setDidCreated(false);
      return;
    }
    
    // Circuit breaker: skip if we've had too many wallet errors
    if (walletErrorCount.current >= maxWalletErrors) {
      console.log('[Page] ⚠️ Skipping wallet check - too many previous errors');
      setExistingDidFound(false);
      setDidCreated(false);
      return;
    }
    
    console.log(`[Page] Checking for existing certificates (attempt ${previousAttempts + 1}/${maxAttempts})...`);
    walletCheckAttempts.current.set(attemptKey, previousAttempts + 1);
    
    setCheckingDid(true);
    try {
      console.log('[Page] Starting comprehensive certificate check for user:', publicKey);
      
      // Check if user already has a certificate loaded in context
      if (certificate) {
        console.log('[Page] User already has certificate loaded in context');
        setExistingDidFound(true);
        setDidCreated(true);
        // Reset error counts on success
        walletErrorCount.current = 0;
        walletCheckAttempts.current.delete(attemptKey);
        return;
      }
      
      // Check if DID is already loaded in DidContext
      if (userDid) {
        console.log('[Page] User already has DID loaded in context:', userDid);
        setExistingDidFound(true);
        setDidCreated(true);
        // Reset error counts on success
        walletErrorCount.current = 0;
        walletCheckAttempts.current.delete(attemptKey);
        return;
      }
      
      // Use comprehensive certificate detection
      const certStatus = await checkAllCertificates(userWallet);
      
      if (certStatus.error) {
        console.warn('[Page] Error during certificate detection:', certStatus.error);
        if (certStatus.error.includes('JSON Parse error')) {
          console.log('[Page] Wallet appears empty - not counting as error');
        } else {
          walletErrorCount.current++;
          console.log(`[Page] Network error count: ${walletErrorCount.current}/${maxWalletErrors}`);
        }
      }
      
      console.log('[Page] Certificate status:', {
        hasBdidCert: certStatus.hasBdidCert,
        hasBvcCert: certStatus.hasBvcCert,
        totalCerts: certStatus.certificates?.length || 0
      });
      
      // Update state based on certificate detection
      if (certStatus.hasBdidCert || certStatus.hasBvcCert) {
        console.log('[Page] ✅ Found existing certificates - DID:', certStatus.hasBdidCert, 'Identity:', certStatus.hasBvcCert);
        setExistingDidFound(true);
        setDidCreated(certStatus.hasBdidCert); // Only set didCreated if we have a DID cert
        setHasBdidCert(certStatus.hasBdidCert); // Set new state for conditional UI
        setHasBvcCert(certStatus.hasBvcCert);   // Set new state for conditional UI
        
        // If we have a Bvc certificate, set it in the context for immediate login
        if (certStatus.hasBvcCert && certStatus.bvcCertificates?.length > 0) {
          const firstBvcCert = certStatus.bvcCertificates[0];
          console.log('[Page] Setting first Bvc certificate in context for login:', firstBvcCert.serialNumber?.substring(0, 8) + '...');
          setCertificate(firstBvcCert);
        }
        
        // Reset error counts on success
        walletErrorCount.current = 0;
        walletCheckAttempts.current.delete(attemptKey);
      } else {
        console.log('[Page] No existing certificates found - triggering automatic DID generation');
        setExistingDidFound(false);
        setDidCreated(false);
        setHasBdidCert(false);
        setHasBvcCert(false);
        
        // Trigger automatic DID generation for new users
        if (!autoGeneratingDid && !autoGenerationFailed) {
          console.log('[Page] Starting automatic DID generation for new user...');
          triggerAutomaticDidGeneration();
        }
        
        // Reset attempt tracking on completion (success or no results)
        walletCheckAttempts.current.delete(attemptKey);
      }
      
    } catch (error) {
      console.error('[Page] Error checking existing certificates:', error);
    } finally {
      setCheckingDid(false);
    }
  }, [checkingDid, certificate, userDid, userWallet, checkAllCertificates, setCertificate, autoGeneratingDid, autoGenerationFailed, triggerAutomaticDidGeneration]);

  // Check for existing certificate when wallet connects (with loop prevention)
  useEffect(() => {
    // Only check if we have wallet, pubkey, no certificate, and haven't already checked for this combination
    if (userWallet && userPubKey && !certificate && !existingDidFound && !checkingDid && !hasCheckedExisting.current) {
      console.log('[Page] Wallet connected, initializing certificate check for user:', userPubKey);
      hasCheckedExisting.current = true;
      
      // Reset error counters for new check session
      walletErrorCount.current = 0;
      walletCheckAttempts.current.clear();
      
      checkExistingCertificate(userPubKey)
        .then(() => {
          console.log('[Page] ✅ Certificate check completed');
        })
        .catch(error => {
          console.error('[Page] ❌ Certificate check failed:', error);
          // Don't reset hasCheckedExisting on error - prevent retry loops
        });
    }
  }, [userWallet, userPubKey, certificate, existingDidFound, checkingDid, checkExistingCertificate]);
  
  // Reset check flag when wallet/pubkey changes or certificate is found
  useEffect(() => {
    // Reset when important state changes
    if (!userPubKey || certificate || existingDidFound) {
      resetPageTracking();
    }
  }, [userPubKey, certificate, existingDidFound, resetPageTracking]);

  const handleCreateDid = async () => {
    try {
      // Check if wallet is available
      if (!userWallet) {
        toast.error('Wallet not connected. Please refresh the page.');
        return;
      }
      
      // Log the user's identity key to help with funding
      const identityKey = await userWallet.getPublicKey({ identityKey: true });
      console.log('User wallet identity key (needs funding):', identityKey);
      
      // Check wallet balance
      try {
        const balance = await userWallet.getBalance();
        console.log('User wallet balance:', balance, 'satoshis');
        if (balance < 10) {
          toast.error(`Insufficient funds in wallet. Balance: ${balance} satoshis. Please fund your wallet.`);
          return;
        }
      } catch (balanceError) {
        console.log('Could not check balance:', balanceError);
      }
      

      // Step 1: Create user DID first
      console.log('Creating user DID...');
      await createUserDid();
      
      // Reset tracking flags to allow re-discovery of the newly created DID
      resetInitializationFlag();
      resetPageTracking();
      
      // Trigger certificate detection to update UI state
      try {
        console.log('[Page] Triggering certificate detection after DID creation...');
        const certStatus = await checkAllCertificates(userWallet);
        if (certStatus.hasBdidCert) {
          console.log('[Page] ✅ DID certificate detected after creation');
          setExistingDidFound(true);
          setDidCreated(true);
        }
      } catch (detectionError) {
        console.warn('[Page] Certificate detection failed after DID creation:', detectionError);
      }
      
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

      // Check if wallet is available
      if (!userWallet) {
        toast.error('Wallet not connected. Please refresh the page.');
        return;
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

      // Use official BSV SDK acquireCertificate method now that user has modified SDK
      console.log('Using official BSV SDK acquireCertificate for VC certificates...');
      
      const certificateFields = {
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
      };
      
      const serverPublicKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4";
      
      // SIMPLIFIED: Use issuance protocol consistently (matching working DID certificate pattern)
      // This lets the BSV SDK handle the entire certificate acquisition process
      console.log('[VC Cert] Using simplified BSV SDK acquireCertificate with issuance protocol...');
      
      // Get subject public key from wallet
      let subject;
      try {
        console.log('[VC Cert] Getting public key from wallet');
        const { publicKey } = await userWallet.getPublicKey({ identityKey: true });
        subject = publicKey;
      } catch (error) {
        console.warn('[VC Cert] Failed to get public key from wallet, using userPubKey from context:', error);
        subject = userPubKey;
      }
      
      if (!subject) {
        throw new Error('Could not determine subject public key for certificate');
      }
      
      console.log('[VC Cert] Using subject public key:', subject);

      // FIXED: Use main wallet client directly for certificate visibility in MetaNet Desktop
      // The BSV SDK acquireCertificate() automatically handles certificate storage
      console.log('[VC Cert] Using main wallet client for certificate acquisition to ensure MetaNet Desktop visibility...');
      
      // Generate client nonce for server's nonce verification requirement
      console.log('[VC Cert] Generating client nonce for certificate request...');
      let clientNonce;
      try {
        // Create nonce using user wallet for the server public key
        clientNonce = await createNonce(userWallet, serverPublicKey);
        console.log('[VC Cert] Client nonce generated:', clientNonce?.substring(0, 16) + '...');
      } catch (nonceError) {
        console.error('[VC Cert] Failed to generate client nonce:', nonceError);
        throw new Error('Failed to generate client nonce for certificate request');
      }
      
      const certificateResult = await userWallet.acquireCertificate({
        type: Utils.toBase64(Utils.toArray('Bvc', 'base64')),
        certifier: serverPublicKey,
        fields: certificateFields,  // Your clean certificate fields
        certifierUrl: certifierUrl, // Required for issuance protocol
        acquisitionProtocol: "issuance"    // Let certificate server handle everything
      });
      
      console.log('[VC Cert] ✅ VC certificate acquired via BSV SDK issuance protocol:', {
        type: certificateResult.type,
        serialNumber: certificateResult.serialNumber?.substring(0, 16) + '...',
        subject: certificateResult.subject?.substring(0, 16) + '...',
        certifier: certificateResult.certifier?.substring(0, 16) + '...'
      });
      
      // PHASE 2: Certificate storage verification - BSV SDK handles storage automatically
      console.log('[VC Cert] Phase 2: Verifying certificate storage (BSV SDK handles storage automatically)...');
      
      try {
        // Verify certificate was stored by checking the main wallet
        console.log('[VC Cert] Checking if certificate is visible in MetaNet Desktop wallet...');
        const walletCerts = await userWallet.listCertificates({
          certifiers: [process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4"],
          types: [Utils.toBase64(Utils.toArray('Bvc', 'base64'))]
        });

        let certificateList = Array.isArray(walletCerts) ? walletCerts : [];
        
        // Handle different response formats
        if (typeof walletCerts === 'string') {
          try {
            certificateList = JSON.parse(walletCerts);
          } catch (parseError) {
            console.warn('[VC Cert] Failed to parse wallet certificate response:', parseError);
            certificateList = [];
          }
        }
        
        if (!Array.isArray(certificateList) && certificateList?.certificates) {
          certificateList = certificateList.certificates;
        }
        
        // Look for the newly acquired certificate
        const newCertificate = certificateList.find(cert => 
          cert.serialNumber === certificateResult.serialNumber
        );
        
        if (newCertificate) {
          console.log('[VC Cert] ✅ VC certificate visible in MetaNet Desktop wallet:', {
            serialNumber: newCertificate.serialNumber?.substring(0, 16) + '...',
            type: newCertificate.type,
            location: 'MetaNet Desktop'
          });
        } else {
          console.warn('[VC Cert] ⚠️ Certificate not immediately visible in MetaNet Desktop wallet');
          console.log('[VC Cert] This may be normal - certificates can take time to appear in the wallet UI');
          console.log('[VC Cert] Available certificates:', certificateList.length);
          
          // Provide localStorage fallback
          console.log('[VC Cert] Adding certificate to localStorage as backup...');
          const alias = `vc_cert_${certificateResult.serialNumber?.substring(0, 8) || Date.now()}`;
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          stored[alias] = {
            certificate: certificateResult,
            timestamp: Date.now(),
            method: 'localStorage_backup',
            serialNumber: certificateResult.serialNumber
          };
          localStorage.setItem('bsv_certificates', JSON.stringify(stored));
          console.log('[VC Cert] 📁 Certificate backed up to localStorage with alias:', alias);
        }
        
      } catch (verificationError) {
        console.warn('[VC Cert] Certificate storage verification failed (this is often normal):', verificationError.message);
        
        // Always provide localStorage fallback when verification fails
        console.log('[VC Cert] Adding certificate to localStorage as backup...');
        try {
          const alias = `vc_cert_${certificateResult.serialNumber?.substring(0, 8) || Date.now()}`;
          const stored = JSON.parse(localStorage.getItem('bsv_certificates') || '{}');
          stored[alias] = {
            certificate: certificateResult,
            timestamp: Date.now(),
            method: 'localStorage_backup',
            serialNumber: certificateResult.serialNumber
          };
          localStorage.setItem('bsv_certificates', JSON.stringify(stored));
          console.log('[VC Cert] 📁 Certificate backed up to localStorage with alias:', alias);
        } catch (backupError) {
          console.warn('[VC Cert] Failed to backup certificate to localStorage:', backupError);
        }
      }
      
      // Certificate acquired successfully
      const certResponse = certificateResult;
      
      /* COMMENTED OUT: Previous working HTTP-based certificate acquisition (from commit 6ec9264)
      // This bypassed the BSV SDK P2P issues that were causing "Array.from" errors
      console.log('Using working custom HTTP certificate acquisition to bypass P2P issues...');
      
      // Get user's identity key for BSV auth
      const { publicKey: subject } = await wallet.getPublicKey({ identityKey: true });
      console.log('[VC Cert] User identity key:', subject);
      
      // Generate client nonce for replay protection
      const serverPublicKey = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY || "024c144093f5a2a5f71ce61dce874d3f1ada840446cebdd283b6a8ccfe9e83d9e4";
      console.log('[VC Cert] Generating client nonce...');
      const clientNonce = await createNonce(wallet, serverPublicKey);
      console.log('[VC Cert] Client nonce generated:', clientNonce?.substring(0, 16) + '...');
      
      // Make direct HTTP request to certificate server (working pattern)
      console.log('[VC Cert] Making request to:', certifierUrl + '/signCertificate');
      
      const response = await fetch(certifierUrl + '/signCertificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bsv-auth-identity-key': subject  // BSV auth header
        },
        body: JSON.stringify({
          clientNonce: clientNonce,  // Required for replay protection
          type: Utils.toBase64(Utils.toArray('CommonSource user identity', 'utf8')),
          fields: certificateFields,
          acquisitionProtocol: "issuance",  // Required by server
          certifier: serverPublicKey,
          certifierUrl: process.env.NEXT_PUBLIC_CERTIFIER_URL || "http://localhost:8080"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Certificate server responded with ${response.status}: ${response.statusText}`);
      }
      
      // Server returns binary certificate data in BSV SDK format (success byte + certificate binary)
      const responseBuffer = await response.arrayBuffer();
      console.log('[VC Cert] Received response buffer, length:', responseBuffer.byteLength);
      
      // Parse BSV SDK response format: success_byte + certificate_binary
      const responseArray = new Uint8Array(responseBuffer);
      const successByte = responseArray[0];
      
      if (successByte !== 0) {
        throw new Error(`Certificate issuance failed with status code: ${successByte}`);
      }
      
      // Extract the certificate binary data (everything after the success byte)
      const certificateData = responseArray.slice(1);
      console.log('[VC Cert] Extracted certificate binary, length:', certificateData.length);
      
      // Deserialize the certificate using BSV SDK
      const certificate = Certificate.fromBinary(certificateData);
      console.log('[VC Cert] Certificate deserialized successfully:', {
        type: certificate.type,
        serialNumber: certificate.serialNumber?.substring(0, 16) + '...',
        subject: certificate.subject?.substring(0, 16) + '...',
        certifier: certificate.certifier?.substring(0, 16) + '...'
      });
      
      // Store the certificate in the wallet (this was the missing piece!)
      await wallet.storeCertificate(certificate);
      console.log('[VC Cert] Certificate stored in MetaNet Desktop wallet');
      
      const certResponse = certificate;  // Use the real certificate object
      */
      
      // Trigger authentication check to detect the new certificate
      console.log('Triggering authentication check to detect new certificate...');
      
      // Set the real certificate in wallet context to trigger state update
      setCertificate(certResponse);
      
      // Also trigger certificate detection to update state
      try {
        console.log('[Page] Triggering certificate detection after certificate generation...');
        const certStatus = await checkAllCertificates(userWallet);
        console.log('[Page] Certificate detection after generation:', {
          hasBdidCert: certStatus.hasBdidCert,
          hasBvcCert: certStatus.hasBvcCert
        });
      } catch (detectionError) {
        console.warn('[Page] Certificate detection failed after generation:', detectionError);
      }
      
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
        <LoggedInPage 
          certificate={certificate}
          userPubKey={userPubKey}
          setCertificate={setCertificate}
        />
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
              {/* Show loading message during automatic DID generation */}
              {autoGeneratingDid && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-blue-700 font-medium">Creating your DID automatically...</span>
                  </div>
                  <p className="text-blue-600 text-sm mt-1">Please wait while we set up your digital identity.</p>
                </div>
              )}
              
              {/* Only show form fields when user has DID certificate or auto-generation is complete */}
              {(hasBdidCert || didCreated) && (
                <>
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
                </>
              )}
              
              <div className="space-y-3 pt-4">
                {/* Conditional Create DID Button Visibility */}
                {(!hasBdidCert && !autoGeneratingDid && (autoGenerationFailed || checkingDid === false)) && (
                  <Button
                    onClick={handleCreateDid}
                    disabled={didCreated || checkingDid}
                    variant={didCreated ? "secondary" : "default"}
                    className="w-full"
                  >
                    {checkingDid ? 'Checking for existing DID...' : 
                     autoGenerationFailed ? 'Retry DID Creation' :
                     existingDidFound ? 'DID Found ✓' : 
                     didCreated ? 'DID Created ✓' : 'Create DID'}
                  </Button>
                )}
                <Button
                  onClick={handleGenerateCert}
                  disabled={!hasBdidCert && !didCreated}
                  variant={(!hasBdidCert && !didCreated) ? "secondary" : "default"}
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
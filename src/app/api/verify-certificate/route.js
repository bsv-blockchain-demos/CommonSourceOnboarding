import { NextResponse } from "next/server";
import { connectToMongo, usersCollection } from "../../../lib/mongo";
import { BsvDidService } from "../../../lib/bsv/BsvDidService";
import { BsvVcService } from "../../../lib/bsv/BsvVcService";

/**
 * Third-Party Certificate Verification API
 * 
 * Comprehensive verification endpoint for external applications
 * Phase 4: Third-Party API Development
 * 
 * Verification levels:
 * - basic: Certificate existence and structure validation
 * - comprehensive: Full VC verification, DID resolution, revocation checking
 */

const CERTIFIER_PUBLIC_KEY = process.env.NEXT_PUBLIC_SERVER_PUBLIC_KEY;

export async function POST(req) {
    try {
        const body = await req.json();
        const { 
            certificate, 
            userIdentityKey, 
            verificationLevel = 'comprehensive',
            requireCryptographicProof = false 
        } = body;

        console.log('[VerifyAPI] Certificate verification request:', {
            verificationLevel,
            requireCryptographicProof,
            userIdentityKey: userIdentityKey?.substring(0, 8) + '...'
        });

        // Input validation
        if (!certificate) {
            return NextResponse.json({
                valid: false,
                error: 'Certificate is required'
            }, { status: 400 });
        }

        // Initialize verification result
        const verificationResult = {
            valid: false,
            claims: null,
            verificationDetails: {},
            verificationLevel: verificationLevel,
            timestamp: new Date().toISOString()
        };

        try {
            // Step 1: Basic certificate structure validation
            console.log('[VerifyAPI] Step 1: Basic certificate validation...');
            const structureValid = await validateCertificateStructure(certificate);
            verificationResult.verificationDetails.certificateStructure = structureValid;
            
            if (!structureValid.valid) {
                verificationResult.error = structureValid.error;
                return NextResponse.json(verificationResult);
            }

            // Step 2: Verify certificate signature against known certifier
            console.log('[VerifyAPI] Step 2: Certificate signature verification...');
            const signatureValid = await verifyCertificateSignature(certificate, CERTIFIER_PUBLIC_KEY);
            verificationResult.verificationDetails.certificateSignature = signatureValid;
            
            if (!signatureValid.valid) {
                verificationResult.error = signatureValid.error;
                return NextResponse.json(verificationResult);
            }

            // Step 3: Cryptographic proof of ownership (if required)
            if (requireCryptographicProof && userIdentityKey) {
                console.log('[VerifyAPI] Step 3: Cryptographic proof verification...');
                const proofValid = await verifyOwnershipProof(certificate, userIdentityKey);
                verificationResult.verificationDetails.ownershipProof = proofValid;
                
                if (!proofValid.valid) {
                    verificationResult.error = proofValid.error;
                    return NextResponse.json(verificationResult);
                }
            } else {
                verificationResult.verificationDetails.ownershipProof = { 
                    valid: true, 
                    skipped: true, 
                    reason: 'Not required for this verification level' 
                };
            }

            // Step 4: W3C VC verification (if applicable)
            console.log('[VerifyAPI] Step 4: W3C VC verification...');
            const vcVerificationResult = await verifyVCStructure(certificate);
            verificationResult.verificationDetails.vcVerification = vcVerificationResult;
            
            if (vcVerificationResult.isVC && !vcVerificationResult.valid) {
                verificationResult.error = vcVerificationResult.error;
                return NextResponse.json(verificationResult);
            }

            // Step 5: Revocation status checking
            console.log('[VerifyAPI] Step 5: Revocation status check...');
            const revocationStatus = await checkRevocationStatus(certificate);
            verificationResult.verificationDetails.revocationStatus = revocationStatus;
            
            if (revocationStatus.revoked) {
                verificationResult.valid = false;
                verificationResult.error = 'Certificate has been revoked';
                return NextResponse.json(verificationResult);
            }

            // Step 6: DID resolution and key binding (for VC certificates)
            if (vcVerificationResult.isVC && verificationLevel === 'comprehensive') {
                console.log('[VerifyAPI] Step 6: DID resolution and key binding...');
                const didVerification = await verifyDIDAndKeyBinding(certificate, userIdentityKey);
                verificationResult.verificationDetails.didVerification = didVerification;
                
                if (!didVerification.valid) {
                    // DID verification failure is a warning, not a hard failure for now
                    verificationResult.warnings = verificationResult.warnings || [];
                    verificationResult.warnings.push(`DID verification issue: ${didVerification.error}`);
                }
            }

            // Success: All verifications passed
            verificationResult.valid = true;
            verificationResult.claims = extractClaims(certificate);
            
            console.log('[VerifyAPI] Verification completed successfully');
            return NextResponse.json(verificationResult);

        } catch (verificationError) {
            console.error('[VerifyAPI] Verification process error:', verificationError);
            verificationResult.error = `Verification failed: ${verificationError.message}`;
            return NextResponse.json(verificationResult, { status: 500 });
        }

    } catch (error) {
        console.error('[VerifyAPI] API error:', error);
        return NextResponse.json({
            valid: false,
            error: 'Internal server error during verification',
            details: error.message
        }, { status: 500 });
    }
}

/**
 * Validate basic certificate structure
 */
async function validateCertificateStructure(certificate) {
    try {
        const requiredFields = ['type', 'serialNumber', 'subject', 'certifier', 'signature'];
        
        for (const field of requiredFields) {
            if (!certificate[field]) {
                return { valid: false, error: `Certificate missing required field: ${field}` };
            }
        }

        return { valid: true };

    } catch (error) {
        return { valid: false, error: `Structure validation error: ${error.message}` };
    }
}

/**
 * Verify certificate signature against known certifier
 */
async function verifyCertificateSignature(certificate, certifierPublicKey) {
    try {
        // Verify certifier matches our server
        if (certificate.certifier !== certifierPublicKey) {
            return { 
                valid: false, 
                error: 'Certificate not issued by recognized certifier' 
            };
        }

        // TODO: Implement actual signature verification using BSV SDK
        // For now, we'll do basic validation
        if (!certificate.signature) {
            return { valid: false, error: 'Certificate signature missing' };
        }

        return { valid: true, verifiedBy: certifierPublicKey };

    } catch (error) {
        return { valid: false, error: `Signature verification failed: ${error.message}` };
    }
}

/**
 * Verify cryptographic proof of ownership
 */
async function verifyOwnershipProof(certificate, userIdentityKey) {
    try {
        // Verify the certificate subject matches the claimed identity key
        if (certificate.subject !== userIdentityKey) {
            return { 
                valid: false, 
                error: 'Certificate subject does not match provided identity key' 
            };
        }

        // TODO: Implement actual cryptographic challenge-response verification
        // This would require integration with BSV SDK for nonce verification
        
        return { 
            valid: true, 
            note: 'Basic ownership verification passed - full cryptographic proof requires challenge-response' 
        };

    } catch (error) {
        return { valid: false, error: `Ownership proof failed: ${error.message}` };
    }
}

/**
 * Verify W3C VC structure if applicable
 */
async function verifyVCStructure(certificate) {
    try {
        const fields = certificate.fields || certificate;
        
        // Check if this is a VC certificate
        const isVC = fields && 
                    fields['@context'] && 
                    fields.type && 
                    Array.isArray(fields.type) &&
                    fields.type.includes('VerifiableCredential');

        if (!isVC) {
            return { valid: true, isVC: false, format: 'legacy' };
        }

        // Initialize VC service for verification
        const didService = new BsvDidService(null);
        const vcService = new BsvVcService(didService);
        
        const verificationResult = vcService.verifyCertificateVC(certificate);
        
        return {
            valid: verificationResult.valid,
            isVC: true,
            format: 'vc',
            error: verificationResult.error,
            claims: verificationResult.claims
        };

    } catch (error) {
        return { 
            valid: false, 
            isVC: true, 
            error: `VC verification failed: ${error.message}` 
        };
    }
}

/**
 * Check revocation status
 */
async function checkRevocationStatus(certificate) {
    try {
        if (!certificate.revocationOutpoint) {
            return { 
                valid: true, 
                revoked: false, 
                note: 'No revocation outpoint available' 
            };
        }

        // TODO: Implement actual overlay network revocation checking
        // This would query the BSV blockchain for revocation transaction status
        
        await connectToMongo();
        
        // For now, check if certificate exists in database (simple revocation check)
        const dbCertificate = await usersCollection.findOne({ 
            "signedCertificate.serialNumber": certificate.serialNumber 
        });

        if (!dbCertificate) {
            return { 
                valid: false, 
                revoked: true, 
                reason: 'Certificate not found in active database' 
            };
        }

        return { 
            valid: true, 
            revoked: false, 
            note: 'Certificate found in active database - full revocation checking requires overlay network integration' 
        };

    } catch (error) {
        return { 
            valid: false, 
            error: `Revocation check failed: ${error.message}` 
        };
    }
}

/**
 * Verify DID and key binding for VC certificates
 */
async function verifyDIDAndKeyBinding(certificate, userIdentityKey) {
    try {
        const vcData = certificate.fields;
        if (!vcData.credentialSubject?.id) {
            return { 
                valid: false, 
                error: 'No DID found in credential subject' 
            };
        }

        const subjectDid = vcData.credentialSubject.id;
        
        // Initialize DID service
        const didService = new BsvDidService(null);
        
        // Attempt to resolve DID
        const didDocument = await didService.resolveDID(subjectDid);
        
        if (!didDocument) {
            return { 
                valid: false, 
                error: 'Could not resolve DID to DID document' 
            };
        }

        // Validate DID document
        const didValidation = didService.validateDIDDocument(didDocument);
        if (!didValidation.valid) {
            return { 
                valid: false, 
                error: `DID document invalid: ${didValidation.error}` 
            };
        }

        // TODO: Verify key binding between DID document and user identity key
        // This would ensure the DID document contains the public key corresponding to userIdentityKey

        return { 
            valid: true, 
            didResolved: true, 
            did: subjectDid,
            note: 'DID resolved and validated - key binding verification requires additional implementation' 
        };

    } catch (error) {
        return { 
            valid: false, 
            error: `DID verification failed: ${error.message}` 
        };
    }
}

/**
 * Extract identity claims from certificate
 */
function extractClaims(certificate) {
    try {
        const fields = certificate.fields || certificate;
        
        // Check if VC format
        if (fields['@context'] && fields.credentialSubject) {
            return {
                format: 'vc',
                did: fields.credentialSubject.id,
                username: fields.credentialSubject.username,
                email: fields.credentialSubject.email,
                residence: fields.credentialSubject.residence,
                age: fields.credentialSubject.age,
                gender: fields.credentialSubject.gender,
                work: fields.credentialSubject.work,
                issuer: fields.issuer,
                issuanceDate: fields.issuanceDate,
                expirationDate: fields.expirationDate
            };
        } else {
            // Legacy format
            return {
                format: 'legacy',
                username: fields.username,
                email: fields.email,
                residence: fields.residence,
                age: fields.age,
                gender: fields.gender,
                work: fields.work
            };
        }

    } catch (error) {
        console.error('[VerifyAPI] Error extracting claims:', error);
        return null;
    }
}
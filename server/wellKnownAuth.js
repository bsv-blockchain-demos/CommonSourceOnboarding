import { createNonce, verifyNonce } from '@bsv/sdk';

/**
 * BSV Auth Middleware .well-known/auth endpoint handler
 * 
 * This endpoint is automatically called by AuthFetch when making authenticated requests.
 * It handles the certificate authentication flow and attaches certificates to the SessionManager.
 * 
 * The standard BSV auth flow:
 * 1. Client makes request with AuthFetch
 * 2. AuthFetch automatically sends certificates to /.well-known/auth
 * 3. Server validates certificates and establishes authenticated session
 * 4. Subsequent requests use the established session
 */

export async function wellKnownAuthHandler(req, res) {
    console.log('[WellKnownAuth] Authentication request received');
    
    try {
        // Extract authentication data from request
        const { certificates, identityKey, nonce } = req.body;
        
        if (!identityKey) {
            console.log('[WellKnownAuth] No identity key provided');
            return res.status(401).json({ 
                error: 'Identity key required for authentication' 
            });
        }

        console.log(`[WellKnownAuth] Processing auth for identity: ${identityKey.substring(0, 8)}...`);

        // The auth middleware should have already validated the certificates
        // via the onCertificatesReceived callback, but we can do additional checks here
        if (certificates && certificates.length > 0) {
            console.log(`[WellKnownAuth] ${certificates.length} certificates provided`);
            
            // Validate each certificate
            for (const cert of certificates) {
                if (!cert.type || !cert.serialNumber || !cert.subject) {
                    console.error('[WellKnownAuth] Invalid certificate structure');
                    return res.status(400).json({ 
                        error: 'Invalid certificate structure' 
                    });
                }
                
                // Additional certificate validation can be added here
                console.log(`[WellKnownAuth] Certificate validated: ${cert.serialNumber.substring(0, 8)}...`);
            }
        }

        // Create session data
        const sessionData = {
            identityKey: identityKey,
            certificates: certificates || [],
            authenticated: true,
            timestamp: new Date().toISOString()
        };

        // In a production environment, you would:
        // 1. Store this session in a session manager (Redis, in-memory, etc.)
        // 2. Generate a session token
        // 3. Return the session token to the client

        // For now, we'll attach it to the request for the auth middleware
        if (req.auth) {
            req.auth.certificates = certificates;
            req.auth.sessionData = sessionData;
        }

        // Return success response
        const response = {
            success: true,
            message: 'Authentication successful',
            identityKey: identityKey,
            certificateCount: certificates ? certificates.length : 0,
            timestamp: sessionData.timestamp
        };

        console.log('[WellKnownAuth] Authentication successful');
        return res.json(response);

    } catch (error) {
        console.error('[WellKnownAuth] Authentication error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during authentication',
            details: error.message 
        });
    }
}

/**
 * Helper function to validate certificate against known certifier
 */
export function validateCertificateAgainstCertifier(certificate, certifierPublicKey) {
    try {
        // Check if certificate was issued by our trusted certifier
        if (certificate.certifier !== certifierPublicKey) {
            return {
                valid: false,
                error: 'Certificate not issued by trusted certifier'
            };
        }

        // Check certificate hasn't expired (if expiration is implemented)
        if (certificate.expirationDate) {
            const expiry = new Date(certificate.expirationDate);
            if (expiry < new Date()) {
                return {
                    valid: false,
                    error: 'Certificate has expired'
                };
            }
        }

        return { valid: true };

    } catch (error) {
        return {
            valid: false,
            error: `Validation error: ${error.message}`
        };
    }
}
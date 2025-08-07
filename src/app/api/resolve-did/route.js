import { connectToMongo, usersCollection } from "../../../lib/mongo"
import { NextResponse } from "next/server";

/**
 * DID Resolution API Endpoint
 * 
 * Resolves DIDs to their corresponding DID documents from the database
 * Part of Phase 3: W3C DID/VC Integration
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { did } = body;

        console.log('[ResolveDID] DID resolution request:', did);

        if (!did) {
            console.log('[ResolveDID] No DID provided');
            return NextResponse.json({ 
                error: 'DID is required' 
            }, { status: 400 });
        }

        // Validate DID format
        if (!did.startsWith('did:bsv:')) {
            console.log('[ResolveDID] Invalid DID format:', did);
            return NextResponse.json({ 
                error: 'Invalid DID format - must start with did:bsv:' 
            }, { status: 400 });
        }

        // Connect to database
        await connectToMongo();

        // Look up DID document in user certificates
        // DIDs are stored as part of certificate data when VC certificates are created
        const certificate = await usersCollection.findOne({ 
            did: did 
        });

        if (!certificate) {
            console.log('[ResolveDID] DID not found in database:', did);
            return NextResponse.json({ 
                didDocument: null,
                message: 'DID not found'
            });
        }

        // Check if we have a stored DID document
        if (certificate.didDocument) {
            console.log('[ResolveDID] DID document found:', did);
            return NextResponse.json({ 
                didDocument: certificate.didDocument,
                found: true
            });
        }

        // If no explicit DID document, try to construct one from certificate data
        if (certificate.vcData && certificate.vcData.credentialSubject) {
            console.log('[ResolveDID] Constructing DID document from VC data');
            
            // Extract the user's public key from the certificate subject
            const userPublicKey = certificate.signedCertificate?.subject;
            
            if (userPublicKey) {
                // Construct a basic DID document
                const constructedDidDocument = {
                    '@context': ['https://www.w3.org/ns/did/v1'],
                    id: did,
                    verificationMethod: [{
                        id: `${did}#key-1`,
                        type: 'JsonWebKey2020',
                        controller: did,
                        publicKeyJwk: {
                            kty: 'EC',
                            crv: 'secp256k1',
                            x: userPublicKey.substring(2, 66),
                            y: userPublicKey.substring(66),
                            use: 'sig'
                        }
                    }],
                    authentication: [`${did}#key-1`],
                    assertionMethod: [`${did}#key-1`]
                };

                console.log('[ResolveDID] DID document constructed from certificate data');
                return NextResponse.json({ 
                    didDocument: constructedDidDocument,
                    found: true,
                    constructed: true
                });
            }
        }

        console.log('[ResolveDID] DID found but no resolvable document data');
        return NextResponse.json({ 
            didDocument: null,
            message: 'DID found but document not resolvable'
        });

    } catch (error) {
        console.error('[ResolveDID] Error during DID resolution:', error);
        return NextResponse.json({
            error: 'Internal server error during DID resolution',
            details: error.message
        }, { status: 500 });
    }
}
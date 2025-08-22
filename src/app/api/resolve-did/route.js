import { NextResponse } from "next/server";

/**
 * DID Resolution API Endpoint (Deprecated)
 * 
 * DIDs are now resolved directly from wallet certificates
 * This endpoint is kept for backward compatibility but returns a deprecation notice
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { did } = body;

        console.log('[ResolveDID] DID resolution request (deprecated):', did);

        if (!did) {
            return NextResponse.json({ 
                error: 'DID is required' 
            }, { status: 400 });
        }

        // Return deprecation notice
        // DID resolution is now handled by wallet certificates in DidContext
        console.log('[ResolveDID] This endpoint is deprecated - DIDs are now resolved from wallet certificates');
        
        return NextResponse.json({ 
            didDocument: null,
            message: 'DID resolution has moved to wallet certificates. This endpoint is deprecated.',
            deprecated: true
        });

    } catch (error) {
        console.error('[ResolveDID] Error:', error);
        return NextResponse.json({
            error: 'This endpoint is deprecated',
            message: 'DID resolution now handled by wallet certificates',
            deprecated: true
        }, { status: 410 }); // 410 Gone - indicates the resource is no longer available
    }
}
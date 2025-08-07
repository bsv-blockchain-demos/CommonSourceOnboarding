import { connectToMongo, usersCollection } from "../../lib/mongo"
import { NextResponse } from "next/server";

/**
 * Legacy login route - maintained for backward compatibility with unified auth service
 * TODO: This route may be removed in future versions as authentication
 * is now handled by the UnifiedAuthService
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { subject } = body;

        console.log('[LoginRoute] Certificate lookup request for subject:', subject?.substring(0, 8) + '...');

        if (!subject) {
            console.log('[LoginRoute] No subject provided');
            return NextResponse.json({ certificate: null });
        }
        
        // Get user certificate from database
        await connectToMongo();
        const dbCertificate = await usersCollection.findOne({ _id: subject });

        if (!dbCertificate) {
            console.log('[LoginRoute] No certificate found in database for subject');
            return NextResponse.json({ certificate: null });
        }

        console.log('[LoginRoute] Certificate found in database');
        return NextResponse.json({ certificate: dbCertificate.signedCertificate });
        
    } catch (error) {
        console.error('[LoginRoute] Error during certificate lookup:', error);
        return NextResponse.json(
            { error: 'Internal server error during certificate lookup' }, 
            { status: 500 }
        );
    }
}
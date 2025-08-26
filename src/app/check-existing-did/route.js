import { NextResponse } from "next/server";
import { connectToMongo, usersCollection } from "../../lib/mongo";

export async function POST(req) {
    try {
        const body = await req.json();
        const { publicKey } = body;

        console.log('[CheckDID] Request received for publicKey:', publicKey?.substring(0, 8) + '...');

        if (!publicKey) {
            console.log('[CheckDID] No public key provided');
            return NextResponse.json({ error: 'Public key is required' }, { status: 400 });
        }
        
        // Check if user has existing record with DID
        console.log('[CheckDID] Querying for existing record...');
        const existingRecord = await usersCollection.findOne({ _id: publicKey });
        console.log('[CheckDID] Query result:', existingRecord ? 'found record' : 'no record found');
        
        const hasExistingDid = existingRecord && existingRecord.did;
        console.log('[CheckDID] Has existing DID:', !!hasExistingDid);
        
        return NextResponse.json({ 
            hasExistingDid: !!hasExistingDid,
            did: hasExistingDid ? existingRecord.did : null
        }, { status: 200 });
        
    } catch (error) {
        console.error('[CheckDID] Error checking existing DID:', error);
        console.error('[CheckDID] Error stack:', error.stack);
        return NextResponse.json({ 
            error: 'Failed to check existing DID',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
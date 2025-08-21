import { NextResponse } from "next/server";
import { connectToMongo, usersCollection } from "../../lib/mongo";

export async function POST(req) {
    try {
        const body = await req.json();
        const { publicKey } = body;

        if (!publicKey) {
            return NextResponse.json({ error: 'Public key is required' }, { status: 400 });
        }

        await connectToMongo();
        
        // Check if user has existing record with DID
        const existingRecord = await usersCollection.findOne({ _id: publicKey });
        
        const hasExistingDid = existingRecord && existingRecord.did;
        
        return NextResponse.json({ 
            hasExistingDid: !!hasExistingDid,
            did: hasExistingDid ? existingRecord.did : null
        }, { status: 200 });
        
    } catch (error) {
        console.error('Error checking existing DID:', error);
        return NextResponse.json({ error: 'Failed to check existing DID' }, { status: 500 });
    }
}
import { NextResponse } from "next/server";
import { connectToMongo, usersCollection } from "../../lib/mongo";

export async function POST(request) {
    const body = await request.json();
    const { certificate, subject } = body;

    await connectToMongo();

    // Check for existing certificate
    const existingCertificate = await usersCollection.findOne({ _id: subject });
    if (existingCertificate) {
        return NextResponse.json({ message: 'User already has a certificate' }, { status: 400 });
    }
    
    // Save certificate to DB if user doesn't have one
    const dbCertificate = await usersCollection.updateOne({ _id: subject }, 
        { $set: { signedCertificate: certificate } }, 
        { upsert: true });

    if (!dbCertificate) {
        return NextResponse.json({ message: 'Failed to save certificate' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Certificate saved successfully' }, { status: 200 });
}
import { connectToMongo, usersCollection } from "../../lib/mongo"
import { NextResponse } from "next/server";

export async function POST(req) {
    const body = await req.json();
    const { subject } = body;

    if (!subject) {
        return NextResponse.json({ certificate: null });
    }
    
    await connectToMongo();
    const dbCertificate = await usersCollection.findOne({ _id: subject });

    if (!dbCertificate) {
        return NextResponse.json({ certificate: null });
    }

    return NextResponse.json({ certificate: dbCertificate.signedCertificate });
}
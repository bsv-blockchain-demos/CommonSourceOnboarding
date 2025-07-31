import { connectToMongo, verifyCollection } from "../../lib/mongo";
import { NextResponse } from "next/server";

async function POST(req) {
    const body = await req.json();
    const { email, code, type } = body;

    try {
        // Save code in database
        await connectToMongo();

        if (type === 'sendEmail') {
            await verifyCollection.updateOne({ email },
                {
                    $set: {
                        code: code,
                        expirationTime: Date.now() + 60000,
                    }
                },
                { upsert: true }
            );

            return NextResponse.json({ status: 200 });
        }

        if (type === 'verifyCode') {
            const dbCode = await verifyCollection.findOne({ email });
            if (!dbCode) {
                return NextResponse.json({ verificationStatus: false }, { status: 400 });
            }

            if (Date.now() > dbCode.expirationTime) {
                return NextResponse.json({ verificationStatus: false }, { status: 400 });
            }

            if (code !== dbCode.code) {
                return NextResponse.json({ verificationStatus: false }, { status: 400 });
            }

            return NextResponse.json({ verificationStatus: true }, { status: 200 });
        }
    } catch (error) {
        console.log(error);
        return NextResponse.json({ verificationStatus: false }, { status: 400 });
    }
}
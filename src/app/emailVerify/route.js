import { connectToMongo, verifyCollection } from "../../lib/mongo";
import { NextResponse } from "next/server";
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from "@getbrevo/brevo";

// Set Brevo API
const brevoAPIKey = process.env.BREVO_API_KEY?.trim() || '';
let mailer = new TransactionalEmailsApi();
if (brevoAPIKey) {
  mailer.setApiKey(TransactionalEmailsApiApiKeys.apiKey, brevoAPIKey);
}

const emailSender = process.env.SENDER_EMAIL?.trim() || 'noreply@example.com';

export async function POST(req) {
    const body = await req.json();
    const { email, code, type } = body;

    try {
        // Save code in database
        await connectToMongo();

        if (type === 'sendEmail') {
            const dbresponse = await verifyCollection.updateOne({ email },
                {
                    $set: {
                        code: code,
                        expirationTime: Date.now() + 600000,
                    }
                },
                { upsert: true }
            );

            if (!dbresponse.acknowledged) {
                return NextResponse.json({ sentStatus: false }, { status: 400 });
            }

            // Construct email
            const message = {
                sender: { name: "CommonSource", email: emailSender },
                to: [{ email, name: "User" }],
                subject: "Your verification code",
                htmlContent: `<html><body><h1>Verification code: ${code}</h1></body></html>`
            };

            const res = await mailer.sendTransacEmail(message);
            const messageId = res?.body?.messageId;

            if (typeof messageId === 'string' && messageId.trim().length > 0) {
                return NextResponse.json({ sentStatus: true, messageId }, { status: 200 });
            }

            return NextResponse.json({ sentStatus: false }, { status: 400 });
        }

        if (type === 'verifyCode') {
            const dbCode = await verifyCollection.findOne({ email });
            if (!dbCode) {
                return NextResponse.json({ verificationStatus: false, message: "Code not found" }, { status: 400 });
            }

            if (Date.now() > dbCode.expirationTime) {
                return NextResponse.json({ verificationStatus: false, message: "Code expired" }, { status: 400 });
            }

            if (Number(code) !== Number(dbCode.code)) {
                return NextResponse.json({ verificationStatus: false, message: "Code mismatch" }, { status: 400 });
            }

            return NextResponse.json({ verificationStatus: true }, { status: 200 });
        }

        if (type === 'delete-on-generated') {
            await verifyCollection.deleteOne({ email });
            return NextResponse.json({ deletedStatus: true }, { status: 200 });
        }

        // For production change to this to always check if the user is verified
        if (type === 'check-verified') {
            const user = await verifyCollection.findOne({ email });

            if (!user) {
                return NextResponse.json({ verificationStatus: false, message: "User not found" }, { status: 400 });
            }

            if (!user.verified) {
                return NextResponse.json({ verificationStatus: false, message: "Not verified" }, { status: 400 });
            }

            if (Date.now() > user.verifiedExpirationTime) {
                await verifyCollection.updateOne({ email }, { $set: { verified: false, verifiedExpirationTime: null } });
                return NextResponse.json({ verificationStatus: false, message: "Verification expired" }, { status: 400 });
            }

            return NextResponse.json({ verificationStatus: true }, { status: 200 });
        }

        if (type === 'verified') {
            await verifyCollection.updateOne({ email }, { $set: { verified: true, verifiedExpirationTime: Date.now() + 604800000 } }); // 7 days
            return NextResponse.json({ verifiedStatus: true }, { status: 200 });
        }
    } catch (error) {
        console.log(JSON.stringify(error));
        return NextResponse.json({ verificationStatus: false, message: "Something went wrong" }, { status: 400 });
    }
}
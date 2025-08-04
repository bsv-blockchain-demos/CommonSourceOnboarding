import { connectToMongo, verifyCollection } from "../../lib/mongo";
import { NextResponse } from "next/server";
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";

// Set Brevo API
const brevoAPIKey = process.env.BREVO_API_KEY;
let mailer = new TransactionalEmailsApi();
console.log(brevoAPIKey);

const emailSender = process.env.SENDER_EMAIL;

mailer.authentications.apiKey.apiKey = brevoAPIKey;

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
                        expirationTime: Date.now() + 60000,
                    }
                },
                { upsert: true }
            );

            if (!dbresponse.acknowledged) {
                return NextResponse.json({ status: 400 });
            }

            // Construct email
            let sendSmtpEmail = new SendSmtpEmail();
            sendSmtpEmail.subject = "Code verification";
            sendSmtpEmail.htmlContent = `<html><body><h1>Verification code: ${code}</h1></body></html>`;
            sendSmtpEmail.sender = { "name": "CommonSource", "email": emailSender };
            sendSmtpEmail.to = [
                { "email": email, "name": "User" }
            ];
            sendSmtpEmail.replyTo = { "email": email, "name": "User" };
            sendSmtpEmail.headers = { "Code-Verification": code };
            sendSmtpEmail.params = { "parameter": code };


            const res = await mailer.sendTransacEmail(sendSmtpEmail);
            if (!res.ok) {
                return NextResponse.json({ status: 400 });
            }

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

        if (type === 'delete-on-verified') {
            await verifyCollection.deleteOne({ email });
            return NextResponse.json({ status: 200 });
        }
    } catch (error) {
        console.log(error);
        return NextResponse.json({ verificationStatus: false }, { status: 400 });
    }
}
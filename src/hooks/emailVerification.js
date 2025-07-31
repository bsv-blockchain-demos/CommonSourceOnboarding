import brevo from "@getbrevo/brevo"
import dotenv from 'dotenv'
import { connectToMongo } from '../lib/mongo'
dotenv.config();

// Set Brevo API
const brevoAPIKey = process.env.API_KEY;
const defaultClient = brevoAPIKey.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = brevoAPIKey;

const mailer = new brevoAPIKey.TransactionalEmailsApi();
let sendSmtpEmail = new brevoAPIKey.SendSmtpEmail();

async function sendEmailFunc(req, res) {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000);

    // Save code in database
    await connectToMongo();
    
    await verifyCollection.updateOne({ email }, 
        { $set: { 
            code: code,
            expirationTime: Date.now() + 60000,
        } },
        { upsert: true }
    );

    // Construct email
    try {
        sendSmtpEmail.subject = "Code verification";
        sendSmtpEmail.htmlContent = `<html><body><h1>Verification code: ${code}</h1></body></html>`;
        sendSmtpEmail.sender = { "name": "CommonSource", "email": "example@example.com" };
        sendSmtpEmail.to = [
            { "email": email, "name": "User" }
        ];
        sendSmtpEmail.replyTo = { "email": email, "name": "User" };
        sendSmtpEmail.headers = { "Code-Verification": code };
        sendSmtpEmail.params = { "parameter": code };


        res = await mailer.sendTransacEmail(sendSmtpEmail);
        return res.json();
    } catch (error) {
        console.log(error);
    }
}

async function verifyCode(req, res) {
    const { email, code } = req.body;
    
    // Verify code that's saved under email
    // db EX: {userEmail: email, code: code, expirationTime: Date}

    await connectToMongo();
    const dbCode = await verifyCollection.findOne({ email });
    if (!dbCode) {
        return res.json({ verificationStatus: false });
    }
    
    if (Date.now() > dbCode.expirationTime) {
        return res.json({ verificationStatus: false });
    }

    if (code !== dbCode.code) {
        return res.json({ verificationStatus: false });
    }

    return res.json({ verificationStatus: true });
}

export { sendEmailFunc, verifyCode };
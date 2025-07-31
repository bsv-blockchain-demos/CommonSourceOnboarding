import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo"

// Set Brevo API
const brevoAPIKey = process.env.NEXT_PUBLIC_BREVAPI_KEY;
let mailer = new TransactionalEmailsApi();

mailer.authentications.apiKey.apiKey = brevoAPIKey;

async function sendEmailFunc(email) {
    const code = Math.floor(100000 + Math.random() * 900000);

    // Save code in database
    const dbresponse = await fetch('/api/emailVerify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, type: 'sendEmail' }),
    });

    const dbresponseJson = await dbresponse.json();
    if (dbresponseJson.status !== 200) {
        return { sentStatus: false };
    }

    // Construct email
    try {
        let sendSmtpEmail = new SendSmtpEmail();
        sendSmtpEmail.subject = "Code verification";
        sendSmtpEmail.htmlContent = `<html><body><h1>Verification code: ${code}</h1></body></html>`;
        sendSmtpEmail.sender = { "name": "CommonSource", "email": "example@example.com" };
        sendSmtpEmail.to = [
            { "email": email, "name": "User" }
        ];
        sendSmtpEmail.replyTo = { "email": email, "name": "User" };
        sendSmtpEmail.headers = { "Code-Verification": code };
        sendSmtpEmail.params = { "parameter": code };


        const res = await mailer.sendTransacEmail(sendSmtpEmail);
        return res.json();
    } catch (error) {
        console.log(error);
    }
}

async function verifyCode(email, code) {
    // Verify code that's saved under email
    // db EX: {userEmail: email, code: code, expirationTime: Date}

    const res = await fetch('/api/emailVerify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, type: 'verifyCode' }),
    });

    const resJson = await res.json();
    return resJson;
}

export { sendEmailFunc, verifyCode };
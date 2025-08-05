async function sendEmailFunc(email) {
    const code = Math.floor(100000 + Math.random() * 900000);
    try {
    // Save code in database
    const response = await fetch('/emailVerify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, type: 'sendEmail' }),
    });

    const responseJson = await response.json();
    if (responseJson.sentStatus === false) {
        return { sentStatus: false };
    }
    
    return { sentStatus: true };
    } catch (error) {
        console.log(error); 
        return { sentStatus: false };
    }
}

async function verifyCode(email, code) {
    // Verify code that's saved under email
    // db EX: {userEmail: email, code: code, expirationTime: Date}

    const res = await fetch('/emailVerify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, type: 'verifyCode' }),
    });

    const resJson = await res.json();
    if (resJson.verificationStatus === false) {
        return { verificationStatus: false, message: resJson.message };
    }
    
    return { verificationStatus: true, message: "Code verified" };
}

export { sendEmailFunc, verifyCode };
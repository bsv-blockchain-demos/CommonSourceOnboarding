// import twilio from 'twilio'
// import dotenv from 'dotenv'
// dotenv.config();

// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const serviceSid = process.env.TWILIO_SERVICE_SID;

// const client = twilio(accountSid, authToken);

// async function sendEmailFunc(req, res) {
//     try {
//         const email = req.body.email
//         client.verify.v2.services(serviceSid)
//             .verifications
//             .create({ to: email, channel: 'email' })
//         return res.status(200).json({
//             emailSentStatus: true,
//             sentEmail: email
//         })
//     } catch (e) {
//         console.error(e)
//         res.status(500).json({
//             textSentStatus: false,
//             code: 'ERR_INTERNAL'
//         })
//     }
// }

// async function verifyCode(req, res) {
//     client.verify.v2.services(serviceSid)
//         .verificationChecks
//         .create({ to: req.body.verifyEmail, code: req.body.verificationCode })
//         .then((verificationCheck) => {
//             if (verificationCheck.status === 'approved') {
//                 return res.status(200).json({
//                     verificationStatus: true,
//                 })
//             } else {
//                 return res.status(200).json({
//                     verificationStatus: false
//                 })
//             }
//         })
// }

// export { sendEmailFunc, verifyCode };
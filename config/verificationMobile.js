const Nexmo = require('nexmo');
const nexmo = new Nexmo({
    apiKey: process.env.PHONE_KEY,
    apiSecret: process.env.PHONE_SECRET,
});
function sendVerificationSMS (phone, code, callback){
    return nexmo.message.sendSms('Connect App', phone, `your verification code is ${code} and valid for 30 minutes only`, {}, callback)
}

module.exports = sendVerificationSMS;

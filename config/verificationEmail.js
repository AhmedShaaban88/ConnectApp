const nodeMailer = require('nodemailer');
const sgTransport= require('nodemailer-sendgrid-transport');
const handlebars = require('handlebars');
const readFileContent = require('../utils/readFileContent');
const path = require('path');

async function sendVerificationEmail(receiver, code){
    const options = {
        auth: {
            api_key: process.env.EMAIL_KEY
        }
    };
    const mailer = nodeMailer.createTransport(sgTransport(options));

    readFileContent(path.resolve(__dirname , '../public/html/emailVerification.html'), function(err, html) {
        const template = handlebars.compile(html);
        const replacements = {
            code: code
        };
        const htmlToSend = template(replacements);
        const email = {
            to: [receiver],
            from: 'ahmedshaaban3288@gmail.com',
            subject: 'Verify Account',
            text: '',
            html: htmlToSend
        };
        mailer.sendMail(email, function (err, _res) {
            if (err) {
                throw err
            }
        });
    });
}

module.exports = sendVerificationEmail;
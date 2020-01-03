'use strict';

const resolvePromise = require('../ResolvePromise');
module.exports = function (DemoCertificate) {

    DemoCertificate.sendmail = async function (identifier, pin, print, name, email, pdf, options) {
        try {
            // console.log(identifier, pin, print.length, email, pdf)
            DemoCertificate.create({ identifier, pin, print, email });
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey('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');
            const msg = {
                to: email,
                from: 'noreply@authentific.com.au',
                subject: 'Authentific Demo Certificate',
                html: `Dear ${name}, <br>Thank You for trying <strong>Authentific</strong>. Following attachment is your demo certificate. 
                Now you can scan the the certificate using the QR Code in the`,
                attachments: [
                    {
                        content: pdf,
                        filename: 'Authentific-demo-certificate.pdf',
                        type: 'application/pdf',
                        disposition: 'attachment',
                        contentId: 'mytext'
                    }
                ]
            };
            sgMail.send(msg);

            const msg1 = {
                // to: "shawon@workspaceit.com",
                to: "haroon@cybercorporation.com.au",
                from: 'noreply@authentific.com.au',
                subject: 'Authentific Demo Certificate New Visitor',
                html: `Hello, <br>A new visitor just printed the <strong>Authentific</strong> demo certificate. Following information are used by the user:<br><br>
                <strong>Name:</strong> ${name} <br>
                <strong>Email:</strong> ${email}`
            };

            sgMail.send(msg1);
            return { sucess: true };
        }
        catch (e) {
            console.log(e);
            return e;
        }
    };

    DemoCertificate.remoteMethod('sendmail', {
        accepts: [
            { arg: 'identifier', type: 'string', required: true },
            { arg: 'pin', type: 'string', required: true },
            { arg: 'print', type: 'string', required: true },
            { arg: 'name', type: 'string', required: true },
            { arg: 'email', type: 'string', required: true },
            { arg: 'pdf', type: 'any', required: true },
            { arg: "options", type: "object", http: "optionsFromRequest" }
        ],
        returns: { arg: 'verified', type: 'Boolean', root: true }
    });

    DemoCertificate.verify = async function (identifier, pin, options) {
        try {
            const result = await resolvePromise(await DemoCertificate.findOne({
                where: {
                    identifier: identifier,
                    pin: pin
                }
            }));
            return result;
        }
        catch (e) {
            console.log(e);
            return e;
        }

    };

    DemoCertificate.remoteMethod('verify', {
        accepts: [{ arg: 'identifier', type: 'string', required: true }, {
            arg: 'pin',
            type: 'string',
            required: true
        }, { arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'verified', type: 'Boolean', root: true
        }
    });
};

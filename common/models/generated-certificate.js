'use strict';
var Uuid = require('uuid/v4');
var cloneFunction = require('../../cloneFunction')
const awaitableCallback = require('../awaitableCallback');
var UAParser = require('ua-parser-js');

const resolvePromise = require('../ResolvePromise');
module.exports = function (Certificate) {

    function randomStringFromGuid(uid, limit) {
        var chars = uid;
        var string_length = limit;
        var randomstring = '';
        for (var i = 0; i < string_length; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
        }
        return randomstring;
    }

    Certificate.observe('before save', function (ctx, next) {


        var uuid = Uuid();
        if (ctx.instance && (!ctx.instance.isPrinted || ctx.instance.isPrinted === false)
            && (!ctx.instance.identifier || ctx.instance.identifier.length < 1)) {

            ctx.instance.identifier = uuid;
            ctx.instance.pin = randomStringFromGuid(uuid.toString().replace('-', ''), 5);
            console.log('creating certificate ctx.instances', ctx.instance);
            next();

        } else if (ctx.data && (!ctx.data.isPrinted || ctx.data.isPrinted === false) && (!ctx.data.identifier || ctx.data.identifier.length < 1)) {

            ctx.data.identifier = uuid;
            ctx.data.pin = randomStringFromGuid(uuid, 5);
            console.log('creating certificate ctx.data', ctx.data);
        }
        if (!ctx.instance || !ctx.instance.identifier) {
            next();

        }


    });

    Certificate.afterRemote('create', async function (ctx, instance, next) {

        try {

            if (instance) {


                let res = await Certificate.app.models.Approval.create({
                    staffId: ctx.req.currentUser.id,
                    certificateId: instance.id, instituteId: instance.instituteId
                });
                console.log('res in creating approval from generating certificate', res)
                return
            } else {
                console.log('Updated certificate', instance.id);

            }

        } catch (e) {
            console.log('Exception in generated Certificated', e)
        }

    });

    Certificate.observe('loaded', function (ctx, next) {
        if (ctx.data) {
            // delete ctx.data.pin;
            next()
        } else {
            console.log('Get generated certificates else',
                ctx.Model.pluralModelName,
                ctx.where);
            next();
        }

    });


    Certificate.verify = async function (identifier, pin, options) {


        try {

            const result = await resolvePromise(await Certificate.findOne({
                where: {
                    identifier: identifier,
                    pin: pin,
                    isPrinted: true,
                    isVoided: {neq: true}
                }
            }));
            console.log(result);
            if (result != null) {

                const verification = await resolvePromise(await Certificate.app.models.Verification.create({

                    instituteId: result.instituteId, certificateId: result.id

                }));
                console.log('verification', verification)

            }


            return result;
        }
        catch (e) {
            console.log(e);
            return e;
        }

    };

    Certificate.remoteMethod('verify', {
        accepts: [{arg: 'identifier', type: 'string', required: true}, {
            arg: 'pin',
            type: 'string',
            required: true
        }, {arg: "options", type: "object", http: "optionsFromRequest"}],
        returns: {
            arg: 'verified', type: 'Boolean', root: true
        }
    });


};

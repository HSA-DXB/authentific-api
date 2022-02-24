'use strict';
const VerifyYubiKey = require('../VerifyYubikey');
const ObjectId  = require('mongodb');

module.exports = function (Staff) {
    Staff.afterRemote('confirm', function (context, client, next) {
        const res = context.res;
        res.redirect('http://google.be');
    });

    
    Staff.observe('before save', function (ctx, next) {
        // console.log(ctx.instance)
        // if(ctx.instance.type=='superadmin'){
        //     let err = new Error();
        //     err.message = 'Invalid Request'
        //     err.status = 401
        //     return next(err);
        // }  
       if(!ctx.isNewInstance){
        let columnId = ctx.where.id;
        let accessId = ctx.options.accessToken.userId;

        if(JSON.stringify(columnId)!=JSON.stringify(accessId)){
            Staff.findById(accessId, function(err, post){
               
                    if(post.type == 'user'){
                        let err = new Error();
                        err.message = 'Unauthorized'
                        err.status = 401
                        return next(err);
                    } 
                    else{
                        // return next();
                    }
            })
        }
       }else{
        let accessId = ctx.options.accessToken.userId;
        Staff.findById(accessId, function(err, post){
            
                if(post.type == 'user'){
                    let err = new Error();
                    err.message = 'Unauthorized'
                    err.status = 401
                    return next(err);
                }
        })
       }
        


        if (!ctx.data || !ctx.data.requireYubikey) {
            return next();

        }

        try {

            console.log("===================")
            console.log(ctx.data)
            console.log(ctx.data.yubikeyId)

            const yub = require('yub');


            yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");


            yub.verify(ctx.data.yubikeyId, function (err, response) {
                console.log('Yubi err', err)
                console.log('YubiResponse', response.identity)

                if (response && response.valid) {
                    console.log(response.identity);

                    ctx.data.yubikeyId = response.identity;
                    next();
                } else {

                    return next(new Error('Problem with Yubikey, Please Try Again.'));

                }
            });


        } catch (e) {
            return next(new Error(e));


        }


    });

    Staff.afterRemote('findById', function (context, model, next) {


        model.yubikeyId = '';
        next();
        // if (!model.type.toString().includes('client')) {
        //
        //     if (Array.isArray(context.result)) {
        //         console.log('tis an array.')
        //         context.result.forEach(function (result) {
        //             addInstituteToStaff(result)
        //         });
        //     } else {
        //         console.log('tis not array')
        //
        //         let mystaff = cloneFunction(model.__data);
        //
        //         addInstituteToStaff(mystaff, context, next);
        //
        //     }
        // } else {
        //     console.log('going to next')
        //     next();
        //
        // }


    });

    // unused func
    function addInstituteToStaff(staff, context, next) {


        // console.log('staff passed')
        Staff.app.models.Institute.findById(staff.instituteId, function (err, institute) {
            // console.log('institute found', institute)
            if (err) {
                console.log('err', err)
                return next(err);
            }
            if (!institute) return next(new Error('could not find institute'));

            staff['institute'] = institute;
            delete staff['password'];
            // console.log('yellow', staff)
            context.res.status(200).send(staff);

        });
    }

    function cloneFunction(source) {
        if (Object.prototype.toString.call(source) === '[object Array]') {
            const clone = [];
            for (let i = 0; i < source.length; i++) {
                clone[i] = cloneFunction(source[i]);
            }
            return clone;
        } else if (typeof (source) === 'object') {
            const clone = {};
            for (const prop in source) {
                if (source.hasOwnProperty(prop)) {

                    if (source.__data) {
                        clone[prop] = cloneFunction(source[prop].__data);

                    } else {
                        clone[prop] = cloneFunction(source[prop]);
                    }
                }
            }
            return clone;
        } else {
            return source;
        }
    }

    Staff.afterRemote('login', async function (context, token, next) {
        // console.log('hello world')
        try {
            const yub = require('yub');


            yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");
            
            let staff = await Staff.findById(token.userId);
            // console.log(staff)


            if (staff.requireYubikey) {

                if (!context.args.credentials.yubikey) {

                    // console.log('Yubikey Missing')
                    let err = new Error();
                    err.message = 'Yubikey Missing in Auth.'
                    err.status = 401
                    return next(err);


                }

                let response = await VerifyYubiKey(context.args.credentials.yubikey);

                // console.log('response from Ubi API', response)
                if (response && response.valid && response.identity === staff.yubikeyId) {

                    // console.log('Verified')
                    return;
                } else {

                    // console.log('Invalid Yubikey');

                    let err = new Error();
                    err.message = 'Invalid Yubikey, Try Again.'
                    err.status = 401
                    return next(err);

                }


            } else {
                console.log('yubikey wasn\'t required')
                return;

            }


        } catch (e) {

            // console.log(e)
            return next(new Error(e));
        }


    });



    Staff.afterRemote('admin_login', async function (context, token, next) {
        // console.log('hello world')
        try {
            const yub = require('yub');


            yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");

            let staff = await Staff.findById(token.userId);


            if (staff.requireYubikey) {

                if (!context.args.credentials.yubikey) {

                    console.log('Yubikey Missing')
                    let err = new Error();
                    err.message = 'Yubikey Missing in Auth.'
                    err.status = 401
                    return next(err);


                }

                let response = await VerifyYubiKey(context.args.credentials.yubikey);

                // console.log('response from Ubi API', response)
                if (response && response.valid && response.identity === staff.yubikeyId) {

                    // console.log('Verified')
                    return;
                } else {

                    // console.log('Invalid Yubikey');

                    let err = new Error();
                    err.message = 'Invalid Yubikey, Try Again.'
                    err.status = 401
                    return next(err);

                }


            } else {
                console.log('yubikey wasn\'t required')
                return;

            }


        } catch (e) {

            console.log(e)
            return next(new Error(e));
        }


    });

    // Staff.login = async function (credentials, include, callback) {
    //     try {
    //         delete credentials.recaptchaReactive;
    //         console.log(credentials)
    //         let loginToken = await Staff.login(credentials, include);
    //         console.log(loginToken)
    //
    //         console.log('hello login')
    //         // If needed, here we can use loginToken.userId to retrieve
    //         // the user from the datasource
    //         let user = await Staff.findById(loginToken.userId);
    //
    //         console.log('looing for user', user)
    //         if (user) {
    //             return loginToken;
    //         }
    //     } catch (e) {
    //         return e;
    //     }
    //
    //     return null;
    //     // Invoke the default login function
    //
    // };
    //
    //
    // /** Register a path for the new login function
    //  */
    // Staff.remoteMethod('login', {
    //     'http': {
    //         'path': '/login',
    //         'verb': 'post'
    //     },
    //     'accepts': [
    //         {
    //             'arg': 'credentials',
    //             'type': 'object',
    //             'description': 'Login credentials',
    //             'required': true,
    //             'http': {
    //                 'source': 'body'
    //             }
    //         },
    //         {
    //             'arg': 'include',
    //             'type': 'string',
    //             'description': 'Related objects to include in the response. See the description of return value for more details.',
    //             'http': {
    //                 'source': 'query'
    //             }
    //         }
    //     ],
    //     'returns': [
    //         {
    //             'arg': 'token',
    //             'type': 'object',
    //             'root': true
    //         }
    //     ]
    // });


};

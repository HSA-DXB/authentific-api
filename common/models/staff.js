"use strict";
const VerifyYubiKey = require("../VerifyYubikey");
const ObjectId = require("mongodb");
require("dotenv").config();
const stytch = require("stytch");
const e = require("cors");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

module.exports = function (Staff) {
  const client = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_PROJECT_SECRET,
    env: stytch.envs.test,
  });
  Staff.afterRemote("confirm", function (context, client, next) {
    const res = context.res;
    res.redirect("http://google.be");
  });

  Staff.beforeRemote("login", async function (context, credentials, next) {
    console.log({ magicLink, credentials, context });
    try {
      const magicLink = await client.magicLinks.authenticate(credentials.token);

      if (magicLink) {
        const staff = await Staff.find({
          where: { email: magicLink.user.emails[0].email },
        });

        if (staff) {
          credentials.email = magicLink.user.emails[0].email;
          credentials.password = 123456789;
          console.log({ magicLink, staff, credentials, context });
          next();
        } else {
          return e;
        }
      } else {
        return e;
      }
    } catch (e) {
      return e;
    }

    return null;
    // Invoke the default login function
  });

  Staff.observe("before save", async function (ctx, next) {
    async function stytchRegisterUser() {
      return client.users.create({
        email: ctx.instance.email,
      });
    }
    // console.log(ctx.instance)
    // if(ctx.instance.type=='superadmin'){
    //     let err = new Error();
    //     err.message = 'Invalid Request'
    //     err.status = 401
    //     return next(err);
    // }
    if (!ctx.isNewInstance) {
      let columnId = ctx.where.id;
      let accessId = ctx.options.accessToken.userId;

      if (JSON.stringify(columnId) != JSON.stringify(accessId)) {
        Staff.findById(accessId, function (err, post) {
          if (post.type == "user") {
            let err = new Error();
            err.message = "Unauthorized";
            err.status = 401;
            return next(err);
          } else {
            // return next();
          }
        });
      }
    } else {
      let accessId = ctx.options.accessToken.userId;
      Staff.findById(accessId, function (err, post) {
        if (post.type == "user") {
          let err = new Error();
          err.message = "Unauthorized";
          err.status = 401;
          return next(err);
        }
      });
    }

    if (!ctx.data || !ctx.data.requireYubikey) {
      const res = await stytchRegisterUser();
      ctx.instance.StytchData = res.user;
      return next();
    }

    try {
      console.log("===================");
      console.log(ctx.data);
      console.log(ctx.data.yubikeyId);

      const yub = require("yub");

      yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");

      yub.verify(ctx.data.yubikeyId, function (err, response) {
        console.log("Yubi err", err);
        console.log("YubiResponse", response.identity);

        if (response && response.valid) {
          console.log(response.identity);

          ctx.data.yubikeyId = response.identity;
          next();
        } else {
          return next(new Error("Problem with Yubikey, Please Try Again."));
        }
      });
    } catch (e) {
      return next(new Error(e));
    }
  });

  Staff.afterRemote("findById", function (context, model, next) {
    model.yubikeyId = "";
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
    Staff.app.models.Institute.findById(
      staff.instituteId,
      function (err, institute) {
        // console.log('institute found', institute)
        if (err) {
          console.log("err", err);
          return next(err);
        }
        if (!institute) {
          return next(new Error("could not find institute"));
        }

        staff["institute"] = institute;
        delete staff["password"];
        // console.log('yellow', staff)
        context.res.status(200).send(staff);
      }
    );
  }

  function cloneFunction(source) {
    if (Object.prototype.toString.call(source) === "[object Array]") {
      const clone = [];
      for (let i = 0; i < source.length; i++) {
        clone[i] = cloneFunction(source[i]);
      }
      return clone;
    } else if (typeof source === "object") {
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

  const sendAVerificationToken = (staff) => {
    if (staff.require2FA !== undefined && staff.require2FA) {
      console.log("========i see=======");
      if (staff.verified2FA !== undefined && !staff.verified2FA) {
        console.log("========i see 2=======", accountSid, authToken);
        const client = require("twilio")(accountSid, authToken);
        console.log("========going=======");
        client.verify
          .services("VA7c8ee0f552059a57254012561686786d")
          .verifications.create({ to: staff.numberToUseIn2FA, channel: "sms" })
          .then((verification) => {
            console.log("========verification=======");
            console.log(verification);
            console.log("========verification=======");
            // response return
            return verification;
          });
      }
    }
  };

  Staff.afterRemote("login", async function (context, token, next) {
    try {
      const yub = require("yub");

      yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");
      let staff = await Staff.findById(token.userId);
      console.log(staff);

      /*
      2FA functionality starts
      */

      // const result = await sendAVerificationToken(staff)
      // console.log("result:", result)

      /*
      2FA functionality ends
      */

      if (staff.requireYubikey) {
        if (!context.args.credentials.yubikey) {
          // console.log('Yubikey Missing')
          let err = new Error();
          err.message = "Yubikey Missing in Auth.";
          err.status = 401;
          return next(err);
        }

        let response = await VerifyYubiKey(context.args.credentials.yubikey);

        // console.log('response from Ubi API', response)
        if (
          response &&
          response.valid &&
          response.identity === staff.yubikeyId
        ) {
          // console.log('Verified')
          return;
        } else {
          // console.log('Invalid Yubikey');

          let err = new Error();
          err.message = "Invalid Yubikey, Try Again.";
          err.status = 401;
          return next(err);
        }
      } else {
        console.log("yubikey wasn't required");
        return;
      }
    } catch (e) {
      console.log(e);
      return next(new Error(e));
    }
  });

  Staff.afterRemote("admin_login", async function (context, token, next) {
    // console.log('hello world')
    try {
      const yub = require("yub");

      yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");

      let staff = await Staff.findById(token.userId);

      if (staff.requireYubikey) {
        if (!context.args.credentials.yubikey) {
          console.log("Yubikey Missing");
          let err = new Error();
          err.message = "Yubikey Missing in Auth.";
          err.status = 401;
          return next(err);
        }

        let response = await VerifyYubiKey(context.args.credentials.yubikey);

        // console.log('response from Ubi API', response)
        if (
          response &&
          response.valid &&
          response.identity === staff.yubikeyId
        ) {
          // console.log('Verified')
          return;
        } else {
          // console.log('Invalid Yubikey');

          let err = new Error();
          err.message = "Invalid Yubikey, Try Again.";
          err.status = 401;
          return next(err);
        }
      } else {
        console.log("yubikey wasn't required");
        return;
      }
    } catch (e) {
      console.log(e);
      return next(new Error(e));
    }
  });

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

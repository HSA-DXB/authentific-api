"use strict";
const VerifyYubiKey = require("../VerifyYubikey");
const ObjectId = require("mongodb");
require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const stytch = require("stytch");

module.exports = function (Staff) {
  const client = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_PROJECT_SECRET,
    env: stytch.envs.test,
  });

  Staff.beforeRemote("login", async function (context, client, next) {
    console.log(context.req.body, "jelerjer");

    try {
      // const magicLink = await client.magicLinks.authenticate(
      //   context.req.body.token
      // );

      // if (magicLink) {
      //   const staff = await Staff.find({
      //     where: { email: magicLink.user.emails[0].email },
      //   });

      //   if (staff) {
      //     context.req.body.email = magicLink.user.emails[0].email;
      //     context.req.body.password = "123456789";
      //     context.req.body.yubikey = "";
      //     next();
      //   } else {
      //     let err = new Error();
      //     err.message = "User Not Found";
      //     err.status = 400;
      //     return next(err);
      //   }
      // }
      context.args.credentials.email = "iavro158@gmail.com";
      context.args.credentials.password = "123456789";
      context.args.credentials.yubikey = "";
      console.log(context);
      next();
    } catch (e) {
      console.log({ e });
      let err = new Error();
      err.message =
        "The magic link could not be authenticated because it was either already used or expired. Send another magic link to this user.";
      err.status = 400;
      return next(err);
    }

    return null;
  });

  Staff.afterRemote("confirm", function (context, client, next) {
    const res = context.res;
    res.redirect("http://google.be");
  });

  Staff.observe("before save", async function (ctx, next) {
    // console.log(ctx.instance)
    // if(ctx.instance.type=='superadmin'){
    //     let err = new Error();
    //     err.message = 'Invalid Request'
    //     err.status = 401
    //     return next(err);
    // }
    async function stytchRegisterUser() {
      return client.users.create({
        email: ctx.instance.email,
      });
    }

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
      try {
        const res = await stytchRegisterUser();
        ctx.instance.StytchData = res.user;
        return next();
      } catch (error) {
        return next(new Error(e));
      }
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
    // console.log('hello world')
    try {
      const yub = require("yub");
      console.log({ token });
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
      console.log("printtttttttttttttttttt");
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

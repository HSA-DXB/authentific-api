"use strict";
const VerifyYubiKey = require("../VerifyYubikey");
const ObjectId = require("mongodb");
require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const stytch = require("stytch");

module.exports = function (Staff) {
  const stytchClient = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_PROJECT_SECRET,
    env: stytch.envs.test,
  });
  // Staff.beforeRemote("login", function (context, client, next) {
  //   if (context.args.credentials.email === "superadmin@authentific.com")
  //     return next();
  //   stytchClient.magicLinks
  //     .authenticate(context.req.body.token)
  //     .then((magicLink) => {
  //       if (magicLink) {
  //         console.log(magicLink.user.emails);
  //         Staff.find(
  //           {
  //             where: { email: magicLink.user.emails[0].email },
  //           },
  //           function (err, staff) {
  //             console.log(staff);
  //             if (staff) {
  //               // context.args.credentials = {
  //               //   yubikey: "",
  //               //   password: "123456789",
  //               //   email: magicLink.user.emails[0].email,
  //               // };
  //               next();
  //             } else {
  //               let err = new Error();
  //               err.message = "User Not Found";
  //               err.status = 400;
  //               return next(err);
  //             }

  //             if (err) {
  //               let err = new Error();
  //               err.message = "User Not Found";
  //               err.status = 400;
  //               return next(err);
  //             }
  //           }
  //         );
  //       }
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //       let err = new Error();
  //       err.message =
  //         "The magic link could not be authenticated because it was either already used or expired. Send another magic link to this user.";
  //       err.status = 400;
  //       return next(err);
  //     });
  // });

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
      return stytchClient.users.create({
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
        if (ctx.currentInstance) return next();
        const res = await stytchRegisterUser();
        ctx.instance.StytchData = res.user;
        return next();
      } catch (error) {
        return next(new Error(error));
      }
    }

    try {
      console.log("===================");
      // console.log(ctx.data);
      // console.log(ctx.data.yubikeyId);

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

  Staff.login = async function (credentials, include, callback) {
    const User = Staff.app.models.User;
    const self = this;
    console.log("==========login===========");
    console.log(credentials);

    if (credentials.token) {
      try {
        const magicLink = await stytchClient.magicLinks.authenticate(
          credentials.token
        );
        if (magicLink) {
          const staff = await Staff.findOne({
            where: { email: magicLink.user.emails[0].email },
          });

          if (!staff) {
            const err = new Error("User Not Found");
            err.statusCode = 400;
            throw err;
          }

          // Create and return the access token without checking the password
          const token = await staff.createAccessToken(credentials.ttl);
          if (include === "user") {
            token.__data.user = staff;
          }
          return token;
        }
      } catch (error) {
        const err = new Error(
          "The magic link could not be authenticated because it was either already used or expired. Send another magic link to this user."
        );
        err.statusCode = 400;
        throw err;
      }
    } else if (credentials.email && credentials.password) {
      if (!credentials.email || !credentials.password) {
        const err = new Error("Invalid login credentials");
        err.statusCode = 401;
        throw err;
      }

      const staff = await Staff.findOne({
        where: { email: credentials.email },
      });

      if (!staff) {
        const err = new Error("User Not Found");
        err.statusCode = 400;
        throw err;
      }
      // Check if staff user exists and password matches
      if (!staff || !(await staff.validatePassword(password))) {
        return res.status(401).send("Invalid email or password.");
      }

      // Generate a token for the authenticated user
      const token = await staff.generateAccessToken();
      if (include === "user") {
        token.__data.user = staff;
      }
      return token;
      // return User.login.call(self, credentials, include);
      // next();
    } else {
      const err = new Error("Invalid login credentials");
      err.statusCode = 401;
      throw err;
    }
  };

  Staff.afterRemote("login", async function (context, token, next) {
    // console.log('hello world')
    try {
      const yub = require("yub");
      // console.log({ token });
      yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");

      let staff = await Staff.findById(token.userId);
      // console.log(staff);

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
      // console.log("printtttttttttttttttttt");
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

  // Register the custom login method
  Staff.remoteMethod("login", {
    description: "Login a user with Stytch token or superadmin credentials.",
    accepts: [
      {
        arg: "credentials",
        type: "object",
        required: true,
        http: { source: "body" },
      },
      {
        arg: "include",
        type: ["string"],
        http: { source: "query" },
        description:
          "Related objects to include in the response. See the description of return value for more details.",
      },
    ],
    returns: {
      arg: "accessToken",
      type: "object",
      root: true,
      description:
        "The response body contains properties of the AccessToken created on login.\n" +
        "Depending on the value of `include` parameter, the body may contain additional properties:\n\n" +
        "  - `user` - `U+007BUserU+007D` - Data of the currently logged in user. (`include=user`)\n\n",
    },
    http: { verb: "post" },
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

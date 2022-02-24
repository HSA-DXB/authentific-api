"use strict";
const resolvePromise = require("../ResolvePromise");
module.exports = function (NFCTagVerificationToken) {
  NFCTagVerificationToken.verify = async function (token, options) {
    try {
      const TEN_MIUNTES = 2 * 60 * 1000;
      console.log(Date.now() + TEN_MIUNTES);
      const result = await resolvePromise(
        await NFCTagVerificationToken.findOne({
          where: {
            token: token,
            isExpired: { gte: Date.now() - TEN_MIUNTES },
          },
        })
      );
      console.log({ result });
      return result;
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  NFCTagVerificationToken.remoteMethod("verify", {
    accepts: [
      { arg: "token", type: "string", required: true },
      // { arg: 'pin',  type: 'string', required: true},
      { arg: "options", type: "object", http: "optionsFromRequest" },
    ],
    returns: {
      arg: "verified",
      type: "Boolean",
      root: true,
    },
  });
};

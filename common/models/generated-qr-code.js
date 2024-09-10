"use strict";
var Uuid = require("uuid/v4");
const QRCode = require("qrcode");
const resolvePromise = require("../ResolvePromise");

module.exports = function (Generatedqrcode) {
  function randomStringFromGuid(uid, limit) {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz123456789";
    var string_length = limit;
    var randomstring = "";
    for (var i = 0; i < string_length; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
  }
  Generatedqrcode.observe("before save", function (ctx, next) {
    if (ctx.isNewInstance) {
      const uuid = Uuid();
      ctx.instance.identifier = randomStringFromGuid(uuid, 8);
      ctx.instance.pin = randomStringFromGuid(uuid, 6);
    }
    next();
  });

  Generatedqrcode.afterRemote("create", function (ctx, instance, next) {
    const qrData = `Identifier: ${instance.identifier}, PIN: ${instance.pin}`;
    QRCode.toDataURL(qrData, function (err, url) {
      if (err) return next(err);
      ctx.res.setHeader("Content-Type", "image/png");
      ctx.res.send(Buffer.from(url.split(",")[1], "base64"));
    });
  });
};

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

  Generatedqrcode.generateQrCode = async function (
    candidateId,
    certificateId,
    instituteId
  ) {
    const uuid = Uuid();
    const pin = randomStringFromGuid(uuid, 5);
    const certificateData = {
      candidateId,
      certificateId,
      instituteId,
      identifier: uuid,
      pin,
      isPrinted: false,
      isVoided: false,
      isApproved: false,
    };

    const certificate = await Generatedqrcode.create(certificateData);

    const qrCodeData = `${process.env.AUTHENTIFIC_WEB_URL}/certificate-preview?identifier=${certificateData.identifier}&pin=${certificateData.pin}`;

    // Generate QR code as an image buffer
    const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, { type: "png" });

    // Return to prevent further processing
    return qrCodeBuffer;
  };

  Generatedqrcode.remoteMethod("generateQrCode", {
    accepts: [
      { arg: "candidateId", type: "string", required: true },
      { arg: "certificateId", type: "string", required: true },
      { arg: "instituteId", type: "string", required: true },
      { arg: "options", type: "object", http: "optionsFromRequest" },
    ],
    returns: {
      arg: "data",
      type: "Buffer",
      root: true,
    },
    http: {
      path: "/generate-qr-code",
      verb: "post",
    },
  });

  Generatedqrcode.observe("before save", (ctx, next) => {
    var uuid = Uuid();
    if (
      ctx.instance &&
      (!ctx.instance.isPrinted || ctx.instance.isPrinted === false) &&
      (!ctx.instance.identifier || ctx.instance.identifier.length < 1)
    ) {
      ctx.instance.identifier = uuid;
      ctx.instance.pin = randomStringFromGuid(
        uuid.toString().replace("-", ""),
        5
      );
      next();
    } else if (
      ctx.data &&
      (!ctx.data.isPrinted || ctx.data.isPrinted === false) &&
      (!ctx.data.identifier || ctx.data.identifier.length < 1)
    ) {
      ctx.data.identifier = uuid;
      ctx.data.pin = randomStringFromGuid(uuid, 5);
    }
    if (!ctx.instance || !ctx.instance.identifier) {
      next();
    }
  });

  Generatedqrcode.afterRemote("create", async function (ctx, instance, next) {
    try {
      if (instance) {
        let res = await Generatedqrcode.app.models.Approval.create({
          staffId: ctx.req.currentUser.id,
          certificateId: instance.id,
          instituteId: instance.instituteId,
        });
        return;
      }
    } catch (e) {
      console.log("Exception in generated Certificated", e);
    }
  });
};

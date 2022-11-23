"use strict";

var loopback = require("loopback");
var boot = require("loopback-boot");
require("dotenv").config();
var bodyParser = require("body-parser");
var UAParser = require("ua-parser-js");
const publicIp = require("public-ip");
const awaitableCallback = require("../common/awaitableCallback");
const resolvePromise = require("../common/ResolvePromise");
const scheduleBackupJob = require("../scheduler/scheduleBackup");
const TokenGenerator = require("uuid-token-generator");
var app = (module.exports = loopback());
var http = require("http");
var GoogleUrl = require("google-url");
var request = require("request");
var bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: "50mb" }));
const stytch = require("stytch");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 1000000,
  })
);

const path = require("path");

const fs = require("fs");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_PROJECT_SECRET,
  env: stytch.envs.test,
});
app.start = function () {
  scheduleBackupJob();
  // start the web server
  return app.listen(function () {
    app.emit("started");
    var baseUrl = app.get("url").replace(/\/$/, "");
    // console.log('Authentific is listening at: %s', baseUrl);
    if (app.get("loopback-component-explorer")) {
      var explorerPath = app.get("loopback-component-explorer").mountPath;
      // console.log('Browse Authentific Api at %s%s', baseUrl, explorerPath);
    }
  });
};

app.use("/api/createShortUrl", function (req, res) {
  var headers = {
    Authorization: "Bearer 52100c01812625ce4ab7da0eef221381411ca990",
    "Content-Type": "application/json",
  };

  let list = ["1", "2", "3"];
  let urls = [];
  list.forEach((element) => {
    var sendData = {
      long_url: "https://dev.bitly.com" + element,
      domain: "bit.ly",
    };
    var dataString = JSON.stringify(sendData);

    var options = {
      url: "https://api-ssl.bitly.com/v4/shorten",
      method: "POST",
      headers: headers,
      body: dataString,
    };
    // request(options,async function(error,response, body){
    //   urls.push(JSON.parse(body))
    //   if(list.length==urls.length){
    //     res.send(urls)
    //   }
    // });
  });
});

// Retrieve the currently authenticated user
app.use(async function (req, res, next) {
  // First, get the access token, either from the url or from the headers
  var tokenId = false;
  if (req.query && req.query.access_token) {
    tokenId = req.query.access_token;
  }
  // @TODO - not sure if this is correct since I'm currently not using headers
  // to pass the access token
  else if (req.headers && req.headers.access_token) {
    // tokenId = req.headers.access_token
  }

  // Now, if there is a tokenId, use it to look up the currently authenticated
  // user and attach it to the app
  req["currentUser"] = false;
  if (tokenId) {
    var UserModel = app.models.Staff;

    // Logic borrowed from user.js -> User.logout()
    UserModel.relations.accessTokens.modelTo.findById(
      tokenId,
      function (err, accessToken) {
        if (err) return next(err);
        if (!accessToken) return next(new Error("could not find accessToken"));

        // Look up the user associated with the accessToken

        // dont worry that we are getting so much data, i.e certificates etc.
        // they are just promise functions, not actual data is returned until the promise is resolved
        UserModel.findById(
          accessToken.userId,
          {
            include: [
              "staffCategory",
              {
                certifications: [
                  { certificates: ["candidate", "approvals", "certification"] },
                ],
              },
            ],
          },
          function (err, user) {
            if (err) return next(err);
            if (!user) return next(new Error("could not find a valid user"));

            req["currentUser"] = user;

            let activity = {};

            let urlSplits = req.originalUrl.split("?")[0].split("/");

            activity["staffId"] = user.id;
            // activity['table'] = req;

            activity["instituteId"] = user.instituteId;
            const parser = new UAParser(req.headers["user-agent"]);

            activity["os"] = parser.getOS().name;

            activity["browser"] = parser.getBrowser().name;

            publicIp.v4().then(async (ip) => {
              activity["ip"] = ip;

              let u1 = urlSplits[2];
              let u2 = urlSplits[3];
              let u3 = urlSplits[4];
              let u4 = urlSplits[5];

              if (u3) {
                activity["table"] = u3;
                if (u4) {
                  activity["row"] = u4;
                }
              } else if (u1) {
                activity["table"] = u1;
                if (u2) {
                  activity["row"] = u2;
                }
              }

              activity["action"] = req.method;

              let savedActivity = await app.models.ActivityLog.create(activity);
              // console.log('user', req.currentUser.certifications)
            });

            next();
          }
        );
      }
    );
  }

  // If no tokenId was found, continue without waiting
  else {
    next();
  }
});

app.use("/api/getwaitingformyapproval", async function (req, res) {
  let result = [];
  //certificates that i approved but are still not approved
  // console.clear()
  let certifications = await awaitableCallback(req.currentUser.certifications);

  for (const certification of certifications) {
    const certificates = await awaitableCallback(certification.certificates);
    for (const certificate of certificates) {
      if (!certificate.isApproved) {
        const approvedByMe = await resolvePromise(
          await app.models.Approval.find({
            where: {
              certificateId: certificate.id,
              staffId: req.currentUser.id,
            },
          })
        );

        if (!approvedByMe || approvedByMe.length < 1) {
          result.push(certificate);
        }
      }
    }
  }
  res.status(200).send(result);
});

app.use("/api/checkRemainingCertificateApproval", async function (req, res) {
  const certificateId = req.body.certificateId;
  const certificate = await resolvePromise(
    await app.models.Certificate.findById(certificateId)
  );
  const staffCertifications = await resolvePromise(
    await app.models.StaffCertification.find({
      where: { certificationId: certificate.certificationId },
    })
  );
  const approvals = await resolvePromise(
    await app.models.Approval.find({
      where: { certificateId: certificateId },
    })
  );
  // console.log(staffCertifications.length, approvals.length)
  if (staffCertifications.length === approvals.length) {
    certificate.updateAttribute("isApproved", true);
  }
  res.status(200).send({ success: true });
});

async function handleCertificates(approvals, req, res) {
  if (!approvals || approvals.length < 1) {
    // console.log('No certificates');
    res.status(204).send({ err: "No Content." });
    return;
  }

  let result = [];
  let index = 1;
  try {
    approvals.forEach(async (approval) => {
      let tempApproval1 = Object.assign({}, approval).__data;

      let certificate = await resolvePromise(
        await app.models.Approval.relations.certificate.modelTo.findById(
          approval.certificateId
        )
      );

      tempApproval1["certificate"] = certificate;
      if (tempApproval1.certificate !== null) {
        let candidate = await resolvePromise(
          await app.models.Certificate.relations.candidate.modelTo.findById(
            tempApproval1.certificate.candidateId
          )
        );
        {
          let tempApproval2 = Object.assign({}, tempApproval1);

          tempApproval2["candidate"] = candidate;

          let certification = await resolvePromise(
            await app.models.Certificate.relations.certification.modelTo.findById(
              tempApproval2.certificate.certificationId
            )
          );
          let tempApproval3 = Object.assign({}, tempApproval2);
          tempApproval3["certification"] = certification;

          result.push(tempApproval3);

          if (index === approvals.length) {
            res.status(200).send(result);
            return;
          }
          index += 1;
        }
      }
    });
  } catch (e) {
    // console.log('Exception', e)
    res.status(501).send(e);
  }
}

app.use(
  "/api/pending-certificate/pendingapprovalbyothers/:certificationId/:id",
  async function (req, res) {
    let result = [];
    //certificates that i approved but are still not approved

    let certificationId = req.params.certificationId;
    let id = req.params.id;

    // const certification = await awaitableCallback(id);
    // const certificate = await awaitableCallback(certification.certificates);

    const approvalAuthor = await resolvePromise(
      await app.models.StaffCertification.find({
        where: { certificationId: certificationId },
      })
    );

    let approvedByOther = [];
    let allAwaitingAuthors = "";
    let totalApprovalAuthor = approvalAuthor.length;
    let count = 0;

    for (const author of approvalAuthor) {
      count++;

      approvedByOther = await resolvePromise(
        await app.models.Approval.find({
          where: { certificateId: id, staffId: author.staffId },
        })
      );

      if (approvedByOther.length < 1) {
        let authorDetails = await resolvePromise(
          await app.models.Staff.find({
            where: { _id: author.staffId },
          })
        );

        allAwaitingAuthors +=
          authorDetails[0].firstName + " " + authorDetails[0].lastName;
        if (count !== 1 && count < totalApprovalAuthor) {
          allAwaitingAuthors += ", ";
        }
      }
    }
    // certificate.awaitingApprove = allAwaitingAuthors;

    const approvedByMe = await resolvePromise(
      await app.models.Approval.find({
        where: { certificateId: id, staffId: req.currentUser.id },
      })
    );

    if (approvedByMe.length > 0 && allAwaitingAuthors == "") {
      result.push(id);
    }

    res.status(200).send(result);
  }
);

app.use("/api/pendingapprovalbyothers", async function (req, res) {
  let result = [];
  //certificates that i approved but are still not approved
  console.clear();
  let certifications = await awaitableCallback(req.currentUser.certifications);

  for (const certification of certifications) {
    // for (const certificate of certification.certificates) {
    const certificates = await awaitableCallback(certification.certificates);

    for (const certificate of certificates) {
      let awaitingApprove = [];
      if (!certificate.isApproved) {
        const approvalAuthor = await resolvePromise(
          await app.models.StaffCertification.find({
            where: { certificationId: certificate.certificationId },
          })
        );

        let approvedByOther = [];
        let allAwaitingAuthors = "";
        let totalApprovalAuthor = approvalAuthor.length;
        let count = 0;

        for (const author of approvalAuthor) {
          count++;

          approvedByOther = await resolvePromise(
            await app.models.Approval.find({
              where: { certificateId: certificate.id, staffId: author.staffId },
            })
          );
          if (approvedByOther.length < 1) {
            let authorDetails = await resolvePromise(
              await app.models.Staff.find({
                where: { _id: author.staffId },
              })
            );
            allAwaitingAuthors +=
              authorDetails[0].firstName + " " + authorDetails[0].lastName;
            if (count !== 1 && count < totalApprovalAuthor) {
              allAwaitingAuthors += ", ";
            }
          }
        }
        certificate.awaitingApprove = allAwaitingAuthors;
        // if (approvedByOther.length <1) {
        //     certificate.awaitingApprove = awaitingApprove
        //     // result.push(certificate);
        // }

        const approvedByMe = await resolvePromise(
          await app.models.Approval.find({
            where: {
              certificateId: certificate.id,
              staffId: req.currentUser.id,
            },
          })
        );

        if (approvedByMe.length > 0 && allAwaitingAuthors != "") {
          result.push(certificate);
        }
        // console.log('approvals', await resolvePromise(await app.models.Approval.find({certificateId: certificate.id})));
      }
      // }
    }
  }
  res.status(200).send(result);
});

app.use("/api/certificate-verification-by-nfc/:id", async function (req, res) {
  //   let server = http.createServer(function(req, res){
  //   console.log(req)

  // })
  let apiKey = req.headers.token;
  let host = req.headers.host;

  if (apiKey === "e5e43310-eb68-4ff5-9015-a0174c7d7668-authentific") {
    const identifier = req.params.id;

    const nfcTag = await resolvePromise(
      await app.models.NFCTag.findOne({
        where: { identifier: identifier, isDamaged: false },
      })
    );

    console.log(nfcTag);
    if (nfcTag && nfcTag.certificateId) {
      const tokgen = new TokenGenerator(256, TokenGenerator.BASE62); // Default is a 128-bit token encoded in base58

      const dataToSave = {
        nfcTagId: nfcTag.id,
        token: tokgen.generate(),
        certificateId: nfcTag.certificateId,
      };

      const newNfcToken = await app.models.NFCTagVerificationToken.create(
        dataToSave
      );
      console.log("newNfcToken");
      console.log(newNfcToken);
      const scanData = {
        certificateId: nfcTag.certificateId,
        instituteId: nfcTag.instituteId,
        nfcId: nfcTag.id,
      };
      console.log("scanData");
      console.log(scanData);
      await app.models.NFCTagScan.create(scanData);

      res.status(200).send(newNfcToken);
    } else {
      res.status(500).send("Unauthorized");
    }
  } else {
    res.status(500).send("Unauthorized");
  }
});

app.use("/api/sendEmail", function (req, res) {
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(
    "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"
  );
  const msg = {
    to: req.body.to,
    from: "noreply@authentific.com.au",
    subject: "Authentific Account Credentials",
    html:
      "Dear " +
      req.body.firstName +
      ", <br>Thank You for creating account at <strong>Authentific</strong>. " +
      "Please login using the following credentials at <strong>Authentific</strong>.<br>" +
      "<strong>Email: </strong>" +
      req.body.to +
      "<br>" +
      "<strong>Password: </strong>" +
      req.body.password +
      "<br>" +
      "Have a good day<br>" +
      "<strong>Regards</strong>,<br>" +
      "<strong>TEAM AUTHENTIFIC</strong>",
  };
  sgMail.send(msg);
});

app.use("/api/sendTransactionHistoryToMail", function (req, res) {
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(
    "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"
  );
  console.log(req.currentUser);
  const msg = {
    to: req.currentUser.email,
    from: "noreply@authentific.com.au",
    subject: "Blockchain Transaction Alert",
    html: `Dear ${req.currentUser.firstName} ${req.currentUser.lastName || ""},
    Please find enclosed your blockchain transaction receipt in PDF format. You can download, save, print and access your blockchain transaction receipt anytime you wish.
   Thank you`,
    attachments: [
      {
        content: req.body.pdf,
        filename: "Blockchain Transaction Receipt.pdf",
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  };
  try {
    sgMail.send(msg);
    res.status(200).json("Mail sent");
  } catch (error) {
    console.log(error);
    res.status(400).json("Something went wrong!");
  }
});

app.use("/api/sendCertificateToMail", function (req, res) {
  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(
    "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"
  );
  let msg;
  if (req.body.type === "jpg") {
    msg = {
      to: req.body.email,
      from: "noreply@authentific.com.au",
      subject: `Your ${req.body.documentName} is now stored securely on Blockchain`,
      html: `Dear Customer,
      Please find enclosed your ${req.body.documentName} in PDF format. You can download, save, print and instantly verify your document by going to ${process.env.AUTHENTIFIC_WEB_URL} `,
      attachments: [
        {
          content: req.body.pdf,
          filename: req.body.documentName + ".jpg",
          type: "application/jpg",
          disposition: "attachment",
        },
      ],
    };
  } else {
    msg = {
      to: req.body.email,
      from: "noreply@authentific.com.au",
      subject: `Your ${req.body.documentName} is now stored securely on Blockchain`,
      html: `Dear Customer,
      Please find enclosed your ${req.body.documentName} in PDF format. You can download, save, print and instantly verify your document by going to ${process.env.AUTHENTIFIC_WEB_URL}`,
      attachments: [
        {
          content: req.body.pdf,
          filename: req.body.documentName + ".pdf",
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };
  }

  try {
    sgMail.send(msg);
    res.status(200).json("Mail sent successfully");
  } catch (error) {
    console.log(error);
    res.status(400).json("Something went wrong!");
  }
});

app.use("/api/2FA/verify-token", function (req, res) {
  console.log("i see haw maw kaw");
  const client = require("twilio")(accountSid, authToken);

  client.verify
    .services("VA7c8ee0f552059a57254012561686786d")
    .verificationChecks.create({ to: req.body.to, code: req.body.code })
    .then((verification_check) => {
      console.log(verification_check);
      if (verification_check.status === "approved") {
        // update model field: verified2FA
        res.status(200).json({
          success: true,
          message: "Approved successfully.",
          data: verification_check,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Something went wrong.",
          err: "Invalid code",
        });
      }
    })
    .catch((err) => {
      res.status(500).json({
        success: false,
        message: "Something went wrong.",
        err: err,
      });
    });
});
app.use("/api/login-magic-link", function (req, res) {
  try {
    app.models.Staff.find(
      {
        where: { email: req.body.email },
      },
      function (err, staff) {
        if (staff.length > 0) {
          const params = {
            email: req.body.email,
            login_magic_link_url: process.env.MAGIC_LINK_URL,
            signup_magic_link_url: process.env.MAGIC_LINK_URL,
          };
          client.magicLinks.email
            .loginOrCreate(params)
            .then(res.json("emailSent"))
            .catch((err) => {
              // on failure, log the error then render the homepage
              console.log(err);
              res.json(err);
            });
        } else res.status(400).json("User not found");
      }
    );
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      err: e,
    });
  }
});

app.use("/api/stripe-payment", function (req, res, next) {
  const { payment_info, user_info } = req.body;
  try {
    stripe.charges.create(
      {
        amount: payment_info.amount,
        currency: "USD",
        description: "User registration",
        source: payment_info.source,
      },
      (err, charge) => {
        console.log(err);
        if (err) {
          res
            .status(400)
            .json({ success: false, message: "Payment not completed." });
          next();
        } else {
          app.models.SignupUsers.create(
            { ...user_info, payment_info: charge },
            function (err, user) {
              if (err) {
                console.log(err);
                res.status(500).json({
                  success: false,
                  message: "Something went wrong.",
                  err: err,
                });
              } else {
                const sgMail = require("@sendgrid/mail");
                sgMail.setApiKey(
                  "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"
                );
                const governmentIssuedIdContent =
                  user_info.governmentIssuedId.value.split(",")[1];
                const businessRegistrationCertificateContent =
                  user_info.businessRegistrationCertificate.value.split(",")[1];
                let msg = {
                  to: "tony@workspaceit.com",
                  from: "noreply@authentific.com.au",
                  subject: `New user registered`,
                  html: `Dear Admin,
                A new user has been registered. Please find the details below:
                <br>
                <br>
                <b>Name:</b> ${user_info.firstName + "" + user_info.lastName}
                <br>
                <b>Email:</b> ${user_info.email}
                <br>
                <b>Phone:</b> ${user_info.phoneNumber}
                <br>
                <b>Company:</b> ${user_info.companyName}
                <br>
                <b>Designation:</b> ${user_info.designation}
                <br>
                <b>Office Landline Number:</b> ${user_info.officeLandlineNumber}
                <br>
                <b>Company Website:</b> ${user_info.companyWebsite}
                <br>
                <b>Office Address:</b> ${user_info.officeAddress}
                <br>
                <b>Payment Status:</b> ${charge.status}
                <br>
                <b>Payment Amount:</b> ${charge.amount}
                <br>
                <b>Payment Currency:</b> ${charge.currency}
                `,
                  attachments: [
                    {
                      content: governmentIssuedIdContent,
                      filename:
                        "Government_Issue_ID" +
                        `.${
                          user_info.governmentIssuedId.type === "image/jpeg"
                            ? "jpg"
                            : "pdf"
                        }`,
                      type:
                        user_info.governmentIssuedId.type === "image/jpeg"
                          ? "application/jpg"
                          : "application/pdf",
                      disposition: "attachment",
                    },
                    {
                      content: businessRegistrationCertificateContent,
                      filename:
                        "Business_Registration_Certificate" +
                        `.${
                          user_info.businessRegistrationCertificate.type ===
                          "image/jpeg"
                            ? "jpg"
                            : "pdf"
                        }`,
                      type:
                        user_info.businessRegistrationCertificate.type ===
                        "image/jpeg"
                          ? "application/jpg"
                          : "application/pdf",
                      disposition: "attachment",
                    },
                  ],
                };
                sgMail
                  .send(msg)
                  .then((res) => {})
                  .catch((err) => {
                    console.log(err, err.response.body);
                  });
              }
            }
          );
          res
            .status(200)
            .json({ success: true, message: "Payment completed." });
        }
      }
    );
  } catch (e) {
    console.log(e);
  }
});

app.use("/api/2FA/send-verify-token", function (req, res) {
  console.log("i see req to send verify token");
  try {
    const client = require("twilio")(accountSid, authToken);
    console.log("========going=======");
    console.log(req.body);
    console.log("========going=======");
    client.verify
      .services("VA7c8ee0f552059a57254012561686786d")
      .verifications.create({ to: req.body.numberToUseIn2FA, channel: "sms" })
      .then((verification) => {
        console.log("========verification=======");
        console.log(verification);
        console.log("========verification=======");
        // response return
        res.status(200).json({
          success: true,
          message: "Sent successfully.",
          data: verification,
        });
      })
      .catch((err) => {
        res.status(500).json({
          success: false,
          message: "Something went wrong.",
          err: err,
        });
      });
  } catch (e) {
    console.log("========verification=======");
    console.log(e);
    console.log("========verification=======");
    res.status(500).json({
      success: false,
      message: "Something went wrong.",
      err: e,
    });
  }
});

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) app.start();
});

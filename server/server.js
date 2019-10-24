'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var bodyParser = require('body-parser');
var UAParser = require('ua-parser-js');
const publicIp = require('public-ip');
const awaitableCallback = require('../common/awaitableCallback');
const resolvePromise = require('../common/ResolvePromise');
var app = module.exports = loopback();


var bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 1000000 }));

app.start = function () {
  // start the web server
  return app.listen(function () {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Authentific is listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse Authentific Api at %s%s', baseUrl, explorerPath);
    }
  });
};


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
  req['currentUser'] = false;
  if (tokenId) {
    var UserModel = app.models.Staff;

    // Logic borrowed from user.js -> User.logout()
    UserModel.relations.accessTokens.modelTo.findById(tokenId, function (err, accessToken) {
      if (err) return next(err);
      if (!accessToken) return next(new Error('could not find accessToken'));

      // Look up the user associated with the accessToken

      // dont worry that we are getting so much data, i.e certificates etc.
      // they are just promise functions, not actual data is returned until the promise is resolved
      UserModel.findById(accessToken.userId, { include: ['staffCategory', { certifications: [{ certificates: ['candidate', 'approvals', 'certification'] }] }] }, function (err, user) {
        if (err) return next(err);
        if (!user) return next(new Error('could not find a valid user'));


        req['currentUser'] = user;


        let activity = {};


        let urlSplits = req.originalUrl.split('?')[0].split('/');

        activity['staffId'] = user.id;
        // activity['table'] = req;

        activity['instituteId'] = user.instituteId;
        const parser = new UAParser(req.headers['user-agent']);


        activity['os'] = parser.getOS().name;

        activity['browser'] = parser.getBrowser().name;


        publicIp.v4().then(async ip => {
          activity['ip'] = ip;


          let u1 = urlSplits[2];
          let u2 = urlSplits[3];
          let u3 = urlSplits[4];
          let u4 = urlSplits[5];


          if (u3) {
            activity['table'] = u3;
            if (u4) {
              activity['row'] = u4;
            }

          } else if (u1) {
            activity['table'] = u1;
            if (u2) {
              activity['row'] = u2;
            }
          }


          activity['action'] = req.method;


          let savedActivity = await app.models.ActivityLog.create(activity);
          // console.log('user', req.currentUser.certifications)

        });

        next();
      });

    });
  }

  // If no tokenId was found, continue without waiting
  else {
    next();
  }
});

app.use('/api/getwaitingformyapproval', async function (req, res) {
  let result = [];
  //certificates that i approved but are still not approved
  // console.clear()
  let certifications = await awaitableCallback(req.currentUser.certifications);


  for (const certification of certifications) {
    const certificates = await awaitableCallback(certification.certificates);
    for (const certificate of certificates) {

      if (!certificate.isApproved) {
        const approvedByMe = (await resolvePromise(await app.models.Approval.find({
          where: { certificateId: certificate.id, staffId: req.currentUser.id }
        })));

        if (!approvedByMe || approvedByMe.length < 1) {
          result.push(certificate);
        }
      }
    }
  }
  res.status(200).send(result);
});

app.use('/api/checkRemainingCertificateApproval', async function (req, res) {
  const certificateId = req.body.certificateId;
  const certificate = (await resolvePromise(await app.models.Certificate.findById(certificateId)));
  const staffCertifications = (await resolvePromise(await app.models.StaffCertification.find({
    where: { certificationId: certificate.certificationId }
  })));
  const approvals = (await resolvePromise(await app.models.Approval.find({
    where: { certificateId: certificateId }
  })));
  console.log(staffCertifications.length, approvals.length)
  if (staffCertifications.length === approvals.length) {
    certificate.updateAttribute('isApproved', true);
  }
  res.status(200).send({ success: true });
});


async function handleCertificates(approvals, req, res) {


  if (!approvals || approvals.length < 1) {
    console.log('No certificates');
    res.status(204).send({ err: 'No Content.' });
    return;
  }

  let result = [];
  let index = 1;
  try {
    approvals.forEach(async approval => {
      let tempApproval1 = Object.assign({}, approval).__data;


      let certificate = await resolvePromise(await app.models.Approval.relations.certificate.modelTo.findById(approval.certificateId));


      tempApproval1['certificate'] = certificate;
      if (tempApproval1.certificate !== null) {


        let candidate = await resolvePromise(await app.models.Certificate.relations.candidate.modelTo.findById(tempApproval1.certificate.candidateId));
        {

          let tempApproval2 = Object.assign({}, tempApproval1)


          tempApproval2['candidate'] = candidate;


          let certification = await resolvePromise(await app.models.Certificate.relations.certification.modelTo.findById(tempApproval2.certificate.certificationId));
          let tempApproval3 = Object.assign({}, tempApproval2)
          tempApproval3['certification'] = certification;

          result.push(tempApproval3)

          if (index === approvals.length) {

            res.status(200).send(result);
            return;

          }
          index += 1;


        }
      }
    });
  } catch (e) {
    console.log('Exception', e)
    res.status(501).send(e)
  }

}


app.use('/api/pendingapprovalbyothers', async function (req, res) {

  let result = [];
  //certificates that i approved but are still not approved
  console.clear()
  let certifications = await awaitableCallback(req.currentUser.certifications);

  for (const certification of certifications) {

    // for (const certificate of certification.certificates) {
    const certificates = await awaitableCallback(certification.certificates);

    for (const certificate of certificates) {

      let awaitingApprove = [];
      if (!certificate.isApproved) {

        const approvalAuthor = (await resolvePromise(await app.models.StaffCertification.find({
          where: { certificationId: certificate.certificationId }
        })));

        let approvedByOther = [];
        let allAwaitingAuthors = "";
        let totalApprovalAuthor = approvalAuthor.length;
        let count = 0;

        for (const author of approvalAuthor) {
          count++;

          approvedByOther = (await resolvePromise(await app.models.Approval.find({
            where: { certificateId: certificate.id, staffId: author.staffId }
          })));
          if (approvedByOther.length < 1) {
            let authorDetails = (await resolvePromise(await app.models.Staff.find({
              where: { _id: author.staffId }
            })));
            allAwaitingAuthors += authorDetails[0].firstName + ' ' + authorDetails[0].lastName;
            if (count !== 1 && count < totalApprovalAuthor) {
              allAwaitingAuthors += ', ';
            }
          }
        }
        certificate.awaitingApprove = allAwaitingAuthors;
        // if (approvedByOther.length <1) {
        //     certificate.awaitingApprove = awaitingApprove
        //     // result.push(certificate);
        // }

        const approvedByMe = (await resolvePromise(await app.models.Approval.find({
          where: { certificateId: certificate.id, staffId: req.currentUser.id }
        })));

        if (approvedByMe.length > 0) {
          result.push(certificate);
        }
        // console.log('approvals', await resolvePromise(await app.models.Approval.find({certificateId: certificate.id})));

      }
      // }
    }

  }
  res.status(200).send(result);
}
);


// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;


  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});


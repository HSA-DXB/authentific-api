'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

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
app.use(function (req, res, next) {
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
            UserModel.findById(accessToken.userId, function (err, user) {
                if (err) return next(err);
                if (!user) return next(new Error('could not find a valid user'));


                req['currentUser'] = user;


                next();
            });

        });
    }

    // If no tokenId was found, continue without waiting
    else {
        next();
    }
});
app.use('/api/getwaitingformyapproval', function (req, res) {
    // console.log('request received', req.currentUser)
    app.models.Approval.find({
        where: {
            staffId: {neq: req.currentUser.id},
            instituteId: req.currentUser.instituteId
        }
    }, (err, waitingForApproval) => {
        app.models.Approval.find({
            where: {
                staffId: req.currentUser.id,
                instituteId: req.currentUser.instituteId
            }
        }, (err, approvedByMe) => {
            let approvalsToPassOn = []
            waitingForApproval.forEach(approval => {

                if (!approvedByMe.find(x => x.certificateId === approval.certificateId)) {
                    approvalsToPassOn.push(approval);

                }

            })
            handleCertificates(err, approvalsToPassOn, req, res)
        })


    })
});

app.use('/api/getapprovedbyme', function (req, res) {
    // console.log('request received', req.currentUser)
    app.models.Approval.find({
        where: {
            staffId: req.currentUser.id,
            instituteId: req.currentUser.instituteId
        }
    }, (err, approvals) => {
        handleCertificates(err, approvals, req, res)
    })
});


// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
    if (err) throw err;


    // start the server if `$ node server.js`
    if (require.main === module)
        app.start();
});

function handleCertificates(err, approvals, req, res) {

    console.log('approvals', approvals)


    if (approvals.length < 1) {
        console.log('returning a 204')
        res.status(204).send({err: 'No Content.'});
        return;
    }

    let result = [];
    let index = 1;
    approvals.forEach(approval => {
        let tempApproval1 = Object.assign({}, approval).__data;


        app.models.Approval.relations.certificate.modelTo.findById(approval.certificateId, (err, certificate) => {
            if (err) {
                console.log('error while getting certificates', err)
                res.status(404).send(err)
            }


            tempApproval1['certificate'] = certificate;
            if (tempApproval1.certificate !== null) {


                app.models.Certificate.relations.candidate.modelTo.findById(tempApproval1.certificate.candidateId, (err, candidate) => {

                    let tempApproval2 = Object.assign({}, tempApproval1)


                    tempApproval2['candidate'] = candidate;


                    app.models.Certificate.relations.certification.modelTo.findById(tempApproval2.certificate.certificationId, (err, certification) => {
                        let tempApproval3 = Object.assign({}, tempApproval2)
                        tempApproval3['certification'] = certification;

                        result.push(tempApproval3)

                        if (index === approvals.length) {

                            res.status(200).send(result);
                            return;

                        }
                        index += 1;

                    });


                })
            } else {
                if (index === approvals.length) {

                    res.status(204).send({err:'No Content.'});
                    return;

                }
                index += 1;


            }

        });

    });

    // if (err != null) {
    //     res.status(404).send(err);
    //
    //     return
    // }


}

//
// app.post('/api/generatecertificate', async function (req, res) {
//     try {
//         await app.dataSources.db.transaction(async models => {
//             const {Certificate} = models;
//             const {Approval} = models;
//             console.log(await Certificate.count()); // 0
//             let resultCertificate = await Certificate.create(req.body);
//             console.log(resultCertificate); // 1
//             console.log(await Certificate.count()); // 1
//             await Approval.create({
//                 staffId: req.currentUser.id,
//                 certificateId: resultCertificate.id, instituteId: resultCertificate.instituteId
//             });
//             res.status(200).send(resultCertificate);
//         });
//     } catch (e) {
//         console.log(e); // Oops
//         res.status(500).send(e);
//     }
// });
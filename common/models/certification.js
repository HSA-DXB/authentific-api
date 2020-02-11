'use strict';
var app = require('../../server/server');

const ReturnWithResolvedPromise = require('../ResolvePromise');
const awaitableCallback = require('../awaitableCallback');
module.exports = function (Certification) {


    // Certification.afterRemote('**', function (ctx, Certification, next) {
    //
    //
    //     next();
    // });

    Certification.afterRemote('*.save', function (ctx, Certification, next) {
        console.log('******* In create ********', Certification);

        next();
    });

    // Certification.observe('after save', function (ctx, next) {
    //     if (ctx.isNewInstance) {

    //         Certification.remoteMethod('createApproval', {
    //             accepts: [{ arg: 'certificationId', type: 'string' }, { arg: 'staffId', type: 'string' }, {
    //                 arg: 'instituteId',
    //                 type: 'string'
    //             },
    //             { arg: 'candidates', type: 'array' }],
    //             returns: { arg: 'data', type: 'array', root: true },
    //             http: { path: 'Institutes/'+ctx.instance.instituteId+'/Certifications', verb: 'post' }
    //         });


    //         // Staffcertification.app.models.create()
    //         let dataToPost = {
    //             certificationId: ctx.instance.id,
    //             staffId: ctx.options.accessToken.userId,
    //             instituteId: ctx.instance.instituteId,
    //         }
    //         console.log(dataToPost)
    //         let createApproval =Certification.app.models.Staffcertification.create({
    //             certificationId: ctx.instance.id,
    //             staffId: ctx.options.accessToken.userId,
    //             instituteId: ctx.instance.instituteId
    //         });
    //         if (createApproval) {
    //             next()
    //         }
            
    //     }
    // });

    // Certification.createApproval = async (certificationId, staffId, instituteId) => {

    // }

    Certification.addCandidates = async (certification, staffId, instituteId, candidates) => {


        console.log('certification x', certification);
        console.log('candidates x', candidates);

        let allOK = true;

        let result = [];
        try {

            for (const candidate of candidates) {
                candidate.instituteId = instituteId;
                const savedCandidate = await Certification.app.models.Candidate.create(candidate);
                if (savedCandidate) {
                    let generatedCertificate = await Certification.app.models.Certificate.create({
                        candidateId: savedCandidate.id,
                        instituteId: savedCandidate.instituteId,
                        certificationId: certification, staffId: staffId
                    }); // pin and identifier are made by operation hook in generated certificate

                    if (generatedCertificate) {
                        console.log('generated certificate in certification', generatedCertificate);

                        let savedApproval = await Certification.app.models.Approval.create({
                            staffId: staffId,
                            certificateId: generatedCertificate.id, instituteId: generatedCertificate.instituteId
                        });


                        let approval = await Certification.app.models.Approval.findById(savedApproval.id, { include: [{ certificate: 'candidate' }] });

                        console.log('generated approval', approval);

                        result.push(approval);

                        if (!approval) {
                            allOK = false;
                        }
                    } else {
                        allOK = false;
                    }

                } else {
                    allOK = false;
                }
            }

            console.log('result', result);

            if (allOK) {
                console.log('A Okay');

                return result;
            } else {
                console.log('all was not ok');
                return 'An unexpected server error occurred while importing candidates';
            }
        } catch
        (e) {
            console.log('Exception in certification', e);
            return e;
        }


    };

    Certification.remoteMethod('addCandidates', {
        accepts: [{ arg: 'certification', type: 'string' }, { arg: 'staffId', type: 'string' }, {
            arg: 'instituteId',
            type: 'string'
        },
        { arg: 'candidates', type: 'array' }],
        returns: { arg: 'data', type: 'array', root: true },
        http: { path: '/add-candidates', verb: 'post' }
    });


    Certification.dashboardCertification = async (instituteId) => {


        let result = [];
        try {

            let certifications = await ReturnWithResolvedPromise(await Certification.find({ where: { instituteId: instituteId } }));
            for (const certification of certifications) {

                certification['total'] = await ReturnWithResolvedPromise(await Certification.app.models.Certificate.count(
                    { certificationId: certification.id }));
                certification['approved'] = await ReturnWithResolvedPromise(await Certification.app.models.Certificate.count(
                    { certificationId: certification.id, isApproved: true }));
                console.log('approved', certification['approved']);
                certification['pendingApproval'] = await ReturnWithResolvedPromise(await Certification.app.models.Certificate.count(
                    { and: [{ certificationId: certification.id }, { or: [{ isApproved: false }, { isApproved: null }] }] }));
                console.log('pendingApproval', certification['pendingApproval']);

                certification['printed'] = await ReturnWithResolvedPromise(await Certification.app.models.Certificate.count(
                    { and: [{ certificationId: certification.id }, { isPrinted: true }] }));
                console.log('printed', certification['printed']);
                certification['candidate'] = await ReturnWithResolvedPromise(await Certification.app.models.Candidate.count(
                    { certificationId: certification.id }));

            }
            return certifications;
        } catch
        (e) {
            console.log('Exception in certification', e);
            return e;
        }


    };
    Certification.remoteMethod('dashboardCertification', {
        accepts: [{ arg: 'institute', type: 'string' }],
        returns: { arg: 'data', type: 'array', root: true },
        http: { path: '/certification-metrics', verb: 'get' }
    });
};

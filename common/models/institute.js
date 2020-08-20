'use strict';

const ReturnWithResolvedPromise = require('../ResolvePromise');
const awaitableCallback = require('../awaitableCallback');
const resolvePromise = require('../ResolvePromise');
var S3 = require('aws-sdk/clients/s3');
var AWS = require('aws-sdk');
AWS.config.update({ accessKeyId: 'AKIAUNBAJ3PZOQYYVKU7', secretAccessKey: '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', region: 'us-west-2' });
// AWS.config.update({ accessKeyId: 'AKIAUNBAJ3PZPL7P5RWH', secretAccessKey: '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', region: 'us-west-2' });
var s3 = new AWS.S3();



module.exports = function (Institute) {


    Institute.observe('after save', function (ctx, next) {

        if (!ctx.isNewInstance) {
            
            // dataToCopy.each(function(value, cb) {

            // s3.copyObject({  
            //     CopySource: srcBucket + '/' + value,
            //     Bucket: destBucket,
            //     Key: value
            //     }, function(copyErr, copyData){
            //        if (copyErr) {
            //             console.log("Error: " + copyErr);
            //          } else {
            //             console.log('Copied OK');
            //          } 
            //     });
            //   });
            // s3.copyObject({ 
            //     CopySource: srcBucket + '/' + sourceObject,
            //     Bucket: destBucket,
            //     Key: sourceObject
            //     }, function(copyErr, copyData){
            //        if (copyErr) {
            //             console.log("Error: " + copyErr);
            //          } else {
            //             console.log('Copied OK');
            //          } 
            //     });
            //   callback(null, 'All done!');
            // var params = {};
            // s3.listBuckets(params, function(err, data) {
            //     if (err) console.log(err, err.stack); // an error occurred
            //     else     console.log(data);
            // })
            var params = {
                // Bucket: "institute-5e3402d627391a61f4017128-images", 
                Bucket: "institute-5e3698e392f17e7f6674a3a1-images", 
                // MaxKeys: 2
               };
               s3.listObjects(params, function(err, data) {
                 if (err) console.log(err, err.stack); // an error occurred
                 else     console.log(data); 
               });
            next()

        } else {
            let instituteId = ctx.instance.id;
            var params = {
                Bucket: "institute-" + instituteId + "-images",
                CreateBucketConfiguration: {
                    LocationConstraint: "us-west-2"
                }
            };
            s3.createBucket(params, function (err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else console.log(data);           // successful response

            });

            var params = {
                Bucket: "institute-" + instituteId + "-candidates",
                CreateBucketConfiguration: {
                    LocationConstraint: "us-west-2"
                }
            };
            s3.createBucket(params, function (err, data) {
                if (err) {
                    console.log(err, err.stack); // an error occurred
                    next();
                }

                else{
                    var srcBucket = "institute-5cd12b7c674dea647ca3914a-images";
                    var destBucket = "institute-"+instituteId+"-images";
    
                    let dataToCopy = ["Template L1-01.jpg","Template L2-01.jpg","Template L3-01.jpg","Template L4-01.jpg", "Template L5-01.jpg", "Template P1-01.jpg","Template P2-01.jpg","Template P3-01.jpg","Template P4-01.jpg", "Template P5-01.jpg"]
                    let i = 0;
                    for (let value of dataToCopy) {
                        s3.copyObject({
                            CopySource: srcBucket + '/' + value,
                            Bucket: destBucket,
                            Key: value
                        }, function (copyErr, copyData) {
                            if (copyErr) {
                                console.log("Error: " + copyErr);
                                next();
                            } else {
                                i++;
                                if (i == dataToCopy.length) {
                                    next();
                                }
                            }
                        });
                    };           // successful response
                }
               
            });

        }
    })




    Institute.getMetrics = async (institute, userId) => {
        let metrics = {};

        metrics['voidedCertificatesCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            { and: [{ instituteId: institute }, { isVoid: true }, { isVoid: { neq: null } }] }));
        metrics['printedCertificatesCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            { and: [{ instituteId: institute }, { isPrinted: true }, { isPrinted: { neq: null } }] }));
        metrics['pendingApprovalsCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            { and: [{ instituteId: institute }, { or: [{ isApproved: false }, { isApproved: null }] }] }));
        metrics['candidateCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Candidate.count({ instituteId: institute }));
        metrics['certificationCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certification.count({ instituteId: institute }));
        metrics['approvedCertificates'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({
            instituteId: institute,
            isApproved: true
        }
        ));
        metrics['pendingReport'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({
            instituteId: institute,
            isApproved: true,
            isReportGenerated:false
        }
        ));
        metrics['generatedReport'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({
            instituteId: institute,
            isApproved: true,
            isReportGenerated:true
        }
        ));

        //region  count_waiting_for_my_approval

        const staff = await ReturnWithResolvedPromise(await Institute.app.models.Staff.findById(userId,
            { include: [{ certifications: ['certificates'] }] }));


        const certifications = await awaitableCallback(staff.certifications);
        metrics['waitingForMyApproval'] = 0;
        metrics['revenue'] = 0;

        for (let certification of certifications) {

            for (const certificate of await awaitableCallback(certification.certificates)) {
                // console.log('certificate', certificate);
                if (!certificate.isApproved) {
                    const approvedByMe = (await resolvePromise(await Institute.app.models.Approval.count(
                        { certificateId: certificate.id, staffId: userId }
                    )));

                    if (approvedByMe < 1) {

                        metrics['waitingForMyApproval'] += 1;
                    }

                    // console.log('is approved by me', approvedByMe);
                    // console.log('waiting', metrics['waitingForMyApproval']);


                } else if (certificate.isPrinted && certification.price) {
                    metrics['revenue'] += certification.price;

                }


            }
        }
        if (metrics['revenue'] >= 1000) {
            metrics['revenue'] = (metrics['revenue'] / 1000) + 'K';
        } else if (metrics['revenue'] >= 1000000) {
            metrics['revenue'] = (metrics['revenue'] / 1000000) + 'Mil';
        }

        //endregion


        metrics['staffCategoryCount'] = await ReturnWithResolvedPromise(await Institute.app.models.StaffCategory.count({ instituteId: institute }));
        metrics['staffCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Staff.count({ instituteId: institute }));
        metrics['certificateCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({ instituteId: institute }));
        metrics['nfcTagsCount'] = await ReturnWithResolvedPromise(await Institute.app.models.NFCTag.count({ instituteId: institute }));
        metrics['stockCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Paper.count({ instituteId: institute }));
        metrics['damagedStockCount'] = (await ReturnWithResolvedPromise(await Institute.app.models.Paper.count(
            { instituteId: institute, isDamaged: true })));


        metrics['verifications'] = (await ReturnWithResolvedPromise(await Institute.app.models.Verification.count(
            { instituteId: institute })));


        return metrics;

    };

    Institute.remoteMethod('getMetrics', {
        accepts: [{ arg: 'institute', type: 'string' }, { arg: 'userId', type: 'string' }],
        returns: { arg: 'data', type: 'Object', root: true },
        http: { path: '/get-metrics', verb: 'get' }
    });

};



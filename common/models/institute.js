'use strict';

const ReturnWithResolvedPromise = require('../ResolvePromise');
const awaitableCallback = require('../awaitableCallback');
const resolvePromise = require('../ResolvePromise');

module.exports = function (Institute) {

    Institute.getMetrics = async (institute, userId) => {
        let metrics = {};

        metrics['voidedCertificatesCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            {and: [{instituteId: institute}, {isVoid: true}, {isVoid: {neq: null}}]}));
        metrics['printedCertificatesCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            {and: [{instituteId: institute}, {isPrinted: true}, {isPrinted: {neq: null}}]}));
        metrics['pendingApprovalsCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count(
            {and: [{instituteId: institute}, {or: [{isApproved: false}, {isApproved: null}]}]}));
        metrics['candidateCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Candidate.count( {instituteId: institute}));
        metrics['certificationCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certification.count({instituteId: institute}));
        metrics['approvedCertificates'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({
                instituteId: institute,
                isApproved: true
            }
        ));

        //region  count_waiting_for_my_approval

        const staff = await ReturnWithResolvedPromise(await Institute.app.models.Staff.findById(userId,
            {include: [{certifications: ['certificates']}]}));


        const certifications = await awaitableCallback(staff.certifications);
        metrics['waitingForMyApproval'] = 0;
        metrics['revenue'] = 0;

        for (let certification of certifications) {

            for (const certificate of  await awaitableCallback(certification.certificates)) {
                console.log('certificate', certificate);
                if (!certificate.isApproved) {
                    const approvedByMe = (await resolvePromise(await Institute.app.models.Approval.count(
                        {certificateId: certificate.id, staffId: userId}
                    )));

                    if (approvedByMe < 1) {

                        metrics['waitingForMyApproval'] += 1;
                    }

                    console.log('is approved by me', approvedByMe);
                    console.log('waiting', metrics['waitingForMyApproval']);


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


        metrics['staffCategoryCount'] = await ReturnWithResolvedPromise(await Institute.app.models.StaffCategory.count({instituteId: institute}));
        metrics['staffCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Staff.count({instituteId: institute}));
        metrics['certificateCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Certificate.count({instituteId: institute}));
        metrics['nfcTagsCount'] = await ReturnWithResolvedPromise(await Institute.app.models.NFCTag.count({instituteId: institute}));
        metrics['stockCount'] = await ReturnWithResolvedPromise(await Institute.app.models.Paper.count({instituteId: institute}));
        metrics['damagedStockCount'] = (await ReturnWithResolvedPromise(await Institute.app.models.Paper.count(
            {instituteId: institute, isDamaged: true})));


        metrics['verifications'] = (await ReturnWithResolvedPromise(await Institute.app.models.Verification.count(
            {instituteId: institute})));


        return metrics;

    };

    Institute.remoteMethod('getMetrics', {
        accepts: [{arg: 'institute', type: 'string'}, {arg: 'userId', type: 'string'}],
        returns: {arg: 'data', type: 'Object', root: true},
        http: {path: '/get-metrics', verb: 'get'}
    });

};



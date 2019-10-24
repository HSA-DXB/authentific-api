'use strict';

const ReturnWithResolvedPromise = require('../ResolvePromise');
const awaitableCallback = require('../awaitableCallback');

module.exports = function (Approval) {

  Approval.observe('after save', async function (ctx, next) {
    try {


      if (ctx.instance) {

        console.log('approval ctx', ctx.instance)

        // console.log('certificate', await ReturnWithResolvedPromise(await Approval.app.models.Certificate.findById(ctx.instance.certificateId)));
        let certificate = await ReturnWithResolvedPromise(
          await Approval.app.models.Certificate.findById(ctx.instance.certificateId, { include: 'approvals' }));

        const certification = await ReturnWithResolvedPromise(
          await Approval.app.models.Certification.findById(certificate.certificationId, { include: ['staff'] }));


        let isApproved = true;

        for (let staff of await awaitableCallback(certification.staff)) {

          let approvals = await ReturnWithResolvedPromise(await Approval.find({
            where: {
              staffId: staff.Id,
              certificateId: certificate.id
            }
          }));
          console.log('approvals', approvals.length);

          if (!approvals.find(x => x.staffId === staff.id)) {
            isApproved = false;
            break;
          }
        }


        certificate.isApproved = isApproved;
        console.log('Before Approving', certificate);

        Approval.app.models.Certificate.upsertWithWhere({ id: certificate.id }, certificate, (err, result) => {
          console.log('err Of Updating Certificate', err);

          console.log('Result Of Updating Certificate', result);

        });

      }
    } catch (e) {
      console.log('Error In Approval ', e)
    }
  });


};

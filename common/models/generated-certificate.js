'use strict';

module.exports = function (Certificate) {


    Certificate.observe('after save', function (ctx, next) {
        if (ctx.instance) {
            console.log('Saved %s#%s', ctx.Model.modelName, ctx.instance.id);

            console.log('Context', ctx.options.accessToken.userId)
            Certificate.app.models.Approval.create({
                staffId: ctx.options.accessToken.userId,
                certificateId: ctx.instance.id, instituteId: ctx.instance.instituteId
            }, function (err, data) {

                console.log(err)
                console.log(data)
                next()
            });
        } else {
            console.log('Updated %s matching %j',
                ctx.Model.pluralModelName,
                ctx.where);
            next();
        }

    });

    // Certificate.afterRemote('find', function (context, Certification, next) {
    //
    //     console.log('here i am');
    //     console.log(context.result);
    //
    //     if (Array.isArray(context.result)) {
    //         for (const obj in context.result) {
    //             Certification.relations.approvals.modelTo.findById(obj.id, (err, approvals) => {
    //
    //                 console.log(approvals)
    //             })
    //
    //         }
    //
    //     }
    //
    //     next();
    // });


    // Certificate.approve = async function (data) {
    //
    //     var loopback = require('loopback');
    //     var app = module.exports = loopback();
    //     try {
    //
    //         await app.dataSources.db.transaction(async models => {
    //             console.log(models);
    //             const {Approval} = models;
    //             await Approval.create({
    //                 instituteId: data.certificate.instituteId,
    //                 certificateId: data.id,
    //                 staffId: data.staffId
    //             });
    //             const {Certificate} = models;
    //             Certificate.create(data);
    //         });
    //     } catch (e) {
    //         console.log(e); // Oops
    //     }
    //     console.log(app.models.Approval.count()); // 0
    //
    //     console.log(data);
    //     return data;
    // }
    //
    // Certificate.remoteMethod('approve', {
    //     accepts: {arg: 'data', type: 'object'},
    //     returns: {arg: 'result', type: 'object'}
    // });
};

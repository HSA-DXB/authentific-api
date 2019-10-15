'use strict';
var app = require('../../server/server');
module.exports = function (Certification) {


    Certification.afterRemote('**', function (context, Certification, next) {


        // let activityLog = app.models.ActivityLog;
        // activityLog.create({instituteId:context.req.currentUser.instituteId,staffId:req.currentUser.id,})
        // console.log(context.req.currentUser)
        next();
    });
};

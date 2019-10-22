'use strict';

module.exports = function (StaffCategory) {
    StaffCategory.beforeRemote('create', function (ctx, model,next) {

        model.createdAt = Date.now();
        next();
    });

    StaffCategory.beforeRemote('update', function (ctx, model,next) {
        model.updatedAt = Date.now();
        next();
    });

};

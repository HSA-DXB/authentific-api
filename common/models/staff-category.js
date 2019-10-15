'use strict';

module.exports = function (StaffCategory) {
    StaffCategory.beforeRemote('create', function (next, model) {
        model.createdAt = Date.now();
        next();
    });

    StaffCategory.beforeRemote('update', function (next, model) {
        model.updatedAt = Date.now();
        next();
    });

};

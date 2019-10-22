'use strict';
module.exports = (params) => {
    const yub = require('yub');


    yub.init("41713", "NR+uycIuvGoA1Wh/VmF2eGx2CqQ=");
    return new Promise((resolve, reject) => {
        yub.verify(params, (err, response) => {


            if (response) {
                 resolve(response)
                return
            }

            if (err) {
                reject(err)

            }
        });
    });
};
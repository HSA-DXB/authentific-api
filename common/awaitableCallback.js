'use strict';
module.exports = (method) => {


    return new Promise((resolve, reject) => {
        method((err, response) => {


            if (response) {
                resolve(response);
                return
            }

            if (err) {
                reject(err)

            }
        });
    });
};

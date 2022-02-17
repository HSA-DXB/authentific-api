'use strict';
module.exports = async function ResolvePromise(dbQuery) {
    try {
        return Promise.resolve(dbQuery);
    } catch (e) {
        return Promise.reject(e);
    }
};
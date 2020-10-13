'use strict';
var request = require('request');
const resolvePromise = require('../ResolvePromise');
const short = require('short-uuid');

module.exports = function (Nfctag) {

    var headers = {
        'Authorization': 'Bearer 52100c01812625ce4ab7da0eef221381411ca990',
        'Content-Type': 'application/json'
    };

    Nfctag.generate = async function (identifierLength, options) {
        try {

            let length = parseInt(identifierLength);
            let urls = [];
            for (let i = 0; i < length; i++) {
                let identifier = short.generate();
                var sendData = {
                    "long_url": "https://dev.bitly.com" + identifier,
                    "domain": "bit.ly"
                }
                var dataString = JSON.stringify(sendData);

                var options = {
                    url: 'https://api-ssl.bitly.com/v4/shorten',
                    method: 'POST',
                    headers: headers,
                    body: dataString
                };
                const result = await sendRequest(options,identifier);
                if (result) {
                    urls.push(result);
                }

                if(urls.length===length){
                    return urls;
                }

            }

        }
        catch (e) {
            console.log(e);
            return e;
        }

    };

    async function sendRequest(options,identifier) {
        return new Promise((resolve, reject) => {
            request(options, async function (error, response, body) {
                let shortUrlData = JSON.parse(body);
                let nfcObject = { identifier: identifier, shortUrl: shortUrlData.link, isDamaged: false, shortUrlInfo: shortUrlData }
                const result = await resolvePromise(await Nfctag.create(nfcObject));
                if (result) {
                    resolve(result);
                } else {
                    reject();
                }
            });
        })
    }

    Nfctag.remoteMethod('generate', {
        accepts: [{ arg: 'identifierLength', type: 'any', required: true }, { arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'data', type: 'any', root: true
        }
    });
};

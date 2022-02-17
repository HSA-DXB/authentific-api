'use strict';
var request = require('request');
const ReturnWithResolvedPromise = require('../ResolvePromise');
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
                    "long_url": "http://34.123.66.81/?pid=" + identifier,
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

    

    Nfctag.summary = async function (options) {
        let metrics={};
        metrics['damaged'] = (await ReturnWithResolvedPromise(await Nfctag.count({ isDamaged: true })));
        metrics['assigned'] = (await ReturnWithResolvedPromise(await Nfctag.count({ isDamaged: false,isAssigned:true})));
        metrics['unassigned'] = (await ReturnWithResolvedPromise(await Nfctag.count({ isDamaged: false,isAssigned:false,nfcId:{ "neq":  "" }})));
        metrics['newGenerated'] = (await ReturnWithResolvedPromise(await Nfctag.count({ isDamaged: false,nfcId:"" })));
   
        return metrics;
    }


    Nfctag.assignToInstitute = async function (nfcIds,institute,options){
        let i=0;
        nfcIds.forEach(element => {
            Nfctag.upsertWithWhere({ id: element}, {instituteId:institute,isAssigned:true}, (err, result) => {
                console.log('err Of Updating Certificate', err);    
                console.log('Result Of Updating Certificate', result);
              });
              i++
              if(i==nfcIds.length){
                return { sucess: true };
              }
        });         
    }


    Nfctag.assignToUser = async function (nfcIds,institute,options){
        let i=0;
        nfcIds.forEach(element => {
            Nfctag.upsertWithWhere({ id: element.id,isAssigned:false}, {instituteId:institute,isAssigned:true}, (err, result) => {
                console.log('err Of Updating Certificate', err);    
                console.log('Result Of Updating Certificate', result);
              });
              i++
              if(i==nfcIds.length){
                return { sucess: true };
              }
        });         
    }

    Nfctag.updateNfcId = async function (nfcIds,options){
        let i=0;
        nfcIds.forEach(element => {
            Nfctag.upsertWithWhere({ id: element.id}, {nfcId:element.nfcId}, (err, result) => {
                console.log('err Of Updating Certificate', err);    
                console.log('Result Of Updating Certificate', result);
              });
              i++
              if(i==nfcIds.length){
                return { sucess: true };
              }
        });         
    }

    Nfctag.remoteMethod('generate', {
        accepts: [{ arg: 'number', type: 'any', required: true }, { arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'data', type: 'any', root: true
        }
    });

    Nfctag.remoteMethod('summary', {
        accepts: [{ arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: { arg: 'data', type: 'Object', root: true },
        http: { path: '/summary', verb: 'get' }
    });
    

    Nfctag.remoteMethod('assignToInstitute', {
        accepts: [{ arg: 'nfcIds', type: 'any', required: true },{ arg: 'institute', type: 'any', required: true }, { arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'data', type: 'any', root: true
        }
    });


    Nfctag.remoteMethod('updateNfcId', {
        accepts: [{ arg: 'nfcIds', type: 'any', required: true },{ arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'data', type: 'any', root: true
        }
    });

    Nfctag.remoteMethod('assignToUser', {
        accepts: [{ arg: 'nfcIds', type: 'any', required: true },{ arg: 'institute', type: 'any', required: true }, { arg: "options", type: "object", http: "optionsFromRequest" }],
        returns: {
            arg: 'data', type: 'any', root: true
        }
    });
};

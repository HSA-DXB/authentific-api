/**
 * Automatically migrates custom modles
 */

//custom models : only models with persisted storage should be here
const MODELS = ['Institute', 'Certification', 'Staff', 'StaffCategory', 'Candidate'
    , 'Certificate', 'Paper', 'BluePrint', 'StaffCertification', 'ActivityLog', 'Approval', 'NFCTag', 'Verification'];
module.exports = function updateCutstomModels(app, next) {
    // reference to our datasource
    const myDb = app.dataSources.mongoDB;
    // check if the model is out of sync with DB
    myDb.isActual(MODELS, (err, actual) => {
        if (err) {
            throw err;
        }
        const syncStatus = actual ? 'in sync' : 'out of sync';
        // console.log('');
        // console.log(`Custom models are ${syncStatus}`);
        // console.log('');
        // skip if models in sync
        if (actual) {
            return next();
        }

        // console.log('Migrating Custom Models...');
        // update models
        myDb.autoupdate(MODELS, (_err) => {
            if (_err) {
                throw _err;
            }
            // console.log('Custom models migration successful!');
            // console.log('');
            next();
        });
    });
};

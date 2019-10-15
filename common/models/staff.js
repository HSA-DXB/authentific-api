'use strict';

module.exports = function (Staff) {
    Staff.afterRemote('confirm', function (context, client, next) {
        const res = context.res;
        res.redirect('http://google.be');
    });


    // Staff.afterRemote('findById', function (context, model, next) {
    //
    //     if (!model.type.toString().includes('client')) {
    //
    //         if (Array.isArray(context.result)) {
    //             console.log('tis an array.')
    //             context.result.forEach(function (result) {
    //                 addInstituteToStaff(result)
    //             });
    //         } else {
    //             console.log('tis not array')
    //
    //             let mystaff = cloneFunction(model.__data);
    //
    //             addInstituteToStaff(mystaff, context, next);
    //
    //         }
    //     } else {
    //         console.log('going to next')
    //         next();
    //
    //     }
    //
    //
    // });

    function addInstituteToStaff(staff, context, next) {


        console.log('staff passed')
        Staff.app.models.Institute.findById(staff.instituteId, function (err, institute) {
            console.log('institute found', institute)
            if (err) {
                console.log('err', err)
                return next(err);
            }
            if (!institute) return next(new Error('could not find institute'));

            staff['institute'] = institute;
            delete staff['password'];
            console.log('yellow', staff)
            context.res.status(200).send(staff);

        });
    }

    function cloneFunction(source) {
        if (Object.prototype.toString.call(source) === '[object Array]') {
            const clone = [];
            for (let i = 0; i < source.length; i++) {
                clone[i] = cloneFunction(source[i]);
            }
            return clone;
        } else if (typeof (source) === 'object') {
            const clone = {};
            for (const prop in source) {
                if (source.hasOwnProperty(prop)) {

                    if(source.__data){
                        clone[prop] = cloneFunction(source[prop].__data);

                    }else{
                    clone[prop] = cloneFunction(source[prop]);
                    }
                }
            }
            return clone;
        } else {
            return source;
        }
    }


};

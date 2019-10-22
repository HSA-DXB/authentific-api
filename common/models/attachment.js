'use strict';

module.exports = function (Attachment) {

    Attachment.afterRemote('upload', async function (ctx, response, next) {

        let models = Attachment.app.models;

        console.log('container', ctx.args.container);
        console.log('response', JSON.stringify(response));
        console.log('container type', ctx.args.container.toString().split('-')[2]);


        if (ctx.args.container.toString().split('-')[2].includes('candidates')) {
            for (var file in  response.result.files) {

                let fileName = response.result.files[file][0].name;


                let rollNumber = fileName.split('.')[0];
                console.log('roll number', rollNumber)
                let candidate = await Attachment.app.models.Candidate.findOne(
                    {where: {rollNumber: rollNumber}});


                console.log('candidate', candidate)

                candidate.dp=fileName;
                let updatedCandidate = await Attachment.app.models.Candidate.upsert(
                    candidate);
                console.log('updated Candidate', updatedCandidate)


            }


        }


        return;


    });


};

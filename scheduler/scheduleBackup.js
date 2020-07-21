const config = require('./schedule-backup-config');
const schedule = require('node-schedule');

var request = require("request");
const exec = require('child_process').exec;
const fs = require('fs');
const dropboxV2Api = require("dropbox-v2-api");
const dropbox = dropboxV2Api.authenticate({
    token: config.dbaccessToken
});
const dropboxFolder = config.dbfolderName;
const projectName = "authentific-api-oct-19";
const projectId = "5f0416463283479130d71e9e";
// const projectLocation = "/home/shawon/projects/office/authentific/";
const projectLocation = "/var/www/html/";
const DBName = "authentificapi";
const projectPath = projectLocation + projectName
const files = ["client", "cloneFunction", "common", "dev-images", "docker-compose.yml", "index.nginx-debian.html","load-balancer","Makefile","package.json","package-lock.json","README.md","scheduler","__scripts__","server"]


const scheduleBackupJob = () => {
    // schedule.scheduleJob("0 1 * * *", (e) => {
    schedule.scheduleJob("*/1 * * * *", (e) => {
        // updateToDb();
        // return;
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();
        var todaysDate = yyyy + '-' + mm + '-' + dd;


        var projectRequestData = {
            url: config.scheduleBackupProjectUrl + "project/"+projectId,
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        };

        request(projectRequestData, function (error, response) {
            let projectResponse = JSON.parse(response.body)
            console.log(projectResponse)
            
            if(projectResponse && projectResponse.Status=='active'){
                var dir = projectLocation + 'backup/'+projectName;
        if (!fs.existsSync(projectLocation + 'backup')) {
            fs.mkdirSync(projectLocation + 'backup');
        }


        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        var fileList = '';
        files.forEach(element => {
            fileList += projectPath + '/' + element + ' ';
        });

        var zipProject = 'zip -r ' + dir + '/' + projectName+'.zip ' + fileList;
        exec(zipProject, function (error1, stdout1, stderr1) {
            if (error1) {
                console.log(error1);
            } else if (stderr1) {
                console.log(stderr1)
            }
            var dbName = DBName;

            var dbPath = dir + '/' + dbName + '.json';
            var dbDownload = 'mongodump -d ' + dbName + ' -o ' + dbPath;
            exec(dbDownload, function (error, stdout, stderr) {
                if (error) {
                    console.log(error);
                } else if (stderr) {
                    console.log(stderr)
                }
                uploadToDropbox(projectName,todaysDate);
            });
        });
            }
        })

        
    })
}

var uploadToDropbox=(fileName,folderName)=>{
    var zipPath = projectLocation+'/backup/';
    var zipProject = 'zip -r '+zipPath+fileName+'.zip '+zipPath+fileName;

    console.log(zipProject)
    exec(zipProject, function(error1, stdout1, stderr1) {
        if(error1){
            console.log(error1);
        }
        else if(stderr1){
            console.log(stderr1)
        }
        dropbox(
            {
                resource: "files/upload",
                parameters: {
                    path:
                        "/"+dropboxFolder+"/"+folderName+"/"+fileName+".zip"
                },
                readStream: fs.createReadStream(zipPath+fileName+".zip")
            },
            (err, result, response) => {
                // if (err) throw new Error(err);

                console.log(result);
                var removeProject = 'rm -r '+zipPath+'/*';
                exec(removeProject, function(error1, stdout1, stderr1) {
                    console.log("deleted")
                    updateToDb()
                })
            }
        );
    });
}


const updateToDb = () => {
    try {
        var Project = projectId;
        var Status = true;

        var data = {
            url: config.scheduleBackupProjectUrl + "schedule-backup",
            body: JSON.stringify({ Project: Project, Status: Status }),
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        };
        request(data, function (error, response) {
            console.log(response);
        });
    } catch (e) {
        console.log(e);
    }
}


module.exports = scheduleBackupJob

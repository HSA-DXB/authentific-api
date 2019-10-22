const path = require('path');

// import app
const server = require(path.resolve(__dirname, '../server/server.js'));
// ref to our datasource
const myDb = server.dataSources.mongoDB;
// loopback model tables
const BASE = ['User','Company','Project','Milestone','Office','Skill','Work', 'AccessToken', 'ACL', 'RoleMapping', 'Role'];
// defined custom models -> ADD custom
const CUSTOM = [];
const lbTables = [].concat(BASE, CUSTOM);
// cylce to create
myDb.automigrate(lbTables, function (err) {
  if (err) { throw err; }
  console.log(' ');
  console.log('Tables [' + lbTables + '] reset in ' + myDb.adapter.name);
  console.log(' ');
  myDb.disconnect();
  process.exit(0);
});

var fs = require('fs');
var os = require('os');
var path = require('path');

//--exports
module.exports.id = 'f2ccf261-e498-4b21-b49b-805610d5ca94';
module.exports.title = 'write foobar to temp';
module.exports.time = '1383778065648';

const filename = path.join(os.tmpDir(), 'flok_down_test.foobar');

//--migrate function
module.exports.up = function up(mig, flok, done) {
  //code to migrate
  fs.writeFile(filename, 'baz', done);
};


//--backout function
module.exports.down = function down(mig, flok, done) {
  //code to reverse a migration
  fs.unlink(filename, done);
};

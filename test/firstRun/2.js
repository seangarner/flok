module.exports.id = '2';
module.exports.title = 'second migration';
module.exports.time = 2;
module.exports.flokVersion = '2';


module.exports.up = function up(mig, flok, done) {
  global.__flokFirstRun[1] = flok.firstRun;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__flokFirstRun[1] = flok.firstRun;
  done();
};

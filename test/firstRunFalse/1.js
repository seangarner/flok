module.exports.id = '1';
module.exports.title = 'first migration';
module.exports.time = 1;
module.exports.flokVersion = '2';


module.exports.up = function up(mig, flok, done) {
  global.__flokFirstRun[0] = flok.firstRun;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__flokFirstRun[0] = flok.firstRun;
  done();
};

module.exports.id = 'dd76c76d-2533-492d-b7c7-1e3f07a28d4e';
module.exports.title = 'First in order, no deps, time of 1';
module.exports.time = 1;

module.exports.up = function up(mig, flok, done) {
  global.__flokfirst = 1;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__flokfirst = 0;
  done();
};
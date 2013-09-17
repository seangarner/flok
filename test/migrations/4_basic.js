module.exports.id = '9f2b0b60-1606-11e3-a6da-378f8e25a88f';
module.exports.title = 'basic with no deps and time of 4';
module.exports.time = 4;

module.exports.up = function up(mig, flok, done) {
  global.__floktest = 1;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__floktest = 0;
  done();
};

module.exports.custom_property = 'because we support this';
module.exports.id = '4';
module.exports.title = '4';
module.exports.time = 4;

module.exports.up = function up(mig, flok, done) {
  global.__floktest = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__floktest = 0;
  setTimeout(done, 10);
};

module.exports.custom_property = 'because we support this';
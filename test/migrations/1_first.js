module.exports.id = '1';
module.exports.title = '1 ()';
module.exports.time = 1;
module.exports.flokVersion = '2';

module.exports.up = function up(mig, flok, done) {
  global.__flokfirst = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__flokfirst = 0;
  setTimeout(done, 10);
};

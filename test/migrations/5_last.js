module.exports.id = '5';
module.exports.title = '5';
module.exports.time = 5;

module.exports.up = function up(mig, flok, done) {
  global.__floklast = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__floklast = 0;
  setTimeout(done, 10);
};
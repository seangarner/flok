module.exports.id = 'bb40c363-5e61-423c-a01d-0f7c82a626a7';
module.exports.title = 'Last in order, no deps, time of 5';
module.exports.time = 5;

module.exports.up = function up(mig, flok, done) {
  global.__floklast = 1;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__floklast = 0;
  done();
};
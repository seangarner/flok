module.exports.id = 'basic';
module.exports.title = 'basic';
module.exports.time = 1;

module.exports.up = function up(mig, flok, done) {
  global.__floktest = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__floktest = 0;
  setTimeout(done, 10);
};
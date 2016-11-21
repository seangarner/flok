module.exports.id = '2';
module.exports.title = '2 (4)';
module.exports.time = 2;
module.exports.flokVersion = '2';
module.exports.dependencies = [
  '4'
];

module.exports.up = function up(mig, flok, done) {
  global.__flokdep2 = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__flokdep2 = 0;
  setTimeout(done, 10);
};

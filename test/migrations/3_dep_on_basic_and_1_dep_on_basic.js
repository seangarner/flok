module.exports.id = '3';
module.exports.title = '3 (4,2)';
module.exports.time = 3;
module.exports.flokVersion = '2';
module.exports.dependencies = [
  '4',
  '2'
];

module.exports.up = function up(mig, flok, done) {
  global.__flokdep1 = 1;
  setTimeout(done, 10);
};

module.exports.down = function down(mig, flok, done) {
  global.__flokdep1 = 0;
  setTimeout(done, 10);
};

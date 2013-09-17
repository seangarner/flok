module.exports.id = '3d3b2c86-7e17-4541-ad8f-b52ee002ab71';
module.exports.title = 'Depend on "basic" with time of 2';
module.exports.time = 2;
module.exports.dependencies = [
  '9f2b0b60-1606-11e3-a6da-378f8e25a88f'
]

module.exports.up = function up(mig, flok, done) {
  global.__flokdep2 = 1;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__flokdep2 = 0;
  done();
};
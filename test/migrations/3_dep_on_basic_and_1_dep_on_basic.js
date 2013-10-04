module.exports.id = 'efccaf11-6f9b-4ab4-9f24-54ac478bff81';
module.exports.title = 'Depend on "basic" and "dep_on_basic" with time of 3';
module.exports.time = 3;
module.exports.dependencies = [
  '9f2b0b60-1606-11e3-a6da-378f8e25a88f',
  '3d3b2c86-7e17-4541-ad8f-b52ee002ab71'
];

module.exports.up = function up(mig, flok, done) {
  global.__flokdep1 = 1;
  done();
};

module.exports.down = function down(mig, flok, done) {
  global.__flokdep1 = 0;
  done();
};
var fs = require('fs');
var path = require('path');

// obtains a run lock for migrations
module.exports.lock = function lock(done) {

  var lockFile = this.lockFile || path.resolve('migrations/flok.lock');

  // check if it exists
  if (fs.existsSync(lockFile)) {
    return done(new Error('lock already exists'));
  }

  // write pid into the lockfile
  // - should be this, but not working in 0.8
  // fs.writeFileSync(lockFile, process.pid + '', {
  //   mode: parseInt('0640', 8)
  // });
  fs.writeFileSync(lockFile, process.pid + '');
  fs.chmodSync(lockFile, parseInt('0640', 8));

  // paranoia++
  if (!fs.existsSync(lockFile)) {
    return done(new Error('lockfile absent after being written'));
  }

  this.log.info('locked with pid %s', process.pid);

  process.nextTick(function () {
    done(null, true);
  });
};

module.exports.unlock = function unlock(done) {

  var lockFile = this.lockFile || path.resolve('migrations/flok.lock');

  // check if it exists
  if (!fs.existsSync(lockFile)) {
    return done(new Error('lockfile does not exist to be removed'), false);
  }

  // delete lock
  fs.unlinkSync(lockFile);

  // paranoia++
  if (fs.existsSync(lockFile)) {
    return done(new Error('lockfile still present after being removed'), false);
  }

  process.nextTick(function () {
    done(null, true);
  });
};

var fs = require('fs');
var uuid = require('mout/random/guid');

var flokme = require('./flok');
var flok = flokme('migrations');

function lockFile() {
  return '/tmp/_flok_test_' + uuid();
}

function removeLock() {
  fs.unlinkSync(flok.lockFile);
}

function touchLock(filename) {
  flok.lockFile = filename;
  fs.writeFileSync(filename, process.pid + '');
}

describe('lock-file', function () {

  describe('lock', function () {

    var lockEmitted;
    before(function () {
      flok.on('lock', function () {
        lockEmitted++;
      });
    });

    it('should create a lockfile', function (done) {
      flok.lockFile = lockFile();
      flok._lock(done);
    });

    it('should throw an error when the lockfile exists already', function (done) {
      touchLock(lockFile());
      flok._lock(function (err) {
        err.should.be.instanceof(Error);
        err.message.should.include('lock already exists');
        done();
        removeLock();
      });
    });

    it('should emit lock when successful', function (done) {
      lockEmitted = 0;
      flok.lockFile = lockFile();
      flok._lock(function () {
        process.nextTick(function () {
          lockEmitted.should.equal(1);
          done();
        });
      });
    });

    it('should not emit lock on error', function (done) {
      var unlockEmitted = 0;
      touchLock(lockFile());
      flok._lock(function () {
        process.nextTick(function () {
          unlockEmitted.should.equal(0);
          done();
          removeLock();
        });
      });
    });

  });

  describe('unlock', function () {

    var unlockEmitted;
    before(function () {
      flok.on('unlock', function () {
        unlockEmitted++;
      });
    });

    it('should remove a lockfile', function (done) {
      touchLock(lockFile());
      flok._unlock(done);
    });

    it('should throw an error when the lockfile does not exist', function (done) {
      flok.lockFile = lockFile();
      flok._unlock(function (err) {
        err.should.be.instanceof(Error);
        err.message.should.include('lockfile does not exist to be removed');
        done();
      });
    });

    it('should emit unlock when successful', function (done) {
      unlockEmitted = 0;
      touchLock(lockFile());
      flok._unlock(function (err) {
        if (err) return done(err);
        process.nextTick(function () {
          unlockEmitted.should.equal(1);
          done();
        });
      });
    });

    it('should not emit unlock on error', function (done) {
      unlockEmitted = 0;
      flok.lockFile = lockFile();
      flok._unlock(function () {
        process.nextTick(function () {
          unlockEmitted.should.equal(0);
          done();
        });
      });
    });

  });

});
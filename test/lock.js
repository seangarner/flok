var nixt = require('nixt');
var path = require('path');
var fs = require('fs');

const FLOK = path.join(__dirname, '..', 'bin/flok');
const TEST = path.join(__dirname, '..', 'test');

const FLOK_LOCK = FLOK + ' lock --migrations ' + path.join(TEST, 'lock');

const PIDFILE = path.join(TEST, 'lock', 'flok.lock');
const PID = '1234';

function lock() {
  fs.writeFileSync(PIDFILE, PID);
}

function unlock() {
  fs.unlinkSync(PIDFILE);
}

function tryUnlock() {
  try {
    unlock();
  } catch (e) {
    // do nothing
  }
}

describe('lock', function () {
  this.slow(1000);
  this.timeout(3000);

  describe('when locked', function () {

    it('writes a message to stderr', function (done) {
      nixt()
        .before(lock)
        .after(unlock)
        .run(FLOK_LOCK + ' -y')
        .stderr('ERROR locking: lock already exists')
        .end(done);
    });

    it('exits with status 1', function (done) {
      nixt()
        .before(lock)
        .after(unlock)
        .run(FLOK_LOCK + ' -y')
        .code(1)
        .end(done);
    });

  });

  describe('when unlocked', function () {

    it('writes a message to stdout', function (done) {
      nixt()
        .before(tryUnlock)
        .after(unlock)
        .run(FLOK_LOCK + ' -y')
        .stdout(/locked with pid \d+/)
        .end(done);
    });

    it('exits with status 0', function (done) {
      nixt()
        .before(tryUnlock)
        .after(unlock)
        .run(FLOK_LOCK + ' -y')
        .code(0)
        .end(done);
    });

  });

  describe('with --unlock', function () {

    describe('when locked', function () {

      it('writes a message to stdout', function (done) {
        nixt()
          .before(lock)
          .after(tryUnlock)
          .run(FLOK_LOCK + ' --clear -y')
          .stdout('')
          .end(done);
      });

      it('exits with status 0', function (done) {
        nixt()
          .before(lock)
          .after(tryUnlock)
          .run(FLOK_LOCK + ' --clear -y')
          .code(0)
          .end(done);
      });

    });

    describe('when unlocked', function () {

      it('writes a message to stderr', function (done) {
        nixt()
          .before(tryUnlock)
          .after(tryUnlock)
          .run(FLOK_LOCK + ' --clear -y')
          .stderr('ERROR removing lock: lockfile does not exist to be removed')
          .end(done);
      });

      it('exits with status 1', function (done) {
        nixt()
          .before(tryUnlock)
          .after(tryUnlock)
          .run(FLOK_LOCK + ' --clear -y')
          .code(1)
          .end(done);
      });

    });

  });

});
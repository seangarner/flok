var nixt = require('nixt');
var path = require('path');
var fs = require('fs');
var os = require('os');

const FLOK = path.join(__dirname, '..', 'bin/flok');
const TEST = path.join(__dirname, '..', 'test');

function flok(migDir) {
  return nixt().base(FLOK + ' up --migrations ' + path.join(TEST, migDir));
}

const PIDFILE = path.join(TEST, 'lock', 'flok.lock');
const PID = '1234';

function lock() {
  fs.writeFileSync(PIDFILE, PID);
}

function unlock() {
  fs.unlinkSync(PIDFILE);
}


var tmpFile = path.join(os.tmpDir(), 'flok_up_test.foobar');
var statusFile = path.join(TEST, 'up', 'flokStatus', 'f2ccf261-e498-4b21-b49b-805610d5ca94.json');

function cleanUp() {
  try { fs.unlinkSync(tmpFile); } catch (e) {}
  try { fs.unlinkSync(statusFile); } catch (e) {}
}

describe('up', function () {
  this.slow(1000);
  this.timeout(3000);

  it('should write the test file in tmp', function (done) {
    flok('up')
      .run('')
      .match(tmpFile, 'baz')
      .after(cleanUp)
      .end(done);
  });

  it('should exit with status 0', function (done) {
    flok('up')
      .run('')
      .code(0)
      .after(cleanUp)
      .end(done);
  });

  it('should write success message to console', function (done) {
    flok('up')
      .run('')
      .stdout(/up on \[write foobar to temp\] completed successfully/)
      .end(done);
  });

  it('should only apply migrations once', function (done) {
    flok('up')
      .run('')
      .code(0)
      .stdout(/0 of 1 migrations pending up execution/)
      .after(cleanUp)
      .end(done);
  });

  describe('when locked', function () {

    it('should write a message to stderr', function (done) {
      flok('lock')
        .run('')
        .before(lock)
        .after(unlock)
        .stderr('ERROR migrating up: lock already exists')
        .end(done);
    });

    it('should exit with status 1', function (done) {
      flok('lock')
        .run('')
        .before(lock)
        .after(unlock)
        .run('')
        .code(1)
        .end(done);
    });

  });

  describe('when blocked', function () {

    it('should write a message to stderr', function (done) {
      flok('show')
        .run('')
        .stderr('ERROR migrating up: lock already exists')
        .end(done);
    });

    it('should exit with status 1', function (done) {
      flok('show')
        .run('')
        .code(1)
        .end(done);
    });

  });

});
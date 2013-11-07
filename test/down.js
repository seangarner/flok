var nixt = require('nixt');
var path = require('path');
var fs = require('fs');
var os = require('os');

const FLOK = path.join(__dirname, '..', 'bin/flok');
const TEST = path.join(__dirname, '..', 'test');

var status = '{"id":"f2ccf261-e498-4b21-b49b-805610d5ca94","title":"write foobar to temp","runMet' +
             'hod":"up","signature":"12a2a6ee764a3c813f609aefcb018f97","runTime":"2013-11-07T18:0' +
             '4:54.560Z","error":null,"flokVersion":"0.5.0"}';

function flok(migDir) {
  return nixt().base(FLOK + ' down --migrations ' + path.join(TEST, migDir));
}

function lock() {
  fs.writeFileSync(path.join(TEST, 'down', 'flok.lock'), '1234');
}

function unlock() {
  fs.unlinkSync(path.join(TEST, 'down', 'flok.lock'));
}

var tmpFile = path.join(os.tmpDir(), 'flok_down_test.foobar');
var statusFile = path.join(TEST, 'down', 'flokStatus', 'f2ccf261-e498-4b21-b49b-805610d5ca94.json');

function cleanUp() {
  try { unlock('down'); } catch (e) {}
  try { fs.unlinkSync(tmpFile); } catch (e) {}
  try { fs.unlinkSync(statusFile); } catch (e) {}
  try { fs.rmdirSync(path.dirname(statusFile)); } catch (e) {}
}

describe('down', function () {
  this.slow(1000);
  this.timeout(3000);

  after(cleanUp);

  it('should remove the test file in tmp', function (done) {
    flok('down')
      .before(cleanUp)
      .writeFile(tmpFile, 'bar')
      .mkdir(path.dirname(statusFile))
      .writeFile(statusFile, status)
      .run('')
      .expect(function () {
        if (fs.existsSync(tmpFile))
          throw new Error('expected ' + tmpFile + ' to be absent after down');
      })
      .after(cleanUp)
      .end(done);
  });

  it('should exit with status 0', function (done) {
    flok('down')
      .before(cleanUp)
      .writeFile(tmpFile, 'bar')
      .mkdir(path.dirname(statusFile))
      .writeFile(statusFile, status)
      .run('')
      .code(0)
      .after(cleanUp)
      .end(done);
  });

  it('should write success message to console', function (done) {
    flok('down')
      .before(cleanUp)
      .writeFile(tmpFile, 'bar')
      .mkdir(path.dirname(statusFile))
      .writeFile(statusFile, status)
      .run('')
      .stdout(/1 of 1 migrations pending down execution/)
      .stdout(/down on \[write foobar to temp\] completed successfully/)
      .end(done);
  });

  it('should only apply down migration once', function (done) {
    flok('down')
      .run('')
      .code(0)
      .stdout(/0 of 1 migrations pending down execution/)
      .after(cleanUp)
      .end(done);
  });

  describe('when locked', function () {

    it('should write a message to stderr', function (done) {
      flok('down')
        .before(lock)
        .run('')
        .after(unlock)
        .stderr('ERROR migrating down: lock already exists')
        .end(done);
    });

    it('should exit with status 1', function (done) {
      flok('down')
        .before(lock)
        .run('')
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
        .stderr(/ERROR migrating down: found changed migrations/)
        .after(function () {
          try { fs.unlinkSync(path.join(TEST, 'show', 'flok.lock')); } catch (e) {}
        })
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
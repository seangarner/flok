/*jshint expr:true*/

var path = require('path');
var fs = require('fs');
var uuid = require('mout/random/guid');
var typecast = require('mout/string/typecast');

const LOGLEVEL = process.env.LOGLEVEL || 'none';
const PRINTOBJECTS = process.env.LOGO === undefined ? true : typecast(process.env.LOGO);

var flokjs;
var Flok;
var flok;

function lockFile() {
  return '/tmp/_flok_test_' + uuid();
}

function removeLock() {
  fs.unlinkSync(flok.lockFile);
}

function flokme(dir) {
  var flokjs = require('../lib/flok.js');
  var f = new flokjs.Flok({
    migrationsDir: path.join(__dirname, dir),
    lockFile: lockFile()
  });
  var logger = new flokjs.ConsoleLogger({
    level: LOGLEVEL,
    printObjects: PRINTOBJECTS
  });
  f.extend(logger);

  f.extend(require('../lib/lock-file'));
  f.extend(require('../lib/status-file'));

  return f;
}
module.exports = flokme;


describe('Flok', function () {

  before(function () {
    flokjs = require('../lib/flok.js');
    Flok = flokjs.Flok;
  });

  it('should construct', function () {
    Flok.should.be.instanceof(Function);
    flok = new Flok({
      migrationsDir: path.join(__dirname, '/migrations'),
      builtInLock: true,
      builtInStatus: true
    });
    flok.should.be.instanceof(Flok);
    flok.on('lock', function () {
      removeLock();
    });
  });

  describe('extend', function () {
    it('should extend flok functionality with that provided', function () {
      var logger = new flokjs.ConsoleLogger({
        level: LOGLEVEL,
        printObjects: PRINTOBJECTS
      });
      flok.extend(logger);
      flok.log.info.should.equal(logger.log.info);
    });
  });

  describe('loadMigrations', function () {

    it('should load migrations', function (done) {
      flok._loadMigrations(function (err, migrations) {
        if (err) return done(err);
        migrations.should.be.ok;
        migrations.length.should.be.above(0);
        done();
      });
    });

  });


  describe('default sortMigrationsUp', function () {
    it('should sort migrations so dependencies are satisfied first', function (done) {
      flok.sortMigrationsUp(function () {
        flok.migrations[0].time.should.equal(1);
        flok.migrations[1].time.should.equal(4);
        flok.migrations[2].time.should.equal(2);
        flok.migrations[3].time.should.equal(3);
        flok.migrations[4].time.should.equal(5);
        done();
      });
    });
  });


  describe('up', function () {

    it('should work', function (done) {
      var flok = flokme('migrations');
      global.__floktest = 0;
      flok.up(null, function (err, migrations) {
        if (err) return done(err);
        global.__floktest.should.equal(1);
        migrations.should.be.instanceof(Array);
        migrations.length.should.equal(5);
        done();
      });
    });

  });

  describe('down', function () {

    it('should work', function (done) {
      var flok = flokme('migrations');
      global.__floklast = 1;
      global.__flokfirst = 1;
      flok.down(null, function (err, migrations) {
        if (err) return done(err);
        global.__floklast.should.equal(0);
        migrations.should.be.instanceof(Array);
        migrations.length.should.equal(1);
        flok.down(null, function (e2) {
          if (e2) return done(e2);
          flok.down(null, function (e3) {
            if (e3) return done(e3);
            flok.down(null, function (e4) {
              if (e4) return done(e4);
              flok.down(null, function (e5) {
                if (e5) return done(e5);
                global.__flokfirst.should.equal(0);
                done();
              });
            });
          });
        });
      });
    });

  });

});
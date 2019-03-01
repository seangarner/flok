/*jshint expr:true*/

var path = require('path');
var fs = require('fs');
var uuid = require('mout/random/guid');
var typecast = require('mout/string/typecast');
var should = require('should');

var flokjs;
var Flok;
var flok;

const URL = process.env.MONGO_URL || 'mongodb://localhost:27017/flok_testlocale';


function flokme(dir) {

  // TODO remove the temp collections on after
  var flokjs = require('../lib/flok.js');
  var f = new flokjs.Flok({
    migrationsDir: path.join(__dirname, dir),
    mongodbStateColl: `flok_test_${Math.random()}`,
    mongodbLockColl: `flok_test_${Math.random()}`
  });

  f.extend(require('../lib/logger'));
  require('../lib/flok-mongodb').extend(f, {
    mongodbUrl: URL
  });

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
      var logger = require('../lib/logger');
      flok.extend({log: logger});
      flok.log.info.should.equal(logger.info);
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


  describe.skip('up', function () {

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

  describe.skip('firstRun', function () {

    it('should be null before state has been loaded', function () {
      var flok = flokme('firstRun');
      should(flok.firstRun).equal(null);
    });

    it('should be true if no migrations have yet run', function (done) {
      var flok = flokme('firstRun');
      global.__flokFirstRun = [];
      flok.up(null, (err) => {
        if (err) return done(err);
        should(global.__flokFirstRun[0]).equal(true);
        should(global.__flokFirstRun[1]).equal(true);
        done();
      });
    });

    it('should be false if migrations have run', function (done) {
      var flok = flokme('firstRunFalse');
      global.__flokFirstRun = [];
      flok.up(null, (err) => {
        if (err) return done(err);
        should(global.__flokFirstRun[0]).equal(undefined);
        should(global.__flokFirstRun[1]).equal(false);
        done();
      });
    });

  });

  describe.skip('down', function () {

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

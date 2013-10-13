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

function touchLock(filename) {
  flok.lockFile = filename;
  fs.writeFileSync(filename, process.pid + '');
}

function flokme(dir) {
  var f = new Flok({
    migrationsDir: path.join(__dirname, dir),
    builtInLock: true,
    builtInStatus: true,
    lockFile: lockFile()
  });
  var logger = new flokjs.ConsoleLogger({
    level: LOGLEVEL,
    printObjects: PRINTOBJECTS
  });
  f.extend(logger);
  return f;
}


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

  describe('Migration', function () {
    var migration;
    before(function () {
      migration = new flokjs.Migration(__dirname + '/migrations/4_basic.js', flok.log);
    });

    describe('construction', function () {
      it('should mix in all properties exported from the migration file', function () {
        var file = require(__dirname + '/migrations/4_basic.js');
        migration.id.should.equal(file.id);
        migration.title.should.equal(file.title);
        migration.time.should.equal(file.time);
        migration.up.should.equal(file.up);
        migration.down.should.equal(file.down);
        migration.custom_property.should.equal(file.custom_property);
      });
    });

    describe('signature', function () {
      it('should return an md5sum of the migration file', function () {
        migration.signature.should.equal('82a4f55e9274c8ff50dc21672f1eb201');
      });
    });

  });

  describe('loadMigrationsStatus', function () {

    var loadMigrationsStatusEmitted = 0;
    var loadedMigrationStatus = 'foobar';
    before(function () {
      flok.on('loadMigrationsStatus', function (migrations) {
        loadMigrationsStatusEmitted++;
        loadedMigrationStatus = migrations;
      });
    });

    it('should load status', function (done) {
      flok._loadMigrationsStatus(function (err) {
        if (err) return done(err);
        done();
      });
    });

    it('should emit loadMigrationsStatus', function () {
      loadMigrationsStatusEmitted.should.equal(1);
      loadedMigrationStatus.should.be.instanceof(Array);
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

  describe('default lock', function () {

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

  describe('default unlock', function () {

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
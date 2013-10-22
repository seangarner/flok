var fs = require('fs');
var path = require('path');

var flokme = require('./flok');
var flok = flokme('status-file');

var statusPath = path.join(__dirname, 'status-file', 'flokStatus', 'basic.json');

describe('status-file', function () {

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


  describe('clearMigrationStatus', function () {
    var status;

    before(function (done) {
      status = fs.readFileSync(statusPath);
      flok._loadMigrations(function (err) {
        if (err) return done(err);
        flok._loadMigrationsStatus(done);
      });
    });

    after(function () {
      if (status) fs.writeFileSync(statusPath, status);
    });

    it('should remove migration status files', function (done) {

      flok._clearMigrationStatus(flok.migrations[0], function (err) {
        if (err) return done(err);
        fs.existsSync(statusPath).should.equal(false);
        done();
      });
    });
  });

});

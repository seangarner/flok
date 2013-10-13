var fs = require('fs');
var path = require('path');
var async = require('async');
var slugify = require('mout/string/slugify');

// gets a list of already applied migrations
module.exports.loadMigrationsStatus = function loadMigrationsStatus(done) {
  var self = this;
  var p = this.migrationStatusDir || path.join(this.migrationsDir, 'flokStatus');

  this.log.debug('loading migration status files from %s', p);

  async.auto({
    //-- read files & dirs in p
    readdir: function (callback) {
      self.log.trace('looking for status files in %s', p);
      if (!fs.existsSync(p)) fs.mkdirSync(p);
      fs.readdir(p, function (err, fods) {
        if (err && err.name === 'ENOENT') {
          self.log.info('migration status directory does not exist and will be created');
          fs.mkdir(p, {mode: parseInt('0750', 8)}, function (e) {
            if (e) {
              return callback(new Error('could not create migration status dir: ' + e.message));
            } else {
              return callback(null, []);
            }
          });
        } else if (err) {
          return callback(err);
        }
        if (!fods) fods = [];
        self.log.debug('found %s items in %s to be scanned for migration status', fods.length, p);
        callback(null, fods);
      });
    },

    //-- get just files
    files: ['readdir', function (callback, res) {
      self.log.trace('scanning items found in %s for files', p);
      var files = [];

      // for each file or directory stat and
      async.each(res.readdir, function (fod, cb) {
        // only push files
        fs.stat(path.join(p, fod), function (err, stats) {
          if (err) return cb(err);
          if (stats.isFile()) {
            self.log.trace('adding %s to status file list', fod);
            files.push(fod);
          }
          cb();
        });
      }, function (err) {
        // send on collected files
        callback(err, files);
      });
    }],

    //-- read in files
    status: ['files', function (callback, res) {
      var status = [];
      // load each file as a Migration
      res.files.forEach(function (file) {
        self.log.trace('loading migration status from %s', file);
        status.push(require(path.join(p, file)));
      });
      callback(null, status);
    }]
  },
  function (err, res) {
    if (err) return done(err);

    self.log.debug('loaded %s migration status files', res.status.length);
    done(null, res.status);
  });
};


module.exports.saveMigrationStatus = function saveMigrationStatus(status, migration, done) {
  // get directory of status files
  var p = this.migrationStatusDir || path.join(this.migrationsDir, 'flokStatus');
  if (!fs.existsSync(p)) fs.mkdirSync(p);

  // add status filename to directory
  p = path.join(p, slugify(migration.id)) + '.json';

  status = JSON.stringify(status);

  this.log.debug({path: p, status: status}, 'writing migration status file to %s', p);

  //TODO: find out from when setting mode was possible as not working on 0.8 because of encoding
  // fs.writeFileSync(p, status, {
  //   encoding: 'utf8',
  //   mode: parseInt('0640', 8)
  // });
  fs.writeFileSync(p, status);
  fs.chmodSync(p, parseInt('0640', 8));

  process.nextTick(function () {
    done(null);
  });
};
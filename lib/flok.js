var util = require('util');
var events = require('events');
var path = require('path');
var fs = require('fs');
var os = require('os');
var async = require('async');
// var toposort = require('toposort');
var mixIn = require('mout/object/mixIn');
var isPlainObject = require('mout/lang/isPlainObject');
var isFunction = require('mout/lang/isFunction');
var pluck = require('mout/object/pluck');
var arrPluck = require('mout/array/pluck');
var collpluck = require('mout/collection/pluck');
var toLookup = require('mout/array/toLookup');
var filter = require('mout/collection/filter');
var isString = require('mout/lang/isString');
var collect = require('mout/array/collect');
var get = require('mout/object/get');
var partial = require('mout/function/partial');
var slugify = require('mout/string/slugify');
var guid = require('mout/random/guid');

var Migration = require('./migration');
module.exports.Migration = Migration;
module.exports.ConsoleLogger = require('./console-logger');

const VERSION = require('../package.json').version;

/**
 * Utility function to sort an array of objects by a single property of each object
 *
 * @api private
 */
function sortCollectionByProp(coll, prop) {
  return coll.sort(function (aO, bO) {
    var a = get(a, prop);
    var b = get(b, prop);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
};


/**
 * ## Flok Constructor
 */
function Flok(o) {
  if (isPlainObject(o)) mixIn(this, o);

  if (!this.migrationsDir) this.migrationsDir = path.resolve('migrations');

  this.migrations = [];
  this._status = [];
  this._mdw = [];

  events.EventEmitter.call(this);
}
util.inherits(Flok, events.EventEmitter);
module.exports.Flok = Flok;

/**
 * By default logging does nothing
 */
function noop() {}
Flok.prototype.log = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  alert: noop,
  fatal: noop
};
//TODO: make extending log different so it allows multiple loggers to be attached at once

/**
 * Utility function to execute a method on flok or migrate in the safest manner possible,
 * handle logging and emit an event on flok
 *
 * @api private
 */
Flok.prototype._run = function _run(context, method, args, done) {
  var self = this;
  var fired = false;
  if (!args) args = [];
  var name = method.name || 'unknown method';

  if (!method.name)
    this.log.warn({stack: (new Error()).stack}, 'Flok._run called with unnamed method');

  // add our done function to the arguments list
  args.push(function runDone(err) {
    // make sure an exception later doesn't call done twice
    if (fired) {
      self.log.warn({err: err}, 'callback for %s already fired', name);
      return;
    }
    fired = true;

    // coerce arguments into a real array
    var a = Array.prototype.slice.call(arguments, 0);
    // emit relevant event when not an error
    var errored = Boolean(a[0] instanceof Error);
    if (!errored && method.name !== '') {
      self.log.trace('emitting %s', name);

      // modify arguments replacing error with the name of the function
      var t = a.slice(1);
      t.unshift(name);

      // emit the event using the callbacks function name as the event name
      self.emit.apply(self, t);
    }
    // fire the callback with all arguments
    done.apply(context, a);
  });

  // execute the method
  try {
    self.log.trace('calling %s', name);
    method.apply(context, args);
  } catch (err) {
    if (fired) {
      self.log.warn(err, 'exception in %s after callback fired', name);
      return;
    }
    fired = true;
    self.log.error(err, 'exception encountered running %s: %s', name, err.message);
    process.nextTick(function () { done(err); });
  }
}

/**
 * Extend the flok object with a new Class or plain object
 */
Flok.prototype.extend = function extend(obj) {
  mixIn(this, obj);
  this.log.debug('extended flok with', obj.constructor.name);
  this.log.trace('extended properties:', Object.keys(obj).join(', '));
  this.emit('extend', obj);
};

/**
 * Register a middleware which gets called before up/down on each migration
 */
Flok.prototype.use = function use(fn) {
  this._mdw.push(fn);
  this.log.debug('registered middleware with', fn.name || 'anon function');
  return this;
};

// upgrade to a specific timestamp, or all
Flok.prototype.up = function up(ts, done) {
  var self = this;
  async.auto({
    lock: function (callback) {
      self._lock(callback);
    },

    migrations: ['lock', function (callback) {
      self._loadMigrations(callback);
    }],

    migrationStatus: ['migrations', function (callback) {
      self._loadMigrationsStatus(callback);
    }],

    sortMigrations: ['migrationStatus', function (callback) {
      self._sortMigrations(false /*ascending*/, callback);
    }],

    changedMigrations: ['sortMigrations', function (callback) {
      self.checkChangedMigrations(callback);
    }],

    blockedMigrations: ['changedMigrations', function (callback) {
      self.checkBlockedMigrations(callback);
    }],

    executeMigrations: ['blockedMigrations', function (callback) {
      var migrations = filter(self.migrations, 'isPending');
      self._executeMigrations(migrations, '_up', callback);
    }],

    unlock: ['executeMigrations', function (callback) {
      self._unlock(callback);
    }]
  },
  function (err, res) {
    if (err) self.log.fatal(err, 'fatal error attempting up migration; aborting');
    done(err, res.executeMigrations);
  });
};

Flok.prototype.down = function down(ts, done) {
  var self = this;
  async.auto({
    lock: function (callback) {
      self._lock(callback);
    },

    migrations: ['lock', function (callback) {
      self._loadMigrations(callback);
    }],

    migrationStatus: ['migrations', function (callback) {
      self._loadMigrationsStatus(callback);
    }],

    sortMigrations: ['migrationStatus', function (callback) {
      self._sortMigrations(true /*descending*/, callback);
    }],

    changedMigrations: ['sortMigrations', function (callback) {
      self.checkChangedMigrations(callback);
    }],

    blockedMigrations: ['changedMigrations', function (callback) {
      self.checkBlockedMigrations(callback);
    }],

    executeMigrations: ['blockedMigrations', function (callback) {
      var migration = filter(self.migrations, 'isDone').pop();
      self._executeMigrations([migration], '_down', callback);
    }],

    unlock: ['executeMigrations', function (callback) {
      self._unlock(callback);
    }]
  },
  function (err, res) {
    if (err) self.log.fatal(err, 'fatal error attempting up migration; aborting');
    done(err, res.executeMigrations);
  });
};

// load migration files and status for informational use
Flok.prototype.load = function load(done) {
  var self = this;
  async.auto({
    migrations: function (callback) {
      self._loadMigrations(callback);
    },
    migrationStatus: ['migrations', function (callback) {
      self._loadMigrationsStatus(callback);
    }],
    sortMigrations: ['migrationStatus', function (callback) {
      self._sortMigrations(false /*ascending*/, callback);
    }]
  },
  function (err, res) {
    if (err) self.log.fatal(err, 'fatal error loading migrations');
    done(err, self.migrations);
  });
};

Flok.prototype._sortMigrations = function _sortMigrations(desc, callback) {
  try {
    this.sortMigrations(desc);
  } catch (e) {
    e.message = 'error sorting migrations: ' + e.message;
    return callback(e);
  }
  callback(null);
};

function dependencyEdges(m) {
  if (!m.dependencies || !(m.dependencies instanceof Array) || m.dependencies.length < 1 )
    return;

  return m.dependencies.map(function (d) {
    return [m.id, d]; // [my id, dependency id]
  });
}
Flok.prototype.sortMigrations = function(desc) {
  //TODO: sort migrations based on dependencies
  this.migrations.sort(function (a, b) {
    return a.time - b.time;
  });
  // var edges = collect(this.migrations, dependencyEdges);
  // var sortedIds = toposort(edges).reverse();

  // this.migrations.sort(function (a, b) {

  //   //TODO, SORT ONLY WORKS IF THERE'S A FULL DEPENDENCY CHAIN, DOES NOT YET MERGE IN TIME
  //   return sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id);
  // });
};

Flok.prototype.checkChangedMigrations = function checkChangedMigrations(callback) {
  var changed = filter(this.migrations, 'isChanged');
  this.log.debug('checking for changed migrations and found %s', changed.length);
  if (changed.length > 0) {
    for (var i = 0; i < changed.length; i++) {
      var m = changed[i];
      this.log.error(m.status,
                     'signature changed since %s: %s %s',
                     m.title,
                     m.id,
                     new Date(m.status.runTime)
                     );
    }
    this.log.fatal('found %s migration%s already run whose signature has since changed',
                   changed.length,
                   changed.length > 1 ? 's' : ''
                   );
    this.log.warn('you need to clear changed migrations before continuing');
    return callback(new Error('found changed migrations'), changed);
  }
  callback(null, []);
};

Flok.prototype.checkBlockedMigrations = function checkBlockedMigrations(callback) {
  var blocked = filter(this.migrations, 'isProblem');
  this.log.debug('checking for blocked migrations and found %s', blocked.length);
  if (blocked.length > 0) {
    for (var i = 0; i < blocked.length; i++) {
      var m = blocked[i];
      this.log.error(m.status,
                     'migration blocked (%s), last error: %s, reason: %s',
                     m.title,
                     new Date(m.status.runTime),
                     m.status.error.message || 'unknown'
                     );
    };
    this.log.fatal('found %s blocked migration%s',
                   blocked.length,
                   blocked.length > 1 ? 's' : ''
                   );
    this.log.warn('you need to clear blocked migrations before continuing');
    return callback(new Error('found blocked migrations'), blocked);
  }
  callback(null, []);
};

Flok.prototype._loadMigrations = function _loadMigrations(done) {
  var self = this;
  this._run(this, this.loadMigrations, [], function (err, migrations) {
    if (err) done(err);
    migrations.sort(function (a, b) {
      return a.status.runTime - b.status.runTime;
    });
    self.migrations = migrations;
    self._migrationsLookup = toLookup(migrations, 'id');
    done(null, migrations);
  });
};

// load migration files from disk
Flok.prototype.loadMigrations = function loadMigrations(done) {
  var migrationsDir = this.migrationsDir;
  var self = this;

  async.auto({

    verifyMigrationsDir: function (callback) {
      if (!fs.existsSync(migrationsDir))
        callback(new Error('no directory found at ' + migrationsDir));
        else callback(null);
    },

    //-- read files & dirs in migrationsDir
    readdir: ['verifyMigrationsDir', function (callback) {
      self.log.trace('looking for migrations in %s', migrationsDir);
      fs.readdir(migrationsDir, function (err, fods) {
        if (err) return callback(err);
        if (!fods || fods.length < 1)
          return callback(new Error('no migrations found in ' + migrationsDir));
        self.log.trace('found %s items in %s to be scanned for migrations', fods.length,
                       migrationsDir);
        callback(null, fods);
      });
    }],

    //-- get just files in migrationsDir
    files: ['readdir', function (callback, res) {
      self.log.trace('scanning items found in %s for files', migrationsDir);
      var files = [];
      // for each file or directory stat and
      async.each(res.readdir, function (fod, cb) {
        // only push files
        var filename = path.join(migrationsDir, fod);
        fs.stat(filename, function (err, stats) {
          if (err) return cb(err);
          if (stats.isFile() && fod.match(/\.js$/) ) {
            self.log.trace('adding %s to migrations file list', filename);
            files.push(filename);
          }
          cb();
        });
      }, function (err) {
        // send on collected files
        callback(err, files);
      });
    }],

    //-- load files and create Migration objects
    migrations: ['files', function (callback, res) {
      var migrations = [];
      // load each file as a Migration
      res.files.forEach(function (file) {
        self.log.trace('loading migration from %s', file);
        var m = new Migration(file, self.log);
        migrations.push(m);
      });
      callback(null, migrations);
    }]
  },
  function (err, res) {
    if (err) return done(err);

    self.log.debug('loaded %s migrations from %s', res.migrations.length, migrationsDir);
    done(null, res.migrations);
  });
};


// obtains a run lock for migrations
Flok.prototype.lock = function lock(done) {

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

Flok.prototype.dequeue = function dequeue(pendingMigrations, callback) {
  //TODO: if we dont do dependencies using sorting then do it here using mout/array/find
  callback(null, pendingMigrations.shift());
};


Flok.prototype._executeMigrations = function _executeMigrations(pending, method, doneAll) {
  var self = this;
  var executedMigrations = [];
  var logMethod = method.replace(/^_/, '');
  var errored = false;

  this.log.info('%s of %s migrations pending %s execution', pending.length, this.migrations.length,
                logMethod);

  if (pending.length < 1) return process.nextTick(function () { doneAll(null, []); });

  async.whilst(
    function whilstPending() {
      self.log.debug('%s migrations pending %s execution', pending.length, logMethod);
      return errored ? false : pending.length > 0;
    },
    function doExecute(doneOne) {
      async.auto({
        migration: function (cb) {
          self._run(self, self.dequeue, [pending], function (err, m) {
            if (err) return cb(err);
            self.log.info({id: m.id}, 'executing %s on [%s]', logMethod, m.title);
            cb(err, m);
          });
        },
        middleware: ['migration', function (cb, res) {
          var m = res.migration;
          executedMigrations.push(m);
          function runMdw(mdw, mdwCb) {
            self.log.trace({migrationId: m.id}, 'executing middleware: %s ', mdw.name);
            self._run(m, mdw, [m, self], mdwCb);
          }
          async.eachSeries(self._mdw, runMdw, cb);
        }],
        method: ['middleware', function (cb, res) {
          var m = res.migration;
          self._run(m, m[method], [m, self], cb);
        }]
      },
      function (err, res) {
        var m = res.migration;
        if (err) {
          errored = true;
          self.log.error(err, 'error executing %s on [%s]: %s', method, m.title, err.message);
        } else {
          self.log.info({id: m.id, status: m.status},
                        '%s on [%s] completed successfully',
                        logMethod,
                        m.title);
        }

        self._saveMigrationStatus(err, m, function (saveErr) {
          // prefer sending back the save error before the migration error
          doneOne(saveErr || err);
        });
      });
    },
    function whenWhileDone(err) {
      doneAll(err, executedMigrations);
    }
  );
};

Flok.prototype.unlock = function unlock(done) {

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


Flok.prototype._loadMigrationsStatus = function _loadMigrationsStatus(done) {
  var self = this;
  this._run(this, this.loadMigrationsStatus, [], function (err, status) {
    if (err) return done(err);

    var lookup = toLookup(status, 'id');

    for (var i = 0; i < self.migrations.length; i++) {
      var m = self.migrations[i];
      if (lookup[m.id]) m.status = lookup[m.id];
    }

    self._status = status;

    done(null, lookup);
  });
};


// gets a list of already applied migrations
Flok.prototype.loadMigrationsStatus = function loadMigrationsStatus(done) {
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

function errToObj(err) {
  if (!err) return null;

  // cast strings to Error
  if (isString(err)) err = new Error(err);

  // we want inumerable properties of an Error
  if (err instanceof Error) {
    var e = {
      message: err.message,
      stack: err.stack,
      name: err.name
    };
    Object.keys(err).forEach(function (key) {
      e[key] = err[key];
    });
    return e;
  }

  return err;
}

Flok.prototype._saveMigrationStatus = function _saveMigrationStatus(err, migration, done) {
  var self = this;

  // let Migration work out its own status
  var status = migration.getStatus();

  status.flokVersion = VERSION;

  if (err) status.error = errToObj(err);

  //TODO: check we have required status
  this._run(this, this.saveMigrationStatus, [status, migration], function (e) {
    if (e) {
      //TODO: write test for saving migration status fallback
      var f = path.join(os.tmpDir(), 'flok_status_dump_' + guid()) + '.json';
      var c = JSON.stringify(status);
      self.log.fatal(e,
                     '!!UNABLE TO SAVE RESULT OF MIGRATION!! (%s) status dumped to %s',
                     e.message,
                     f);
      self.log.warn('if this migration was not idempotent you must manually update the'
                    + ' status source');
      try {
        fs.writeFileSync(f, c);
      } catch (writeE) {
        self.log.error(writeE, 'error saving status dump file; next message will contain status');
        self.log.error(c);
      }
    }
    done(e);
  });

};


Flok.prototype.saveMigrationStatus = function saveMigrationStatus(status, migration, done) {
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


/**
 * Wrap methods that may be overwritten in order to preserve common error handling and logging
 */
Flok.prototype._lock = function _lock(done) {
  this._run(this, this.lock, [], done);
};
Flok.prototype._unlock = function _unlock(done) {
  this._run(this, this.unlock, [], done);
};
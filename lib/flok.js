var util = require('util');
var events = require('events');
var path = require('path');
var fs = require('fs');
var os = require('os');
var async = require('async');
var mixIn = require('mout/object/mixIn');
var isPlainObject = require('mout/lang/isPlainObject');
var toLookup = require('mout/array/toLookup');
var filter = require('mout/collection/filter');
var isString = require('mout/lang/isString');
var guid = require('mout/random/guid');
var filter = require('mout/array/filter');
var max = require('mout/array/max');
var difference = require('mout/array/difference');
var compose = require('mout/function/compose');
var prop = require('mout/function/prop');
var properCase = require('mout/string/properCase');

var generator = require('./generator');
var Migration = require('./migration');
module.exports.Migration = Migration;
module.exports.ConsoleLogger = require('./console-logger');

const VERSION = require('../package.json').version;


/**
 * ## Flok Constructor
 */
function Flok(o) {
  if (isPlainObject(o)) mixIn(this, o);

  if (!this.migrationsDir) this.migrationsDir = path.resolve('migrations');

  this.generate = generator();

  this.migrations = [];
  this._status = [];
  this._mdw = [];

  this._fixes = [];

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
};

/**
 * Extend the flok object with a new Class or plain object
 */
Flok.prototype.extend = function extend(obj) {
  this.log.debug('extending flok with', obj.desc || obj.constructor.name);
  this.log.trace('extending properties:', Object.keys(obj).join(', '));
  mixIn(this, obj);
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
Flok.prototype.up = function up(opts, done) {
  if (arguments.length === 1) done = opts;

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
      self.sortMigrationsUp(callback);
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

Flok.prototype.down = function down(opts, done) {
  if (arguments.length === 1) done = opts;

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
      self.sortMigrationsDown(callback);
    }],

    changedMigrations: ['sortMigrations', function (callback) {
      self.checkChangedMigrations(callback);
    }],

    blockedMigrations: ['changedMigrations', function (callback) {
      self.checkBlockedMigrations(callback);
    }],

    executeMigrations: ['blockedMigrations', function (callback) {
      var migration = filter(self.migrations, 'isDone').slice(0, 1);
      self._executeMigrations(migration, '_down', callback);
    }],

    unlock: ['executeMigrations', function (callback) {
      self._unlock(callback);
    }]
  },
  function (err, res) {
    if (err) self.log.fatal(err, 'fatal error attempting down migration; aborting');
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
      self.sortMigrationsUp(callback);
    }]
  },
  function (err) {
    if (err) self.log.fatal(err, 'fatal error loading migrations');
    done(err, self.migrations);
  });
};


function inArray(a) {
  return function (v) {
    return a.indexOf(v) === -1 ? false : true;
  };
}

Flok.prototype.sortMigrationsUp = function sortMigrationsUp(callback) {

  this.migrations.sort(function (a, b) {
    return a.time - b.time;
  });

  var sortedIds = [];
  var i = 0;
  while (sortedIds.length < this.migrations.length) {
    var m = this.migrations[i];

    // check for unresolved dependency
    var unresolvedDeps = difference(m.dependencies, sortedIds);
    if (unresolvedDeps.length === 0) {
      // no unresolved deps!
      sortedIds.push(m.id);
      i++;
    } else {
      // get migration objects for each unresolved dependency
      var isDep = compose(inArray(unresolvedDeps), prop('id'));
      var deps = filter(this.migrations, isDep);

      // get the position in the array of the newest dependency
      var latestDep = max(deps, prop('time'));
      var pos = this.migrations.indexOf(latestDep);

      // move this migration immediately after it's newest dependency
      this.migrations.splice(pos, 0, this.migrations.splice(i, 1)[0]);
    }
  }
  callback(null);
};


Flok.prototype.sortMigrationsDown = function sortMigrationsDown(callback) {
  // reverse the order they were executed
  this.migrations.sort(function (a, b) {
    a = a.status.runTime || new Date(0);
    b = b.status.runTime || new Date(0);
    return a === b ? 0 : a < b ? 1 : -1;
  });
  callback(null);
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
    }
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
        if (!fods || fods.length < 1) {
          self.log.warn('no migrations found in %s', migrationsDir);
          return callback(null, []);
        }
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
          if (stats.isFile() && fod.match(/\.js$/)) {
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
      self.log.warn('if this migration was not idempotent you must manually update the' +
                    ' status source');
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


Flok.prototype._clearMigrationStatus = function _clearMigrationStatus(migration, done) {
  this._run(this, this.clearMigrationStatus, [migration], done);
};


Flok.prototype._lock = function _lock(done) {
  this._run(this, this.lock, [], done);
};

Flok.prototype._unlock = function _unlock(done) {
  this._run(this, this.unlock, [], done);
};

Flok.prototype.addFixFor = function addFixFor(what, title, fn) {
  fn.isFixForErrored = what.indexOf('errored') > -1;
  fn.isFixForChanged = what.indexOf('changed') > -1;
  fn.title = title;
  if (this._fixes.indexOf(fn) >= 0) throw new Error('duplicate fix for changed: ' + title);
  this._fixes.push(fn);
};

Flok.prototype.fixesFor = function fixesFor(what) {
  return filter(this._fixes, 'isFixFor' + properCase(what));
};
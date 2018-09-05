var os = require('os');
var MongoClient = require('mongodb').MongoClient;
var async = require('async');

function mongoConnect(url, callback) {
  const mongoOptions = {
    useNewUrlParser: true
  };
  MongoClient.connect(url, mongoOptions, (err, client) => {
    if (err) return callback(err);

    const db = client.db();
    callback(null, db);
  });
}


// function mongoClose(err, db, callback) {
//   if (db && db.close) {
//     db.close(true, function () {
//       callback(err);
//     });
//   } else {
//     callback(err);
//   }
// }

function asyncGetCollection(url, collection) {
  var _db;

  return function getCollection(callback) {
    if (_db) return callback(null, _db.collection(collection));
    mongoConnect(url, function (err, db) {
      if (err) return callback(err);
      _db = db;
      callback(null, db.collection(collection));
    });
  };
}


function _saveMigrationStatus(url, collection) {
  return function saveMigrationStatus(status, migration, done) {
    this.log.debug('saving migration status for %s', migration.id);
    async.waterfall([
      asyncGetCollection(url, collection),
      function saveStatus(coll, callback) {
        status._flokType = 'status';
        status._id = status.id;
        migration.log.debug({status: status}, 'mongodb saving migration status in %s', collection);
        coll.replaceOne({_id: status.id}, status, {upsert: true}, callback);
      }
    ],
    function (err) {
      done(err);
    });
  };
}


function _loadMigrationStatus(url, collection) {
  return function loadMigrationStatus(done) {
    this.log.debug('loading migration from mongodb %s collection', collection);
    async.waterfall([
      asyncGetCollection(url, collection),
      function loadStatus(coll, callback) {
        coll.find({_flokType: 'status'}).toArray(callback);
      }
    ],
    function (err, res) {
      done(err, res);
    });
  };
}


function _clearMigrationStatus(url, collection) {
  return function clearMigrationStatus(migration, done) {
    migration.log.debug('clearing migration status for %s', migration.id);
    async.waterfall([
      asyncGetCollection(url, collection),
      function removeStatus(coll, callback) {
        coll.deleteOne({_id: migration.status.id}, callback);
      }
    ],
    function (err) {
      done(err);
    });
  };
}


function _middleware(url) {
  var _db;
  return function mongodb(migration, flok, next) {
    if (_db) {
      migration.mongodb = _db;
      next();
    } else {
      mongoConnect(url, function (err, db) {
        if (err) return next(err);
        migration.mongodb = db;
        _db = db;
        next();
      });
    }
  };
}


function _lock(url, collection) {
  return function lock(done) {
    var self = this;
    this.log.debug('locking migrations in mongodb %s collection', collection);
    async.waterfall([
      asyncGetCollection(url, collection),
      function getLock(coll, callback) {
        var interfaces = os.networkInterfaces();
        delete interfaces.lo;

        var lock = {
          _id: 'flok_lock',
          _flokType: 'lock',
          hostname: os.hostname(),
          network: interfaces,
          date: new Date(),
          username: process.env.USER || process.getuid(),
          pid: process.pid
        };

        coll.insertOne(lock, function (err) {
          if (err) {
            // --duplicate
            if (err.code !== 11000) return callback(err);
            coll.findOne({ _id: 'flok_lock'}, {}, function (getErr, oldLock) {
              if (getErr) {
                self.log.error(getErr, 'error retrieving existing lock after failing to lock');
                return callback(new Error('error retrieving existing lock after failing to lock'));
              }
              self.log.fatal(oldLock, 'locked by host %s pid %s', oldLock.hostname, oldLock.pid);
              return callback(new Error('lock already exists'));
            });
          } else {
            self.log.info('locked with hostname %s and pid %s', lock.hostname, lock.pid);
            return callback(null);
          }
        });

      }
    ],
    function (err) {
      done(err, err ? false : true);
    });
  };
}


function _unlock(url, collection) {
  return function unlock(done) {
    var self = this;
    this.log.debug('unlocking migrations in mongodb %s collection', collection);
    async.auto({
      collection: asyncGetCollection(url, collection),

      remove: ['collection', function (callback, res) {
        res.collection.findOneAndDelete({_id: 'flok_lock'}, function (err, {value: lock, ok} = {}) {
          if (err) return callback(err);
          if (!ok) return callback(new Error('unknown mongo error clearing lock'));
          if (lock) {
            self.log.info({lock}, `removed lock from host ${lock.hostname} pid ${lock.pid}`);
          }
          callback();
        });
      }]
    },
    function (err) {
      done(err, err ? false : true);
    });
  };
}


function extend(flok, options) {
  var url = options.mongodbUrl;
  var stateColl = options.mongodbStateColl || 'flok_';
  var lockColl = options.mongodbLockColl || 'flok_';

  if (!url) {
    flok.log.fatal('missing mongdbUrl');
    process.exit(1);
  }

  if (options.mongodbState) {
    flok.extend({
      saveMigrationStatus: _saveMigrationStatus(url, stateColl),
      loadMigrationsStatus: _loadMigrationStatus(url, stateColl),
      clearMigrationStatus: _clearMigrationStatus(url, stateColl)
    });
  }

  if (options.mongodbLocking) {
    flok.extend({
      lock: _lock(url, lockColl),
      unlock: _unlock(url, lockColl)
    });
  }

  if (options.mongodbMdw) flok.use(_middleware(url));
}
module.exports.extend = extend;


module.exports.options = function mongoOptions(program, requirements) {
  var wantState = requirements.contains('state');
  var wantLock = requirements.contains('lock');
  var wantMiddleware = requirements.contains('middleware');

  if (wantState || wantLock || wantMiddleware) {
    program.option('--mongodbUrl <url>', 'mongodb connection string url');
  }

  if (wantMiddleware) {
    program.option('--mongodbMdw', 'mongodb middleware');
  }

  if (wantState) {
    program.option('--mongodbState', 'save migration state in mongodb instead of on local disk');
    program.option('--mongodbStateColl <collection>', 'name of collection for migration state');
  }

  if (wantLock) {
    program.option('--mongodbLocking', 'lock flok via mongodb instead of on local disk');
    program.option('--mongodbLockColl <collection>',  'name of collection used for locking');
  }
};


module.exports.onParse = function onParse(program, flok) {
  extend(flok, program);

  flok.generate
    .up('var myCollection = mig.mongodb.collection(\'myCollection\');')
    .down('var myCollection = mig.mongodb.collection(\'myCollection\');');
};

var crypto = require('crypto');
var fs = require('fs');

/**
 * Migration constructor
 *
 * Takes 2 arguments, full path to the migration file and a logger object
 */
function Migration(filename, log) {
  log.trace('constructing migration from %s', filename);
  var m = require(filename);
  var self = this;
  this.flokVersion = '1'; // migrations default to v1 which predated versioned migrations
  Object.keys(m).forEach(function (key) {
    self[key] = m[key];
  });
  this.filename = filename;
  this.status = {
    id: m.id,
    title: m.title,
    runMethod: null,
    signature: null,
    runTime: null,
    error: null
  };
  this.log = log;

  if (!this.up && !this.down) throw new Error('invalid migration: ' + filename);
}

//TODO: updated, deleted, inserted functions to record how many records are changed
//TODO: progress function?

Migration.prototype._up = function up(mig, flok, done) {
  mig.status.runTime = new Date();
  mig.status.signature = mig.signature;
  //TODO: check for up function and callback error if absent
  //TODO: improve exception catching (domain?)
  mig.up(mig, flok, function (err) {
    mig.status.runMethod = 'up';
    mig.status.error = err || null;
    done(err, mig);
  });
};

Migration.prototype._down = function down(mig, flok, done) {
  mig.status.runTime = new Date();
  mig.status.signature = mig.signature;
  //TODO: check for down function and callback error if absent
  //TODO: improve exception catching (domain?)
  mig.down(mig, flok, function (err) {
    mig.status.runMethod = 'down';
    mig.status.error = err || null;
    done(err, mig);
  });
};

Migration.prototype.getStatus = function getStatus() {
  return this.status;
};

/**
 * Returns the md5sum of a migration file
 */
Object.defineProperty(Migration.prototype, 'signature', {
  enumerable: true,
  get: function getSignature() {
    var content = fs.readFileSync(this.filename);
    return crypto.createHash('md5').update(content).digest('hex');
  }
});

Object.defineProperty(Migration.prototype, 'state', {
  enumerable: true,
  get: function getState() {
    return this.isProblem ? 'blocked' :
           this.isPending ? 'pending' :
           this.isDone    ? 'done'    :
                            'unknown';
  }
});

Object.defineProperty(Migration.prototype, 'isDone', {
  enumerable: true,
  get: function getDone() {
    return (this.status.runMethod === 'up' && !this.isProblem);
  }
});

Object.defineProperty(Migration.prototype, 'isPending', {
  enumerable: true,
  get: function getPending() {
    return !this.isDone;
  }
});

Object.defineProperty(Migration.prototype, 'isChanged', {
  enumerable: true,
  get: function getChanged() {
    return (this.status.signature !== null && (this.status.signature !== this.signature));
  }
});

Object.defineProperty(Migration.prototype, 'isErrored', {
  enumerable: true,
  get: function getErrored() {
    return (this.status.error !== null);
  }
});

Object.defineProperty(Migration.prototype, 'isProblem', {
  enumerable: true,
  get: function getProblem() {
    return (this.isErrored || this.isChanged);
  }
});

Object.defineProperty(Migration.prototype, 'isIncompatible', {
  enumerable: true,
  get: function getIncompatible() {
    return (this.flokVersion.startsWith('2') === false);
  }
});

module.exports = Migration;

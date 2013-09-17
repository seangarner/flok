var util = require('util');
var isString = require('mout/lang/isString');

var colors = require('colors');

// only print colours on a real terminal
if (!process.stdout.isTTY) colors.mode = 'none';

function noop() {}

function prettyDir(obj) {
  util.puts(util.inspect(obj, false, 10, false).grey);
}

function levelToNum(level) {
  switch (level) {
  case 'trace':
    return 10;
  case 'debug':
    return 20;
  case 'info':
    return 30;
  case 'warn':
    return 40;
  case 'error':
    return 50;
  case 'alert':
    return 60;
  case 'fatal':
    return 70;
  }
  return Infinity;
}

function dl(level) {
  var l = level;
  level = '[' + level + ']';
  switch (l) {
  case 'trace':
    level = level.grey;
    break;
  case 'debug':
    level = level.grey;
    break;
  case 'info':
    level = level.cyan;
    break;
  case 'warn':
    level = level.yellow;
    break;
  case 'error':
    level = level.red;
    break;
  case 'alert':
    level = level.red;
    break;
  case 'fatal':
    level = level.yellow.redBG;
    break;
  }
  return level + ' ';
}

function getLogger(level, desiredLevel, printObj) {
  // if we're not logging at this level return a noop function
  if (levelToNum(level) < levelToNum(desiredLevel)) return noop;

  // return a real logger function
  return function logger() {
    var o, m;
    var args = Array.prototype.slice.call(arguments);

    if (!isString(args[0])) {
      o = args.shift();
      if (o instanceof Error) o._stack = o.stack;
    }

    if (args.length > 1) {
      m = util.format.apply(util, args);
    } else {
      m = args.shift() || '';
    }
    util.log(dl(level) +  m);
    if (o && printObj) prettyDir(o);
  };
}


/**
 * Simple Console Logger extension for flok
 *
 * Use:
 *
 *     floker.use(new flok.ConsoleLogger({
 *       level: 'info',
 *       printObjects: true,
 *       colors: true
 *     }));
 *
 * If `colors` is absent then it defaults to true but turns colors off when not running in a TTY.
 *
 * It supports levels; `trace`, `debug`, `info`, `warn`, `error`, `alert` and `fatal` in that order.
 */
module.exports = function ConsoleLogger(o) {
  var level = o.level || 'info';

  var objects = o.printObjects === undefined ? true : o.printObjects;

  if (o.colors === true || o.colors === false) {
    colors.mode = o.colors ? 'console' : 'none';
  }

  this.log = {
    trace: getLogger('trace', level, objects),
    debug: getLogger('debug', level, objects),
    info: getLogger('info', level, objects),
    warn: getLogger('warn', level, objects),
    error: getLogger('error', level, objects),
    alert: getLogger('alert', level, objects),
    fatal: getLogger('fatal', level, objects)
  };
};
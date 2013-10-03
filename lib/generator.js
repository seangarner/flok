var fs = require('fs');
var path = require('path');
var inquirer = require('inquirer');
var async = require('async');
var createObject = require('mout/lang/createObject');
var interpolate = require('mout/string/interpolate');
var slugify = require('mout/string/slugify');
var trim = require('mout/string/trim');
var isString = require('mout/lang/isString');

const LINE_SEPARATOR = '\n';
const SECTION_SEPARATOR = '\n\n\n';

const HEADERS = {
  requires: '//--modules',
  constants: '//--constants',
  variables: '//--variables',
  functions: '//--helper functions',
  exports: '//--exports',
  dependencies: '//--dependencies\nmodule.exports.dependencies = [',
  up: '//--migrate function\nmodule.exports.up = function up(mig, flok, done) {',
  down: '//--backout function\nmodule.exports.down = function down(mig, flok, done) {'
};

const FOOTERS = {
  dependencies: '];',
  up: '};',
  down: '};'
};

function wrap(template, fn) {
  return function (program, done) {
    fn(program, function (err, value) {
      if (err) return done(err);
      done(null, interpolate(template, {value: value.toString()}));
    });
  };
}

function formatDate(d) {
  if (!d) return '';
  if (!(d instanceof Date)) d = new Date(d);
  function pad(n) { return n < 10 ? '0' + n : n; }
  return d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + '-' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes());
}

function indent(value) {
  return '  ' + value;
}

function indentDep(value) {
  if (!value) return '';
  return '  \'' + trim(value) + '\'';
}

function simplePrompt(key) {
  if (!isString(key)) return key;
  return {
    type: 'input',
    name: key,
    message: key
  };
}

var generator = {

  _prompt: function _prompt(key, arg, template) {
    var self = this;

    // simple single prompt
    //-- ('author')
    if (arguments.length === 1) {
      var o = [simplePrompt(key)];
      return function (prog, done) {
        inquirer.prompt(o, function (res) {
          self._o[key] = res[key];
          done(null, res[key]);
        });
      };
    }

    // actually not a prompt, but pre-supplied value
    //-- ('author', 'user@example.com')
    if (arguments.length === 2) {
      this._o[key] = arg;
      return function (prog, done) {
        done(null, arg);
      };
    }

    // prompt multiple times then interpolate responses with a template
    //-- ('author', ['name', 'email'], '{{name}} <{{email}}>')
    if (arguments.length === 3) {
      return function (prog, done) {
        arg = Array.isArray(arg) ? arg.map(simplePrompt) : arg;
        inquirer.prompt(arg, function (res) {
          if (!res) return done(new Error('user aborted during response capture'));
          self._o[key] = interpolate(template, res);
          done(null, self._o[key]);
        });
      };
    }
  },

  _collectSections: function _collectSections(done) {
    var self = this;
    async.concatSeries(Object.keys(this._sections), function (name, next) {
      self._collectSection(self._sections[name], function (err, section) {
        if (err) next(err);
        if (section.length < 1) return next(null, null);
        if (HEADERS[name]) section.unshift(HEADERS[name]);
        if (FOOTERS[name]) section.push(FOOTERS[name]);
        next(null, section.join(LINE_SEPARATOR));
      });

    }, function (err, res) {
      done(err, res.join(SECTION_SEPARATOR));
    });
  },

  _collectSection: function _collectSection(section, done) {
    var program = this.program;
    async.concatSeries(section, function (fn, next) {
      fn(program, next);
    }, function (err, res) {
      done(err, res);
    });
  },

  register: function register(section, callback) {
    if (Object.keys(this._sections).indexOf(section) === -1)
      throw new Error('unknown generate section: ' + section);
    this._sections[section].push(callback);
    return this;
  },

  require: function require() {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift('module');
    var promptFn = this._prompt.apply(this, args);
    return this.register('requires', wrap('var {{value}} = require(\'{{value}}\');', promptFn));
  },

  constant: function constant(key) {
    var args = Array.prototype.slice.call(arguments, 0);
    var promptFn = this._prompt.apply(this, args);
    return this.register('constants', wrap('const ' + key + ' = \'{{value}}\';', promptFn));
  },

  variable: function variable(key) {
    var args = Array.prototype.slice.call(arguments, 0);
    var promptFn = this._prompt.apply(this, args);
    return this.register('variables', wrap('var ' + key + ' = \'{{value}}\';', promptFn));
  },

  func: function func(fn) {
    if (!(fn instanceof Function)) throw new Error('generate.func expected a function');
    if (!fn.name) throw new Error('functions must be named');
    return this.register('functions', function (program, done) {
      done(null, fn.toString());
    });
  },

  modExport: function modExport(key) {
    var args = Array.prototype.slice.call(arguments, 0);
    var promptFn = this._prompt.apply(this, args);
    return this.register('exports', wrap('module.exports.' + key + ' = \'{{value}}\';', promptFn));
  },

  dependency: function dependency(deps) {
    if (!Array.isArray(deps)) deps = [deps];
    return this.register('dependencies', function (program, done) {
      done(null, deps.map(indentDep).join(',\n'));
    });
  },

  up: function up(value) {
    return this.register('up', function (program, done) {
      done(null, value.split('\n').map(indent).join('\n'));
    });
  },

  down: function down(value) {
    return this.register('down', function (program, done) {
      done(null, value.split('\n').map(indent).join('\n'));
    });
  },

  toFile: function save(dir, done) {
    var o = this._o;
    this._collectSections(function (err, content) {
      if (err) return done(err);
      var filename = path.join(dir, formatDate(o.time) + '_' + slugify(o.title) + '.js');
      fs.writeFile(filename, content, function (err) {
        done(err, filename);
      });
    });
  }
};

generator.export = generator.modExport;

module.exports = function makeGenerator() {
  var gen = createObject(generator, {
    _o: {},
    _sections: {
      requires: [],
      constants: [],
      variables: [],
      functions: [],
      exports: [],
      dependencies: [],
      up: [],
      down: []
    }
  });
  gen.prompt = inquirer.prompt.bind(inquirer);
  return gen;
};
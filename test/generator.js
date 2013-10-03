var generator = require('../lib/generator');

function test_fn() {
  return 'foobar';
}

// some tests prompt and should be skipped when run without a tty
var describeWithTTY = process.stdout.isTTY ? describe : describe.skip;

describe('generator', function () {

  it('should return a new generator when called', function () {
    var gen;
    (function () {
      gen = generator();
    }).should.not.throw();
    gen.should.have.property('register');
  });

  describe('register', function () {
    it('should store a callback when executed', function () {
      var gen = generator();
      function fn() {}
      gen.register('variables', fn);
      gen._sections.variables.pop().should.equal(fn);
    });
  });

  describe('_collectSection', function () {
    it('should return \\n separated strings for each registration', function (done) {
      var gen = generator();
      function fna(p, cb) { cb(null, 'foobar'); }
      function fnb(p, cb) { cb(null, 'baz'); }
      gen.register('variables', fna);
      gen.register('variables', fnb);
      gen._collectSection(gen._sections.variables, function (err, res) {
        if (err) return done(err);
        res.should.be.instanceof(Array).and.eql(['foobar', 'baz']);
        done();
      });
    });
  });

  describeWithTTY('_collectSections', function () {
    it('should return \\n separated strings for each section', function (done) {
      this.slow(30000);
      this.timeout(60000);
      var gen = generator();
      function fna(p, cb) { cb(null, 'foobar'); }
      function fnb(p, cb) { cb(null, 'baz'); }
      gen.register('variables', fna);
      gen.register('variables', fnb);
      gen.register('exports', fna);
      gen.register('exports', fnb);
      console.log();
      console.log();
      console.log('any input ok');
      gen._collectSections(function (err, res) {
        if (err) return done(err);
        res.should.be.a('string');
        res.match(/foobar/g).should.have.lengthOf(2);
        res.match(/baz/g).should.have.lengthOf(2);
        console.dir(gen);
        console.log();
        done();
      });
    });
  });

  describeWithTTY('high level prompt api', function () {
    it('should prompt when called with only a key', function (done) {
      this.slow(10000);
      this.timeout(10000);
      var gen = generator();
      console.log();
      console.log();
      console.log('must provide \'me\' as response');
      gen.export('author');
      gen._sections.exports.pop()({}, function (err, line) {
        console.log();
        if (err) return done(err);
        line.should.equal('module.exports.author = \'me\';');
        done();
      });
    });

    it('should propmt for multiple values called with 3 args', function (done) {
      this.slow(20000);
      this.timeout(20000);
      var gen = generator();
      console.log();
      console.log();
      console.log('must provide \'me\' and \'me@abc.com\' as answers');
      gen.export('author', ['name', 'email'], '{{name}} <{{email}}>');
      gen._sections.exports.pop()({}, function (err, line) {
        console.log();
        if (err) return done(err);
        line.should.equal('module.exports.author = \'me <me@abc.com>\';');
        done();
      });
    });
  });

  describe('export', function () {
    it('should generate a module.exports line with value', function (done) {
      var gen = generator();
      gen.export('author', 'Paulo Coelho');
      gen._sections.exports.pop()({}, function (err, line) {
        line.should.equal('module.exports.author = \'Paulo Coelho\';');
        done(err);
      });
    });
  });

  describe('require', function () {
    it('should generate a line which requires a module ', function (done) {
      var gen = generator();
      gen.require('mysql');
      gen._sections.requires.pop()({}, function (err, line) {
        line.should.equal('var mysql = require(\'mysql\');');
        done(err);
      });
    });
  });

  describe('constant', function () {
    it('should generate a const assigned with value', function (done) {
      var gen = generator();
      gen.constant('author', 'Paulo Coelho');
      gen._sections.constants.pop()({}, function (err, line) {
        line.should.equal('const author = \'Paulo Coelho\';');
        done(err);
      });
    });
  });

  describe('variable', function () {
    it('should generate a var assigned with value', function (done) {
      var gen = generator();
      gen.variable('author', 'Paulo Coelho');
      gen._sections.variables.pop()({}, function (err, line) {
        line.should.equal('var author = \'Paulo Coelho\';');
        done(err);
      });
    });
  });

  describe('func', function () {
    it('should generate stringify a function into utility function', function (done) {
      var gen = generator();
      gen.func(test_fn);
      gen._sections.functions.pop()({}, function (err, line) {
        line.should.equal('function test_fn() {\n  return \'foobar\';\n}');
        done(err);
      });
    });
    it('should throw an error when the function has no name', function () {
      var gen = generator();
      (function () {
        gen.func(function () {});
      }).should.throw();
    });
  });

  describe('dependencies', function () {
    it('should generate an indented string in dependencies', function (done) {
      var gen = generator();
      gen.dependency(['abcde', '12345']);
      gen._sections.dependencies.pop()({}, function (err, line) {
        line.should.equal('  \'abcde\',\n  \'12345\'');
        done(err);
      });
    });
  });

  describe('up', function () {
    it('should generate an indented line in the up function', function (done) {
      var gen = generator();
      gen.up('var mongodb = mig.mongodb;');
      gen._sections.up.pop()({}, function (err, line) {
        line.should.equal('  var mongodb = mig.mongodb;');
        done(err);
      });
    });
  });

  describe('down', function () {
    it('should generate an indented line in the down function', function (done) {
      var gen = generator();
      gen.up('var mongodb = mig.mongodb;');
      gen._sections.up.pop()({}, function (err, line) {
        line.should.equal('  var mongodb = mig.mongodb;');
        done(err);
      });
    });
  });

});
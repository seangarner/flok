var flokme = require('./flok');
var flok = flokme('migrations');

var flokjs = require('../lib/flok.js');

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
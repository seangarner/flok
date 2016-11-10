var nixt = require('nixt');
var path = require('path');

const base = path.join(__dirname, '/..');
const show = path.join(base, 'bin/flok') +
             ' show --migrations ' +
             path.join(base, 'test/show') +
             ' ';

const execed = 'd36d73f9-fa17-4588-92cb-28013d01e24c';
const changed = 'aa22c294-bc63-4fd3-babc-b7b597353892';
const errored = 'ae8d63c6-858d-4ecf-8eaf-431f9a67742f';
const pending = ['bee41587-59dc-4d89-bf66-8f90b061777d', errored, changed];
const blocked = [errored, changed];
const all = [execed, changed, errored, 'bee41587-59dc-4d89-bf66-8f90b061777d'];

// utility function to add a test for columns present in table
function itShouldDisplay(filter, columns) {
  var last = columns.pop();
  it('should display ' + columns.join(', ') + ' and ' + last, function (done) {
    columns.push(last);
    nixt()
      .run(show + filter)
      .code(0)
      .expect(function (res) {
        var headers = res.stdout.split('\n')[1];
        columns.forEach(function (col) {
          headers.should.include(col);
        });
      })
      .end(done);
  });
}

function count(howMany) {
  return function (res) {
    res.stdout.split('\n').length.should.eql(howMany);
  };
}

function toInclude(a) {
  return function (res) {
    a.forEach(function (val) {
      res.stdout.should.include(val);
    });
  };
}

function toNotInclude(a) {
  return function (res) {
    a.forEach(function (val) {
      res.stdout.should.not.include(val);
    });
  };
}

describe('show', function () {
  this.slow(1000);

  it('displays migrations in a table', function (done) {
    nixt()
      .run(show)
      .code(0)
      .stdout(/┼/)
      .stdout(/─/)
      .stdout(/┤/)
      .stdout(/┐/)
      .stdout(/┘/)
      .stdout(/┌/)
      .stdout(/└/)
      .stdout(/├/)
      .stdout(/│/)
      .end(done);
  });

  describe('all', function () {
    it('should display every migration', function (done) {
      nixt()
        .run(show)
        .code(0)
        .expect(toInclude(all))
        .end(done);
    });

    itShouldDisplay('all', ['State', 'Id', 'Title', 'Run Met', 'Run Time']);
  });

  describe('pending', function () {
    it('should display only migrations pending execution (including errored)', function (done) {
      nixt()
        .run(show + 'pending')
        .code(0)
        .expect(toInclude(pending))
        .expect(toNotInclude([execed]))
        .end(done);
    });
    itShouldDisplay('pending', ['Id', 'Title', 'Is Err', 'Is Cha']);
  });

  describe('blocked', function () {
    it('should display  migrations currently blocked', function (done) {
      nixt()
        .run(show + 'blocked')
        .code(0)
        .expect(toInclude(blocked))
        .expect(toNotInclude([execed, 'bee41587']))
        .end(done);
    });
    itShouldDisplay('blocked', ['Id', 'Title', 'Run Met', 'Is Cha', 'Error Mes']);
  });

  describe('done', function () {
    it('should display complete migrations not in a changed state', function (done) {
      nixt()
        .run(show + 'done')
        .code(0)
        .expect(toInclude([execed]))
        .expect(toNotInclude(pending))
        .end(done);
    });
    itShouldDisplay('done', ['Id', 'Title', 'Run Time']);
  });

  describe('changed', function () {
    it('should display only changed migrations', function (done) {
      nixt()
        .run(show + 'changed')
        .code(0)
        .expect(toInclude([changed]))
        .expect(toNotInclude([execed, errored, 'bee41587']))
        .end(done);
    });
    itShouldDisplay('changed', ['Id', 'Title', 'Signature', 'Run Signature', 'Run Time']);
  });

  describe('with migration id', function () {
    it('should display only changed migrations', function (done) {
      nixt()
        .run(show + errored)
        .code(0)
        .stdout(new RegExp(errored))
        .stdout(/Error: oops/)
        .end(done);
    });
  });

  describe('--compact', function () {
    it('should not draw inner table lines', function (done) {
      nixt()
        .run(show + '--compact')
        .code(0)
        .expect(count(8))
        .end(done);
    });
  });

  describe('--count', function () {
    it('should display only the number of migrations matching the filter', function (done) {
      nixt()
        .run(show + 'all --count')
        .code(0)
        .stdout('4')
        .end(done);
    });
  });

});

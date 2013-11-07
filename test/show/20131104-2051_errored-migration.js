//--exports
module.exports.id = 'ae8d63c6-858d-4ecf-8eaf-431f9a67742f';
module.exports.title = 'Errored migration';
module.exports.time = '1383598261250';


//--dependencies
module.exports.dependencies = [
  'aa22c294-bc63-4fd3-babc-b7b597353892'
];


//--migrate function
module.exports.up = function up(mig, flok, done) {
  done(new Error('oops'));
};


//--backout function
module.exports.down = function down(mig, flok, done) {
  done();
};
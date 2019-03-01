const consoleLogLevel = require('console-log-level'); 

module.exports =  consoleLogLevel({
  prefix: () => {
    return new Date().toISOString()
  },
  // TODO get config for level
  level: 'info'
});

Flok Plugin Development
=======================

    module.exports.commands = function mongoCommands(program) {
      var command = program.command('foobar');
      command
        .description('more than less useless')
        .option('--cowbell', 'more cowbell')
        .action(function func() {
          console.log('*ding*');
          process.exit();
        })
        .requirement('state')
        .requirement('lock');
      return command;
    };
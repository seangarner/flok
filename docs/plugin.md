Flok Plugin Development
=======================

<<<<<<< Updated upstream
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
=======
  * **Middleware** *available to each Migration during up and down*
  * **CLI Switches** for Existing Commands *modify behaviour of existing commands by adding switches, normally combined with a flok core extension*
  * **CLI Commands** *add a whole new `flok whatever` command*
  * **Flok Core** *replace or extend core flok functionality*
  * **Generators** *add sections to the generator which will be used by `flok init`

Plugins are loaded at runtime by the CLI they need to provide hooks for flok which are called during initialisation. 
There are 3 initialisation methods available to plugins and all are optional; `options`, `commands` and `onParse`.  During initialisation flok will:
 - read `--modules` switch & loads each of them as a plugin 
 - invoke the `options` method on the plugin
 - invoke the `commands` method on the plugin
   - individual commands may register command specific options here
 - parse argv switches
 - invoke `onParse` on each plugin


Initialisation
--------------
### Contextual Options (requirements)
If your plugin provides a new state store then you don't want your options to leak into commands that don't need state (like init).  If you do not check requirements before adding an option then the option will be available to all commands which will mess up the output of `--help`.  **Always** check requirements and only add options when the plugin is relevant.

### `options(program, requirements)`
The `options` method is invoked multiple times.  Once for the main program and again for each command.

```js
module.exports.options = function (program, requirements) {
  if(requirements.contains('lock')) console.log('program needs locking functionality');

  program.option('--more <what>', 'I demand satisfaction!');
}
```

#### `program` 
An instance of `Command` from [commander](https://github.com/visionmedia/commander.js).  Almost always you want to check `requirements` before doing anything with this.

Although you have full access to the `Command` instance it's recommended not to call any method other than `option` since this may be modified in future releases.

#### `requirements`
An array of strings with a convenience method, `contains` so you can determine if your options are relevant in this context.

### `commands(program, requirements)`
Register new commands which can be invoked with `flok`.




### `onParse`




Middleware
----------
A middleware function is called before the migraitons `up` and `down` methods.  It has the opportunity to modify the Migration object including decorating it with utility methods which can then be used by the migration.

```js
flok.use(function myMdw(migration, flok, next) {
  migration.log.debug('granting migration power of cowbell');
  migration.more = function(what) { console.log('more', what); };
  next();
});
```

Then later in your migration;
```js
module.exports.up = function up(migration, flok, done) {
  migration.more('cowbell');
  done();
};

// prints: more cowbell
```

CLI Switches for Existing Commands
----------------------------------


CLI Commands
------------

```js
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
```


Extending or Modifying Flok Core
--------------------------------
`flok.extend` can be used to modify core functionality and behaviour of a flok instance including

  * logging
  * locking
  * state persistence
  * dependency evaluation

`extend` accepts an object or instantiated class instance which will be mixed into the flok instance.  It's not recommended to extend flok by the prototype or directly replacing method because it limits our ability to put in checks to ensure plugins don't provide conflicting functionality.

```js
  var logger = new flokjs.ConsoleLogger();
  flok.extend(logger);
```

### Logging


### Locking


### State Persistence


### Dependency Evaluation


Generators for `flok init`
--------------------------
Generators are covered in a separate document in `docs/generator.md`.


Other References
----------------
A lot can be learned from other implementations (usually).  Search for flok plugins and look through their source.  Built-ins for locking (`lib/lock-file.js`), state persistence (`lib/status-file`) and logging (`lib/console-logger`) are all implemented as plugins so can be used as a basic reference.
>>>>>>> Stashed changes

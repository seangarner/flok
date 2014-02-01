# Flok Plugin Development

  * **Middleware** *available to each Migration during up and down*
  * **CLI Switches** for Existing Commands *modify behaviour of existing commands by adding switches, normally combined with a flok core extension*
  * **CLI Commands** *add a whole new `flok whatever` command*
  * **Flok Core** *replace or extend core flok functionality*
  * **Generators** *add sections to the generator which will be used by `flok init`*

Plugins are loaded at runtime and they need to provide hooks for flok which are called during initialisation.  There are 3 initialisation methods available to plugins and all are optional; `options`, `commands` and `onParse`.

### Initialisation
It's useful to know what happens as flok starts to be effective at plugin development.
 - read `--modules` switch & loads each of them as a plugin 
 - invoke `exports.options` method on the plugin
   + plugin registers options (with requirements) which can be picked up by commands that need those requirements
 - invoke `exports.commands` method on the plugin
   - plugin registers individual commands (with requirements) and their options
 - parse argv switches
 - invoke `exports.onParse` method on each plugin
   + chance to use middleware or extend core flok functionality

### Requirements
If your plugin provides a new state store then you don't want your options to leak into commands that don't need state (like init).  If you do not check requirements before adding an option then the option will be available to all commands.  **Always** check requirements and only add options when relevant.

Similarly your commands can register requirements so that options from other modules have a chance to load.

Requirements that mean something to flok are listed below but the community can create more.

 * state
 * lock
 * middleware


## Options (`exports.options`)
The `options` method is invoked multiple times.  Once for the main program and again for each command.

```js
module.exports.options = function (program, requirements) {
  if(requirements.contains('lock')) console.log('program needs locking functionality');

  program.option('--more <what>', 'I demand satisfaction!');
}
```

### `program` 
An instance of `Command` from [commander](https://github.com/visionmedia/commander.js).  Almost always you want to check `requirements` before doing anything with this.

Although you have full access to the `Command` instance it's recommended not to call any method other than `option` since this may be modified in future releases.

### `requirements`
An array of strings with a convenience method, `contains` so you can determine if your options are relevant in this context. 


## Commands (`exports.commands`)
Plugins can add their own commands to flok by exporting a `commands` callback.  When executed the callback will be passed an instance of `program` ala  [commander](https://github.com/visionmedia/commander.js).  Call `command` on this to register new commands as you would with [commander](https://github.com/visionmedia/commander.js) .


```js
module.exports.commands = function (program) {
  var command = program.command('foobar');
  command
    .description('more than useless')
    .option('--cowbell', 'more cowbell')
    .action(function func() {
      console.log('*ding*');
      process.exit(0);
    })
    .requirement('state')
    .requirement('lock');
  return command;
};
```

If you have requirements on other plugins (e.g. lock) then use `command.requirement('foobar')`.  It lets other plugins know what features you require.  Otherwise the interface is identical to [commander](https://github.com/visionmedia/commander.js).


## Middleware & Core (`exports.onParse`)
Invoked when argv has been processed.  Options will be on `program`.

```js
module.exports.options = function (program, requirements) {
  if(requirements.contains('lock')) program.option('--alwaysLocked');
};

modules.exports.onParse = function (program, flok) {
  flok.extend({
    lock: function(done) {
      if (program.alwaysLocked) {
        done(new Error('always locked'));
      } else {
        done(null);
      }
    }
  });

  flok.use(myMdwFunction);
}
```

### Middleware

A middleware function is called before the migraiton's `up` and `down` methods.  It has the opportunity to modify the Migration object including decorating it with utility methods which can then be used by the migration.

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

// more cowbell
```


### Extending or Modifying Flok Core

`flok.extend` can be used to modify core functionality and behaviour of a flok instance including

  * logging
  * locking
  * state persistence
  * dependency evaluation

`extend` accepts an object or instantiated class instance which will be mixed into the flok instance.  It's not recommended to extend flok by the prototype or directly replacing method because it limits our ability to put in checks to ensure plugins don't provide conflicting functionality.

```js
module.exports.onParse = function(program, flok) {
  var logger = new flokjs.ConsoleLogger();
  flok.extend(logger);
};
```

#### Logging
To replace logging set the log object with the `trace`, `debug`, `info`, `warn`, `error`, `alert` and `fatal` functions.

```js
flok.extend({
  log: {
    info: function(o, s) { ... }
  }
});
```

The call signature is inspired by bunyan:

```js
log.info(object, string, var1, var2, ...);
```

The only required variable is `string`.  If variables are after `string` then it's expected they will be interpolated with the string. 

#### Locking
Locking is provided by 2 methods, `lock` and `unlock`.  Both are called with a callback function.

```js
flok.extend({
  lock: function lock(done) {
    // open the file for write exclusive (calls back error if file exists)
    fs.open('/tmp/lock', 'wx', '0644', function(err, fd) {
      if (err) return done(err);
      fs.close(fd, done);
    });
  },
  unlock: function unlock(done) {
    fs.unlink('/tmp/lock', done);
  }
});
```

#### State Persistence
State is implemented over 3 methods, `saveMigrationStatus`, `loadMigrationsStatus` and `clearMigrationStatus`.

##### `saveMigrationStatus(status, migration, done)`
`status` is an object that may be deep and it's expected that everything should be persisted.  The `migration` is provided so you can log or inspect the migration.

##### `loadMigrationStatus(done)`
Use the callback to send back the loaded status object. `done(err, status)`. 

##### `clearMigrationStatus(migration, done)`
Wipe the migration status for this migration.  Callback when done.

## Generators for `flok init`
Generators are covered in a separate document in `docs/generator.md`.


## Other Resources
Built-ins for locking (`lib/lock-file.js`), state persistence (`lib/status-file`) and logging (`lib/console-logger`) are all implemented as plugins.
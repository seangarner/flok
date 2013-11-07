flok
====

Extendible migration tool written in javascript which can be used standalone or within a node project (e.g. a self updating express or restify application).  Not limited to, but first focus is database migration.

Features
--------
* Pluggable (`npm find flok`)
* Programmatic migrations
* Custom logging available within migrations
* Cluster safe (with flok-mongodb)
* Interactive wizard to help you restore zen when migrations fail
* Easy to use migration generators
* Use standalone, or call from within a node server


Further Information
-------------------
Check the `/docs` directory for further documentation relevant for plugin authors and users with advanced requirements.

Installation
------------
```bash
$ sudo npm install -g flok
```


Quick Start
-----------
Change directory to the source of your project, then generate your first migration.
```bash
$ flok init
[info] created migrations directory in /home/sgarner/migrations
[?] id: 8f035018-5a2a-4cf6-b352-f905c6206493
[?] title: my first migration
[?] dependencies: (just press enter)

migration created in migrations/20131023-2141_my-first-migration.js
```

Which produces this file
```js
//--exports
module.exports.id = '8f035018-5a2a-4cf6-b352-f905c6206493';
module.exports.title = 'my first migration';
module.exports.time = '1382564485067';


//--migrate function
module.exports.up = function up(mig, flok, done) {
  //code to migrate
};


//--backout function
module.exports.down = function down(mig, flok, done) {
  //code to reverse a migration
};
```

Hopefully your migration will be more meaningful, but for the sake of example:
```js
var fs = require('fs');
var myApp = '/tmp/myapp';

//--migrate function
module.exports.up = function up(mig, flok, done) {
  fs.writeFile(myApp, 'hello world\n', done);
};

//--backout function
module.exports.down = function down(mig, flok, done) {
  fs.unlink(myApp, done);
};
```

Run our migration
```bash
$ flok up
[info] locked with pid 4965
[info] 1 of 1 migrations pending up execution
[info] executing up on [my first migration]
[info] up on [my first migration] completed successfully
```

Not a believer?
```bash
$ flok show
┌───────────┬─────────────────────────┬──────────────────┬──────────┬────────────────┐
│State      │Id                       │Title             │Run Method│Run Time        │
├───────────┼─────────────────────────┼──────────────────┼──────────┼────────────────┤
│done       │8f035018-5a2a-4cf6-b352-…│my first migration│up        │2013-10-23 21:5…│
└───────────┴─────────────────────────┴──────────────────┴──────────┴────────────────┘
```

Still not convinced?
```bash
$ cat /tmp/myapp 
hello world
```

### What Next
See the cli documentation.
```bash
$ flok help
$ flok help show
$ flok show --help
```

You have the full power of node.js to write migrations, however there are modules to help make things more fun.
```bash
$ npm find flok
```

See below for more user documentation, but advanced topics such as plugin development and extending the template generator can be found in the `docs` directory.


flok.opts
---------
Each flok command is configured using cli switches.  But you can save switches in a `flok.opts` file so they are loaded every time flok is run.  Command line switches will take precedence.  e.g. to load `flok-mongodb` every time
and to use it for locking and state add this to `flok.opts`.

```bash
--mongodbUrl mongodb://localhost:27017/test
--mongodbState
--mongodbLocking
```

Commit this file with your source code and developers will always be running with the right options.

In production you can write a `flok.opts` file into `/etc` and set the `FLOKOPTS` environment variable so calling flok from any path results in the correct options being loaded.
```bash
# cat /etc/my_flok.opts
--migrations /usr/local/share/my_app/migrations
--mongodbUrl mongodb://prod-mongodb:27017/xkcd
--mongodbState
--mongodbLocking
# echo "FLOKOPTS=/etc/my_flok.opts" >> /etc/profile.d/flok
```

Now whenever you run flok it will pick up the switches in `/etc/my_flok.


flok cli
--------
In a similar style to `git` or `svn` all flok commands are accessed through the primary `flok` program, including those supplied by plugins.

### `flok show`
```bash
$ flok show [all|pending|blocked|done|changed|<id>]
```
Display current migration status with option to filter migrations in the given state or a single migration by id.  Filters show different columns relevant to context.

```bash
$ flok show changed
┌─────────┬────────────────────┬─────────────────┬──────────────────┬───────────────┐
│Id       │Title               │Signature        │Run Signature     │Run Time       │
├─────────┼────────────────────┼─────────────────┼──────────────────┼───────────────┤
│ABC-1234 │Add active property…│4a2aa99a2064b90d…│31b80c6f7eda4238f…│2013-10-20 20U…│
└─────────┴────────────────────┴─────────────────┴──────────────────┴───────────────┘
```

It can also display all the known information of a migration by specifying an ID in place of filter.
```bash
$ flok show ABC-1066

Add active property
===================
State: blocked
ID: ABC-1066
Created: 2013-09-12 12:53:01 UTC
Signature: 1e2cfd84df408d830980e97d4585bbd5
Filename: /usr/local/my_app/migrations/20130912-1353-add_active_property.js

Status
------
Method: up
Run Signature: 1e2cfd84df408d830980e97d4585bbd5
Run Time: Tue Oct 29 2013 19:03:38 GMT+0000 (GMT)

Error
-----
Message: benign  example
name: Error

Error Stack
-----------
Error: benign example
    at Migration.up (/usr/local/my_app/migrations/20130912-1353-add_active_property.js:81:9)
    at Migration.up [as _up] (/flok/lib/migration.js:38:7)
    at Object.async.whilst (/flok/node_modules/async/lib/async.js:616:13)
```

### `flok init`
Generator that runs a wizard to create new migrations. 

### `flok up`
Checks migration state and runs up on all pending migrations.  Wont run if there are any blocked migrations.  Refer to `flok fix` and `flok lock --clear` for information how to clear blocked migrations.

Migrations are run in order of timestamp unless dependencies dictate otherwise.

### `flok down`
Call down on the last migration to be upped.  Only 1 migration will be rolled back at a time.  Like `flok up` it wont run if there are blocked migrations; refer to `flok fix` and `flok lock --clear`.

### `flok lock`
Whenever flok needs to make a change to anything it first obtains a lock.  The locking built into flok is simple file based locking, but it can be extended or replaced by plugins, such as the `flok-mongodb` plugin which uses a mongo collection to create a lock document therefore making it cluster safe (assuming the cluster all point to the same instance of mongo).

If an error occurs during execution then flok will log and exit without unlocking, leaving it in a locked state which prevents other flok processes from taking actions until the cause of the error has been fixed.  In this case you will need to unlock flok using `--clear`.

```bash
$ flok lock --clear
[?] Are you sure you wish to clear the lock?  (y/N) 
```

You can also force a lock to be put on by omitting the `--clear` argument.

### `flok fix`
There are a number of circumstances when a migration becomes a blocker.  In any case flok will be locked (see `flok lock`) and some sort of manual correction may be required.  Once the root cause has been fixed it will be necessary to fix the blocked migration state in a way that allows it to be run again.  `flok fix` takes a wizard approach to viewing the problems and provides common fixes.

It presents options available for the blocked migration relevant for the reason it is blocked.

#### Changed
Changed migrations are ones that have been executed successfully in your environment but since this the code for the migration has changed.  This is a problem because there is potential danger that the migration has changed in a way that if it were run after the change it would produce a different result.

Probably the safest way of fixing a changed migration is to restore the old version of the migration code, run `flok down` then switch back to the latest code and run `flok up`.  Sometimes it may be possible to re-reun the migration if it is idempotent.  Alternatively the changes may have been harmless, such as a comment, therefore the migration status can be updated with the latest signature so flok doesn't think it's blocked.

```bash
$ flok fix
migration [Add active property] is blocked because of a change
[?] Select desired action: (Use arrow keys)
‣ update signature in status 
  revert the change 
  show migration information 
  do nothing 
```

#### Errored
When a migration is running either up or down and an error is thrown then it enters the errored state.  A stack trace will be saved along with the error message.  Depending on how the migration is written it's possible that the migration is in a partially applied state.  Sometimes, when the migration is idempotent and it was a temporary error (e.g. network) then the error can be cleared and the migration tried again.

```bash
$ flok fix
migration [Add active property] is blocked because of an error
[?] Select desired action: (Use arrow keys)
‣ revert the change 
  wipe status 
  show migration information 
  do nothing 
```


Flok as a Module
----------------
Flok can be used as a module to ensure that migrations are up to date as a node application is started.  If any migrations are blocked the app could be programmed to exit without starting, ensuring data integrity.

```javascript
var http = require('http');
var flok = require('flok');

var app = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('hello world');
});

flok.up(function(err) {
  if (err) {
    console.error('Cannot start app, blocked migration: ', err.message);
    process.exit(1);
  }

  app.listen(8000);
});
```

There are other public methods on flok, which can be called, but aren't yet covered in the documentation.  Check the source for details.
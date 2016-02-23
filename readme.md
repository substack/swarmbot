# swarmbot

mirroring for a p2p mesh of [swarmlogs][1]

swarmbots are useful for improving the availability of a swarmlog by running
dedicated mirroring peers for a list of public keys.

This tool consists of 4 parts:

* swarmbot api
* swarmbot rpc interface
* swarmbot command
* swarmbot daemon

Heavily inspired by [scuttlebot][6].

# command-line usage

On a system with high uptime, it's useful to set up a swarmbot to mirror other
nodes on poor connections or in other geographic locations for redundancy.

This is easiest to do with the swarmbot command.

```
swarmbot id
  Print PUBKEY for the swarmbot mirror feed.

swarmbot mirror PUBKEY
  Mirror a PUBKEY.

swarmbot unmirror PUBKEY
  Stop mirroring a PUBKEY.

swarmbot mirroring
  Show mirroring PUBKEYs.

swarmbot server
  Listen in the foreground.

Options for all commands:

  --hub=HUB        Use a signalhub at HUB.
  --plugin=PLUGIN  Use a PLUGIN.

```

# rpc usage

Applications that write to a swarmlog might want to register their keys with the
swarmlog daemon on the local system. If the daemon isn't running, the rpc
endpoint will automatically spawn it.

``` js
var RPC = require('swarmbot/rpc')
```

## var rpc = RPC(opts)

Create new `rpc` handle from:

* `opts.dir` - directory to use for pid/sock/db files. default: `~/.config/swarmbot`
* `opts.hubs` - array of [signalhub][2] URL strings
* `opts.plugins` - array of module paths to use as plugins

## rpc.id(cb)

Get the public key of the swarmbot as `cb(err, id)`.

## rpc.mirror(id, cb)

Mirror the public key `id`.

## rpc.unmirror(id, cb)

Stop mirroring the public key `id`.

## rpc.mirroring(cb)

List the public keys being mirrored as `cb(err, ids)`.

# api example

Using the API directly

First, we will generate cryptographic keypairs for a publisher and a mirror
node:

```
$ node -pe "JSON.stringify(require('ssb-keys').generate())" > publish.json
$ node -pe "JSON.stringify(require('ssb-keys').generate())" > mirror.json
```

Now we can create a swarmlog publisher:

``` js
var swarmlog = require('swarmlog')
var level = require('level')
var chloride = require('chloride/browser')

var log = swarmlog({
  db: level('/tmp/publish.db'),
  hubs: ['https://signalhub.mafintosh.com'],
  sodium: chloride,
  valueEncoding: 'json',
  keys: require('./publish.json')
})

setInterval(function () {
  log.append({
    msg: 'HELLOx' + Math.floor((Date.now()/1000) % 1000)
  })
}, 1000)
```

and run the publisher:

```
$ electron-spawn publish.js
```

Next we can create a swarmbot mirror:

``` js
var swarmbot = require('swarmbot')
var level = require('level')
var chloride = require('chloride/browser')

var bot = swarmbot({
  db: level('/tmp/mirror.db'),
  hubs: ['https://signalhub.mafintosh.com'],
  sodium: chloride,
  keys: require('./mirror.json')
})

var argv = process.argv.slice(2)
if (argv[0] === 'mirror') {
  bot.mirror(argv[1], function (err) {
    if (err) console.error(err)
    else console.log('ok')
  })
} else if (argv[0] === 'mirroring') {
  bot.mirroring(function (err, ids) {
    ids.forEach(function (x) { console.log(x.id) })
  })
} else if (argv[0] === 'log') {
  bot.open(argv[1]).createReadStream({ live: true })
    .on('data', function (row) { console.log(row.value) })
}
```

We can mirror the publisher public key:

```
$ json public < publish.json
d9h38QqCVLjmCTdB5vNHF5s/QrLmMYbm0B8UoYazZbg=.ed25519
$ electron-spawn mirror.js mirror d9h38QqCVLjmCTdB5vNHF5s/QrLmMYbm0B8UoYazZbg=.ed25519
ok
^c
$ electron-spawn mirror.js mirroring
d9h38QqCVLjmCTdB5vNHF5s/QrLmMYbm0B8UoYazZbg=.ed25519
^c
```

and from the mirror node, we can log all the data from the publisher:

```
$ electron-spawn mirror.js log d9h38QqCVLjmCTdB5vNHF5s/QrLmMYbm0B8UoYazZbg=.ed25519
{ msg: 'HELLOx998' }
{ msg: 'HELLOx999' }
{ msg: 'HELLOx0' }
{ msg: 'HELLOx1' }
{ msg: 'HELLOx2' }
^c
```

# api

``` js
var swarmbot = require('swarmbot')
```

## var bot = swarmbot(opts)

Create a swarmbot mirror from `opts`:

* `opts.keys` - keypair data from `require('ssb-keys').generate()`
* `opts.hubs` - array of [signalhub][2] URL strings
* `opts.sodium` - sodium cryptographic API
(`require('chloride')` or `require('chloride/browser')`)
* `opts.wrtc` - provide a [webrtc][5] instance to use webrtc outside of the
browser

You can specify a single data store:

* `opts.db` - [leveldb][3] instance (use [level-browserify][4] in the browser)

or you can specify each data store separately:

* `opts.logdb` - [leveldb][3] instance for the logdb
* `opts.idb` - [leveldb][4] instance for indexing

Separating the data stores can be useful for upgrades and plugins where the log
serves as the source of truth and the indexes present materialized views on the
log that can be rebuilt when the index requirements change.

## bot.mirror(id, opts={}, cb)

Mirror the swarmlog that has the public key `id`, remembering `id` when the
swarmbot starts up in the future.

## bot.unmirror(id, opts={}, cb)

Stop mirroring the swarmlog at `id` and stop mirroring automatically in the
future.

## var stream = bot.mirroring(cb)

Return a readable object `stream` with all the nodes that are currently being mirrored.

Each mirror object `row` in the object stream has:

* `row.id` - the public key of the remote swarmlog
* `row.key` - the key of the document that first initialized the mirroring

Optionally read the data as `cb(err, mirrors)`.

## var log = bot.open(id, opts={})

Open a [swarmlog][1] to `id`.

## bot.close(id)

Close the connection for `id`.

## bot.destroy()

Close all open connections.

## bot.on('open', function (id, log) {})

When a swarmlog is opened, this event fires with the `id` and `log`.

## bot.on('close', function (id, log) {})

When a swarmlog is closed, this event fires with the `id` and `log`.

## var db = bot.db(name)

Request a prefixed database handle `db` for a plugin called `name`.

# plugin api

Plugins are modules that receive a swarmbot instance as their first argument and
command-line options as their second argument.

For example, this plugin will print messages when a log is opened or closed:

``` js
module.exports = function (bot, opts) {
  bot.on('open', function (id, log) { console.log('OPEN', id) })
  bot.on('close', function (id, log) { console.log('CLOSE', id) })
}
```

# install

To get the library:

```
npm install swarmbot
```

To get the swarmbot command:

```
npm install -g swarmbot
```

# license

BSD

[1]: https://npmjs.com/package/swarmlog
[2]: https://npmjs.com/package/signalhub
[3]: https://npmjs.com/package/level
[4]: https://npmjs.com/package/level-browserify
[5]: https://npmjs.com/package/wrtc
[6]: https://www.npmjs.com/package/scuttlebot

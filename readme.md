# swarmbot

mirroring for a p2p mesh of [swarmlogs][1]

This tool consists of 4 parts:

* swarmbot api
* swarmbot rpc interface
* swarmbot command
* swarmbot daemon

[1]: https://npmjs.com/package/swarmlog

# api example

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

```
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

#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var xtend = require('xtend')

var minimist = require('minimist')
var argv = minimist(process.argv.slice(2), {
  alias: { h: 'help' }
})

var RPC = require('./rpc')
var cmd = argv._[0]
if (cmd === 'server') {
  RPC(xtend(argv, { fg: true }))
} else if (cmd === 'help' || argv.help) {
  return usage()
} else if (cmd === 'id') {
  RPC(argv).id(function (err, id) {
    if (id) console.log(id)
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'mirror') {
  RPC(argv).mirror(argv._[1], function (err) {
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'unmirror') {
  RPC(argv).unmirror(argv._[1], function (err) {
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'mirroring') {
  RPC(argv).mirroring(function (err, ids) {
    if (err) return error(err)
    ids.forEach(function (id) {
      console.log(id.key)
    })
  })
} else {
  usage(function () { process.exit(1) })
}

function error (err) {
  console.error((err.message || err) + '\n')
  process.exit(1)
}

function usage (cb) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  r.pipe(process.stdout)
  if (cb) r.once('end', cb)
}

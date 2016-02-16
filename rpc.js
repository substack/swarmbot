#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var autod = require('auto-daemon')
var listen = require('auto-daemon/listen')
var ssbkeys = require('ssb-keys')
var mkdirp = require('mkdirp')
var xtend = require('xtend')
var homedir = require('homedir')
var EventEmitter = require('events').EventEmitter
var Iface = require('./iface.js')
var rpcfile = require.resolve('./iface.js')
var electronPath = require.resolve('electron-spawn/cli.js')

module.exports = function (opts) {
  if (!opts) opts = {}
  if (typeof opts === 'string') opts = { dir: opts }
  if (!opts.dir) opts.dir = path.join(homedir(), '.config/swarmbot')

  var pending = 2
  fs.stat(path.join(opts.dir, 'keys.json'), function (err, stat) {
    if (stat) return done()
    fs.writeFile(path.join(opts.dir, 'keys.json'),
      JSON.stringify(ssbkeys.generate()), done)
  })
  mkdirp(opts.dir, done)

  var methods = new EventEmitter
  var queue = []
  var methodNames = Object.keys(Iface.prototype)
    .filter(function (key) { return !/^_/.test(key) })
  methodNames.forEach(function (name) {
    methods[name] = function () {
      queue.push({ name: name, args: arguments })
    }
  })
  return methods

  function done (err) {
    if (err) methods.emit('error', err)
    else if (--pending === 0) ready()
  }

  function ready () {
    var aopts = {
      rpcfile: rpcfile,
      sockfile: path.join(opts.dir, 'sock'),
      pidfile: path.join(opts.dir, 'pid'),
      methods: methodNames,
      debug: true,
      autoclose: true,
      exit: true,
      args: [ '--dir', opts.dir ],
      execPath: electronPath
    }
    if (opts.fg) {
      listen(Iface, xtend(aopts, { autoclose: false }))
    } else {
      autod(aopts, function (err, r, c) {
        if (err) methods.emit('error', err)
        else bindMethods(r)
      })
    }
  }

  function bindMethods (rpc) {
    methodNames.forEach(function (name) {
      methods[name] = rpc[name]
    })
    queue.splice(0).forEach(function (q) {
      methods[q.name].apply(methods, q.args)
    })
  }
}

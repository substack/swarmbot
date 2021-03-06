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
var treekill = require('tree-kill')

var resolve = require('resolve')
var electronSpawnPath = require.resolve('electron-spawn/cli.js')
var electronPath = resolve.sync('.bin/electron')
var binPath = path.dirname(electronPath)

module.exports = function (opts) {
  if (!opts) opts = {}
  if (typeof opts === 'string') opts = { dir: opts }
  if (!opts.dir) opts.dir = path.join(homedir(), '.config/swarmbot')

  var args = [].concat(opts.args).filter(Boolean)
  if (opts.dir) args.push('--dir', opts.dir)
  ;[].concat(opts.hub, opts.hubs).forEach(function (hub) {
    if (hub) args.push('--hub', hub)
  })
  ;[].concat(opts.plugin, opts.plugins).forEach(function (plugin) {
    if (plugin) args.push('--plugin', plugin)
  })

  var pending = 2
  mkdirp(path.join(opts.dir, 'node_modules'), function (err) {
    fs.stat(path.join(opts.dir, 'keys.json'), function (err, stat) {
      if (stat) return done()
      fs.writeFile(path.join(opts.dir, 'keys.json'),
        JSON.stringify(ssbkeys.generate()), done)
    })
    var configfile = path.join(opts.dir, 'config.json')
    args.push('--configfile', configfile)
    fs.stat(configfile, function (err, stat) {
      if (!stat) return done()
      fs.readFile(configfile, 'utf8', function (err, src) {
        if (err) return done()
        try { var config = JSON.parse(src) }
        catch (err) { return done() }
        if (config && config.hubs) {
          config.hubs.forEach(function (hub) {
            args.push('--hub', hub)
          })
        }
        if (config && config.plugins) {
          config.plugins.forEach(function (plugin) {
            args.push('--plugin', plugin)
          })
        }
        done()
      })
    })
  })

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
      methods: methodNames.map(function (key) {
        return /Stream$/.test(key) ? key + ':s' : key
      }),
      debug: true,
      autoclose: true,
      exit: true,
      args: args,
      env: xtend(process.env, {
        PATH: binPath + ':' + process.env.PATH
      }),
      execPath: electronSpawnPath
    }
    if (opts.fg) {
      var server = listen(Iface, xtend(aopts, { autoclose: false }))
      server.once('ready', function () {
        autod(aopts, function (err, r, c) { c.end() })
          .on('process', onproc)
      })
    } else {
      autod(aopts, function (err, r, c) {
        if (err) methods.emit('error', err)
        else bindMethods(r)
      }).on('process', onproc)
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
  function onproc (ps) {
    process.once('SIGINT', onkill)
    process.once('SIGTERM', onkill)
    function onkill () {
      treekill(ps.pid, 'SIGTERM', function () {
        process.exit(0)
      })
    }
    ps.once('exit', function (code) {
      treekill(ps.pid)
      process.exit(code)
    })
  }
}

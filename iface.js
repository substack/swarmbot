var EventEmitter = require('events').EventEmitter
var minimist = require('minimist')
var fs = require('fs')
var path = require('path')
var inherits = require('inherits')
var once = require('once')
var level = require('level')
var sodium = require('chloride')
var swarmbot = require('./')
var RPC = require('./rpc.js')
var resolve = require('resolve')

var iface = null
module.exports = function (server, stream, args) {
  if (!iface) iface = new Iface(server, stream, args)
  Object.keys(Iface.prototype).forEach(function (key) {
    if (typeof iface[key] === 'function') {
      iface[key] = iface[key].bind(iface)
    }
  })
  return iface
}
module.exports.prototype = Iface.prototype
inherits(Iface, EventEmitter)

function Iface (server, stream, args) {
  var self = this
  if (!(self instanceof Iface)) return new Iface(server, stream, args)
  EventEmitter.call(self)
  var argv = minimist(args)
  self.keys = require(path.join(argv.dir, 'keys.json'))
  var hubs = [].concat(argv.hub, argv.hubs).filter(Boolean)
  if (hubs.length) {
    self.swarmbot = swarmbot({
      logdb: level(path.join(argv.dir, 'log.db')),
      idb: level(path.join(argv.dir, 'index.db')),
      hubs: hubs,
      keys: self.keys,
      sodium: sodium
    })
    self.swarmbot.on('open', function () { self.emit('ref') })
    self.swarmbot.on('close', function () { self.emit('unref') })
  }
  self.configfile = argv.configfile

  var plugins = [].concat(argv.plugin, argv.plugins).filter(Boolean)
  plugins.forEach(function (name) {
    try {
      var file = resolve.sync(name, { basedir: argv.dir })
      var fn = require(file)
    }
    catch (err) { return self.emit('error', err) }
    if (typeof fn !== 'function') {
      self.emit('error', new Error('expected function export'
        + ' from ' + name + ' plugin, received: ' + typeof fn))
    } else if (self.swarmbot) fn(self.swarmbot, argv)
  })
}

Iface.prototype.configFile = function (cb) {
  cb(null, this.configfile)
}

Iface.prototype.readConfig = function (cb) {
  fs.readFile(this.configfile, 'utf8', function (err, src) {
    if (err) return cb(err)
    try { var config = JSON.parse(src) }
    catch (err) { return cb(err) }
    cb(null, config)
  })
}

Iface.prototype.writeConfig = function (config, cb) {
  var src = JSON.stringify(config, null, 2)
  fs.writeFile(this.configfile, src, cb)
}

Iface.prototype.pid = function (cb) {
  cb(null, process.pid)
}

Iface.prototype.id = function (cb) {
  cb(null, this.keys.public)
}

Iface.prototype.mirror = function (id, cb) {
  if (!this.swarmbot) cb(new Error('no hubs configured'))
  else this.swarmbot.mirror(id, cb)
}

Iface.prototype.unmirror = function (id, cb) {
  if (!this.swarmbot) cb(new Error('no hubs configured'))
  else this.swarmbot.unmirror(id, cb)
}

Iface.prototype.mirroring = function (cb) {
  if (!this.swarmbot) cb(new Error('no hubs configured'))
  else this.swarmbot.mirroring(cb)
}

Iface.prototype.emitEvent = function () {
  if (!this.swarmbot) cb(new Error('no hubs configured'))
  else this.swarmbot.emit.apply(this.swarmbot, arguments)
}

Iface.prototype.replicateStream = function (id, cb) {
  cb = once(cb || noop)
  if (!this.swarmbot) return cb(new Error('no hubs configured'))
  var log = this.swarmbot.logs[id]
  if (!log) return cb(new Error('no log by that id'))
  var stream = log.replicate()
  stream.on('error', cb)
  stream.on('end', function () { cb(null) })
  return stream
}

function noop () {}

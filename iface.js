var EventEmitter = require('events').EventEmitter
var minimist = require('minimist')
var fs = require('fs')
var path = require('path')
var inherits = require('inherits')
var level = require('level')
var sodium = require('chloride')
var swarmbot = require('./')

var iface = null
module.exports = function (server, stream, args) {
  if (!iface) iface = new Iface(server, stream, args)
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
  self.swarmbot = swarmbot({
    logdb: level(path.join(argv.dir, 'log.db')),
    idb: level(path.join(argv.dir, 'index.db')),
    hubs: [].concat(argv.hub, argv.hubs),
    keys: self.keys,
    sodium: sodium
  })
  self.swarmbot.on('open', function () { self.emit('ref') })
  self.swarmbot.on('close', function () { self.emit('unref') })
}

Iface.prototype.id = function (cb) {
  cb(null, this.keys.public)
}

Iface.prototype.mirror = function (id, cb) {
  this.swarmbot.mirror(id, cb)
}

Iface.prototype.unmirror = function (id, cb) {
  this.swarmbot.unmirror(id, cb)
}

Iface.prototype.mirroring = function (cb) {
  this.swarmbot.mirroring(cb)
}

function noop () {}

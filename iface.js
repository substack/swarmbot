var EventEmitter = require('events').EventEmitter
var minimist = require('minimist')
var fs = require('fs')
var has = require('has')
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
  if (!(this instanceof Iface)) return new Iface(server, stream, args)
  EventEmitter.call(this)
  var iface = new EventEmitter
  var argv = minimist(args)
  this.keys = require(path.join(argv.dir, 'keys.json'))
  this.swarmbot = swarmbot({
    logdb: level(path.join(argv.dir, 'log.db')),
    idb: level(path.join(argv.dir, 'index.db')),
    hubs: [ 'https://signalhub.mafintosh.com' ],
    keys: this.keys,
    sodium: sodium
  })
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

var swarmlog = require('swarmlog')
var sub = require('subleveldown')
var hindex = require('hyperlog-index')
var duplexify = require('duplexify')
var through = require('through2')
var once = require('once')
var defined = require('defined')
var xtend = require('xtend')
var has = require('has')
var pump = require('pump')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var MIRROR_DATA = 'md', MIRROR_INDEX = 'mi', LOG = 'l!'
var LOGDB = 'l', IDB = 'i', PLUGINDB = 'p'

module.exports = Swarmbot
inherits(Swarmbot, EventEmitter)

function Swarmbot (opts) {
  var self = this
  if (!(self instanceof Swarmbot)) return new Swarmbot(opts)
  EventEmitter.call(self)
  var keys = opts.keys || {}
  self.policy = opts.policy || {}

  self.id = defined(
    opts.publicKey, opts.public, opts.pub, opts.identity, opts.id,
    keys.publicKey, keys.public, keys.pub, keys.identity, keys.id
  )
  self.logdb = opts.logdb
  if (!self.logdb && opts.db) self.logdb = sub(opts.db, LOGDB)
  self.idb = opts.idb
  if (!self.idb && opts.db) self.idb = sub(opts.db, IDB)
  self._plugindb = opts.plugindb
  if (!self._plugindb && opts.db) self._plugindb = sub(opts.db, PLUGINDB)

  self._swopts = {
    wrtc: opts.wrtc,
    hubs: opts.hubs,
    sodium: opts.sodium,
    valueEncoding: 'json'
  }
  self._mdb = {
    data: sub(self.idb, MIRROR_DATA, { valueEncoding: 'json' }),
    index: sub(self.idb, MIRROR_INDEX),
  }
  self.logs = {}
  self.log = self.open(self.id, { keys: opts.keys })
  self.indexes = {}
  self._createMirrorIndex(self.id, self.log)
  self.on('mirror', function (id) { self.open(id) })
  self.on('unmirror', function (id) { self.close(id) })
  self._resume()
}

Swarmbot.prototype._mirrorIndexReady = function (cb) {
  var self = this
  if (!self.indexes) return process.nextTick(function () {
    self._mirrorIndexReady(cb)
  })
  var keys = Object.keys(self.indexes)
  var pending = 1 + keys.length
  keys.forEach(function (key) {
    self.indexes[key].ready(function () {
      if (--pending === 0) cb()
    })
  })
  if (--pending === 0) cb()
}

Swarmbot.prototype._createMirrorIndex = function (id, log) {
  var self = this
  if (has(self.indexes, id)) return self.indexes[id]
  var ix = hindex({ log: log, db: self._mdb.index, map: map })
  self.indexes[id] = ix
  return ix

  function map (row, next) {
    if (row.value && row.value.type === 'bot.mirror'
    && row.value.id) {
      var rec = { id: id, key: row.key }
      if (self.policy.remirror && row.value && row.value.remirror) {
        self.emit('mirror', row.value.id)
      }
      self._mdb.data.put(row.value.id, rec, next)
    } else if (row.value && row.value.type === 'bot.unmirror'
    && row.value.id) {
      self._mdb.data.del(row.value.id, next)
      self.emit('unmirror')
    } else next()
  }
}

Swarmbot.prototype._resume = function () {
  var self = this
  var r = self.mirroring()
  r.pipe(through.obj(function (m, enc, next) {
    self.open(m.id)
    next()
  }))
}

Swarmbot.prototype.mirroring = function (cb) {
  var self = this
  if (cb) cb = once(cb)
  var d = duplexify.obj()
  var results = cb ? [] : null
  d.setWritable(null)
  self._mirrorIndexReady(function () {
    d.setReadable(pump(
      self._mdb.data.createReadStream(),
      through.obj(write, end)
    ))
  })
  if (cb) d.once('error', cb)
  return d

  function write (row, enc, next) {
    var stream = this
    var doc = { id: row.key, key: row.value.key }
    self.log.get(row.value, function (err, rec) {
      if (rec && rec.value && rec.value.remirror !== undefined) {
        doc.remirror = rec.value.remirror
      }
      if (results) results.push(doc)
      stream.push(doc)
      next()
    })
  }
  function end (next) {
    if (cb) cb(null, results)
    next()
  }
}

Swarmbot.prototype.mirror = function (id, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  if (!opts) opts = {}
  var doc = { type: 'bot.mirror', id: id }
  if (opts.remirror) doc.remirror = opts.remirror
  if (opts.links) self.log.add(opts.links, doc, opts, onadd)
  else self.log.append(doc, opts, onadd)

  function onadd (err, node) {
    if (err) cb(err)
    else {
      self.open(id)
      cb(null, node)
    }
  }
}

Swarmbot.prototype.unmirror = function (ids, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  if (!opts) opts = {}
  var doc = { type: 'bot.unmirror', id: id }
  if (opts.links) this.log.add(opts.links, doc, opts, onadd)
  else this.log.append(doc, opts, onadd)
}

Swarmbot.prototype.open = function (id, opts) {
  var self = this
  if (id && typeof id === 'object' && !opts) {
    opts = id
    id = opts.id
  }
  if (!has(self.logs, id)) {
    var log = self._createLog(id, opts)
    if (self.policy.remirror) {
      self._mirrorIndexReady(onready)
    }
    self.emit('open', id, log)
    return log
  }
  return self.logs[id]

  function onready () {
    self._mdb.data.get(id, function (err, rec) {
      if (!rec) return
      var slog = self.open(rec.id)
      slog.get(rec.key, function (err, doc) {
        if (!doc || !doc.value) return
        if (doc.value.remirror) {
          self._createMirrorIndex(id, self.logs[id])
        }
      })
    })
  }
}

Swarmbot.prototype._createLog = function (id, opts) {
  var log = swarmlog(xtend(this._swopts, xtend(opts, {
    id: id,
    db: sub(this.logdb, LOG + id)
  })))
  this.logs[id] = log
  return log
}

Swarmbot.prototype.close = function (id) {
  if (has(this.logs, id)) {
    this.emit('close', id, this.logs[id])
    this.logs[id].swarm.peers.forEach(function (peer) {
      if (peer.close) peer.close()
    })
    delete this.logs[id]
  }
}

Swarmbot.prototype.destroy = function () {
  var self = this
  Object.keys(self.logs).forEach(function (id) {
    self.close(id)
  })
}

Swarmbot.prototype.db = function (name) {
  return sub(this._plugindb, name)
}

function noop () {}

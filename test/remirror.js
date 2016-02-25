var swarmbot = require('../')
var memdb = require('memdb')
var test = require('tape')
var signalhub = require('signalhub/server')
var chloride = require('chloride')
var ssbkeys = require('ssb-keys')

test('remirror', function (t) {
  t.plan(6)
  var hub = signalhub()
  hub.listen(function () {
    var hubs = ['http://localhost:' + hub.address().port]
    var keys0 = ssbkeys.generate()
    var bot0 = swarmbot({
      db: memdb(),
      hubs: hubs,
      sodium: chloride,
      keys: keys0,
      policy: {
        remirror: true
      },
      debug: true
    })
    var keys1 = ssbkeys.generate()
    var bot1 = swarmbot({
      db: memdb(),
      hubs: hubs,
      sodium: chloride,
      keys: keys1
    })
    var keys2 = ssbkeys.generate()
    var bot2 = swarmbot({
      db: memdb(),
      hubs: hubs,
      sodium: chloride,
      keys: keys2
    })

    bot0.mirror(keys1.public, { remirror: true }, function (err, node) {
      t.error(err)
      bot1.mirror(keys2.public, { remirror: true }, function (err, node) {
        t.error(err)
      })
      bot1.once('open', function (id) {
        t.equal(id, keys2.public, '1 mirroring 2')
        bot1.mirroring(function (err, results) {
          t.deepEqual(
            results.map(rmap), [ keys2.public ],
            '1 mirroring list')
        })
      })
      bot0.once('open', function (id) {
        t.equal(id, keys2.public, '0 mirroring 2')
        bot0.mirroring(function (err, results) {
          t.deepEqual(
            results.map(rmap).sort(),
            [ keys1.public, keys2.public ].sort(),
            '0 mirroring list'
          )
        })
      })
    })
    function rmap (r) { return r.id }
    t.once('end', function () {
      bot0.destroy()
      bot1.destroy()
      bot2.destroy()
    })
  })
})

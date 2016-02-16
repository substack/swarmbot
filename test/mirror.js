var swarmbot = require('../')
var memdb = require('memdb')
var wrtc = require('wrtc')
var test = require('tape')
var signalhub = require('signalhub/server')
var chloride = require('chloride')
var ssbkeys = require('ssb-keys')

test('mirror', function (t) {
  t.plan(5)
  var hub = signalhub()
  hub.listen(function () {
    var keys0 = ssbkeys.generate()
    var bot0 = swarmbot({
      db: memdb(),
      wrtc: wrtc,
      hubs: ['http://localhost:' + hub.address().port],
      sodium: chloride,
      keys: keys0
    })
    var keys1 = ssbkeys.generate()
    var bot1 = swarmbot({
      db: memdb(),
      wrtc: wrtc,
      hubs: ['http://localhost:' + hub.address().port],
      sodium: chloride,
      keys: keys1
    })
    bot1.mirror(keys0.public, function (err, node) {
      t.error(err)
      bot1.mirroring(function (err, results) {
        t.error(err)
        t.deepEqual(results, [
          { id: keys0.public, key: node.key }
        ])
      })
    })
    bot1.open(keys0.public).createReadStream({ live: true })
      .on('data', function (row) {
        t.deepEqual(row.value, { msg: 'HELLO' })
      })
    bot1.open(keys1.public).createReadStream({ live: true })
      .on('data', function (row) {
        t.deepEqual(row.value.type, 'bot.mirror')
      })
    bot0.log.append({ msg: 'HELLO' })
    t.once('end', function () {
      bot0.destroy()
      bot1.destroy()
    })
  })
})

var swarmbot = require('../')
var memdb = require('memdb')
var wrtc = require('wrtc')
var test = require('tape')
var signalhub = require('signalhub/server')
var chloride = require('chloride')
var ssbkeys = require('ssb-keys')

test('mirror', function (t) {
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
      sodium: chloride
      keys: keys1
    })
    bot1.follow(keys0.public, function (err) {
      t.error(err)
    })
    bot1.createReadStream({ live: true })
      .on('data', function (row) {
        console.log('row=', row)
      })
  })
})

var swarmlog = require('swarmlog')
var level = require('level')
var chloride = require('chloride/browser')

var log = swarmlog({
  db: level('/tmp/publish.db'),
  hubs: ['https://signalhub.mafintosh.com'],
  sodium: chloride,
  valueEncoding: 'json',
  keys: require('./publish.json')
})

setInterval(function () {
  log.append({
    msg: 'HELLOx' + Math.floor((Date.now()/1000) % 1000)
  })
}, 1000)

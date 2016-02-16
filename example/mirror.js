var swarmbot = require('../')
var level = require('level')
var chloride = require('chloride/browser')

var bot = swarmbot({
  db: level('/tmp/mirror.db'),
  hubs: ['https://signalhub.mafintosh.com'],
  sodium: chloride,
  keys: require('./mirror.json')
})

var argv = process.argv.slice(2)
if (argv[0] === 'mirror') {
  bot.mirror(argv[1], function (err) {
    if (err) console.error(err)
    else console.log('ok')
  })
} else if (argv[0] === 'mirroring') {
  bot.mirroring(function (err, ids) {
    ids.forEach(function (x) { console.log(x.id) })
  })
} else if (argv[0] === 'log') {
  bot.open(argv[1]).createReadStream({ live: true })
    .on('data', function (row) { console.log(row.value) })
}

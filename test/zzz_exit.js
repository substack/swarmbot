var test = require('tape')

test('exit', function (t) {
  t.end()
  process.exit(0)
})

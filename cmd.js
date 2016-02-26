#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var xtend = require('xtend')
var spawn = require('child_process').spawn

var minimist = require('minimist')
var argv = minimist(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: [ 'version' ]
})
if (argv.version) {
  return console.log(require('./package.json').version)
}

var RPC = require('./rpc.js')
var cmd = argv._[0]
if (cmd === 'server') {
  RPC(xtend(argv, { fg: true }))
} else if (cmd === 'help' || argv.help) {
  return usage()
} else if (cmd === 'emit') {
  var args = argv._.slice(1)
  RPC(argv).emitEvent.apply(null, args)
} else if (cmd === 'id') {
  RPC(argv).id(function (err, id) {
    if (id) console.log(id)
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'mirror') {
  RPC(argv).mirror(argv._[1], function (err) {
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'unmirror') {
  RPC(argv).unmirror(argv._[1], function (err) {
    if (err) error(err)
    else process.exit(0)
  })
} else if (cmd === 'mirroring') {
  RPC(argv).mirroring(function (err, ids) {
    if (err) return error(err)
    ids.forEach(function (id) {
      console.log(id.key)
    })
    process.exit(0)
  })
} else if (cmd === 'pid') {
  RPC(argv).pid(function (err, pid) {
    if (err) return error(err)
    console.log(pid)
    process.exit(0)
  })
} else if (cmd === 'kill' || cmd === 'stop') {
  RPC(argv).pid(function (err, pid) {
    if (err) return error(err)
    process.kill(pid)
    process.exit(0)
  })
} else if (cmd === 'hubs' && argv._[1] === 'add' && argv._[2]) {
  var rpc = RPC(argv)
  rpc.readConfig(function (err, config) {
    if (!config) config = {}
    if (!config.hubs) config.hubs = []
    config.hubs.push(argv._[2])
    rpc.writeConfig(config, function (err) {
      if (err) error(err)
      else process.exit(0)
    })
  })
} else if (cmd === 'hubs' && /^(rm|del|remove)$/.test(argv._[1]) && argv._[2]) {
  var rpc = RPC(argv)
  rpc.readConfig(function (err, config) {
    if (!config) config = {}
    if (!config.hubs) config.hubs = []
    config.hubs = config.hubs.filter(function (hub) {
      return hub !== argv._[2]
    })
    rpc.writeConfig(config, function (err) {
      if (err) error(err)
      else process.exit(0)
    })
  })
} else if (cmd === 'hubs' && argv._.length === 1) {
  RPC(argv).readConfig(function (err, config) {
    var hubs = (config || {}).hubs || []
    hubs.forEach(function (hub) {
      console.log(hub)
    })
    process.exit(0)
  })
} else if (cmd === 'plugins' && argv._[1] === 'install'
&& argv._.length === 3) {
  var rpc = RPC(argv)
  rpc.configFile(function (err, file) {
    if (err) return error(err)
    var name = path.basename(argv._[2].split('@')[0])
    var ps = spawn('npm', ['install',argv._[2]], {
      stdio: 'inherit',
      cwd: path.dirname(file)
    })
    ps.on('exit', function (code) {
      if (code !== 0) return process.exit(code)
      rpc.readConfig(function (err, config) {
        if (err) return error(err)
        if (!config) config = {}
        if (!config.plugins) config.plugins = []
        config.plugins.push(name)
        rpc.writeConfig(config, function (err) {
          if (err) return error(err)
          else process.exit(0)
        })
      })
    })
  })
} else if (cmd === 'plugins' && /^(ls|list|)$/.test(argv._[1] || '')) {
  RPC(argv).readConfig(function (err, config) {
    if (err) return error(err)
    var plugins = (config || {}).plugins || []
    plugins.forEach(function (plugin) {
      console.log(plugin)
    })
    process.exit(0)
  })
} else if (cmd === 'plugins' && argv._[1] === 'add' && argv._.length === 3) {
  var rpc = RPC(argv)
  rpc.readConfig(function (err, config) {
    if (err) return error(err)
    if (!config) config = {}
    if (!config.plugins) config.plugins = []
    config.plugins.push(argv._[2])
    rpc.writeConfig(config, function (err) {
      if (err) error(err)
      else process.exit(0)
    })
  })
} else if (cmd === 'plugins' && /^(rm|remove|del)$/.test(argv._[1])
&& argv._.length === 3) {
  var rpc = RPC(argv)
  rpc.readConfig(function (err, config) {
    if (err) return error(err)
    if (!config) config = {}
    if (!config.plugins) config.plugins = []
    config.plugins = config.plugins.filter(function (plugin) {
      return plugin !== argv._[2]
    })
    rpc.writeConfig(config, function (err) {
      if (err) error(err)
      else process.exit(0)
    })
  })
} else if (cmd === 'config' && argv._[1] === 'file') {
  RPC(argv).configFile(function (err, file) {
    if (err) return error(err)
    console.log(file)
    process.exit(0)
  })
} else if (cmd === 'config' && /^(ls|list|)$/.test(argv._[1] || '')) {
  RPC(argv).readConfig(function (err, config) {
    if (err) return error(err)
    console.log(JSON.stringify(config, null, 2))
    process.exit(0)
  })
} else {
  usage(function () { process.exit(1) })
}

function error (err) {
  console.error((err.message || err) + '\n')
  process.exit(1)
}

function usage (cb) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  r.pipe(process.stdout)
  if (cb) r.once('end', cb)
}

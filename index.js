#!/usr/bin/env node
const path = require('path')
const Watcher = require('./watcher')
const { runPipeline } = require('./pipeline')
const { createServer } = require('./server')
const Store = require('./store')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { rootPath: process.cwd(), port: 3456, interval: 120000, apiKey: process.env.NVIDIA_API_KEY || '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' }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--port=')) opts.port = parseInt(a.split('=')[1])
    else if (a === '--port' || a === '-p') opts.port = parseInt(args[++i])
    else if (a.startsWith('--interval=')) opts.interval = parseInt(a.split('=')[1])
    else if (a === '--interval' || a === '-i') opts.interval = parseInt(args[++i])
    else if (a.startsWith('--key=')) opts.apiKey = a.split('=')[1]
    else if (a === '--key' || a === '-k') opts.apiKey = args[++i]
    else if (!a.startsWith('-')) opts.rootPath = path.resolve(a)
  }

  return opts
}

async function main() {
  const opts = parseArgs()
  const store = new Store(opts.rootPath).init()

  console.log(`WWWS watching: ${opts.rootPath}`)
  console.log(`  port: ${opts.port}, interval: ${opts.interval}ms`)

  const server = createServer(store, opts.port)

  const watcher = new Watcher(opts.rootPath, opts.interval, async () => {
    console.log(`  scan ${new Date().toLocaleTimeString()} ...`)
    const result = await runPipeline(store, opts.apiKey, {
      onScanComplete: ({ total }) => {
        if (total > 0) {
          console.log(`  ${total} code files to analyze`)
          server.broadcast('scan-complete', { total })
        }
      },
      onFileAnalyzed: ({ path: fp, error, done, total }) => {
        const icon = error ? '!' : '.'
        console.log(`  ${icon} [${done}/${total}] ${fp}`)
        server.broadcast('file-analyzed', { path: fp, error, done, total })
      },
      onAllComplete: ({ total }) => {
        console.log(`  analysis complete: ${total} files`)
        server.broadcast('all-complete', { total })
      }
    })
    console.log(`  cycle ${result.delta.cycle}: ${Object.keys(result.files).length} files, ${result.delta.added.length} added, ${result.delta.modified.length} modified`)
    server.broadcast('index-complete', { cycle: result.delta.cycle, timestamp: result.delta.timestamp })
    return result
  })

  watcher.start()
  store.getStatus = () => ({
    rootPath: opts.rootPath, port: opts.port, interval: opts.interval,
    ...watcher.getStatus()
  })

  process.on('SIGINT', () => { watcher.stop(); server.close(); process.exit(0) })
  process.on('SIGTERM', () => { watcher.stop(); server.close(); process.exit(0) })
}

main().catch(err => { console.error(err); process.exit(1) })

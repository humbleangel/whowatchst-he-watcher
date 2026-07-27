const path = require('path')
const http = require('http')
const assert = require('assert')
const Store = require('../store')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) })
      })
    }).on('error', reject)
  })
}

async function run() {
  const { createServer } = require('../server')
  const fixture = path.join(__dirname, 'fixture')
  const store = new Store(fixture)
  store.folders = { 'src': { path: 'src', files: ['src/app.js'], subfolderCount: 0, fileCount: 1 } }
  store.files = { 'src/app.js': { path: 'src/app.js', lines: 15, summary: 'entry point', pieces: ['greet'], role: 'entry', isEntry: true } }
  store.pieces = { 'src/app.js:greet': { name: 'greet', type: 'function', consumes: ['name'], produces: ['string'] } }
  store.graph = [{ from: 'src/app.js:greet', to: 'lib/console:log', type: 'call' }]
  store.deltas = [{ cycle: 1, timestamp: new Date().toISOString(), added: [], removed: [], modified: [] }]

  const server = createServer(store, 3457)

  await new Promise(r => setTimeout(r, 200))

  try {
    const status = await fetch('http://localhost:3457/api/status')
    test('status returns 200', () => assert.strictEqual(status.status, 200))

    const folders = await fetch('http://localhost:3457/api/folders')
    test('folders returns array', () => assert.ok(Array.isArray(folders.data)))
    test('folders has src', () => assert.strictEqual(folders.data[0].path, 'src'))

    const files = await fetch('http://localhost:3457/api/files')
    test('files returns array', () => assert.ok(Array.isArray(files.data)))
    test('files has app.js', () => assert.strictEqual(files.data[0].path, 'src/app.js'))

    const pieces = await fetch('http://localhost:3457/api/pieces')
    test('pieces returns array', () => assert.ok(Array.isArray(pieces.data)))

    const graph = await fetch('http://localhost:3457/api/graph')
    test('graph returns array', () => assert.ok(Array.isArray(graph.data)))

    const delta = await fetch('http://localhost:3457/api/delta')
    test('delta returns object', () => assert.ok(delta.data.cycle === 1))

    const folderDetail = await fetch('http://localhost:3457/api/folder?path=src')
    test('folder detail returns path', () => assert.strictEqual(folderDetail.data.path, 'src'))

    const fileDetail = await fetch('http://localhost:3457/api/file?path=src/app.js')
    test('file detail returns path', () => assert.strictEqual(fileDetail.data.path, 'src/app.js'))
    test('file detail has pieces', () => assert.ok(fileDetail.data.pieces.length > 0))
  } finally {
    server.close()
  }
}

module.exports = { run, count: () => ({ passed, failed }) }

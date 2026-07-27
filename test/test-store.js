const Store = require('../store')
const path = require('path')
const os = require('os')
const fs = require('fs')
const assert = require('assert')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wwsw-test-'))
const store = new Store(tmpDir).init()

test('init creates .wwsw dir', () => assert.ok(fs.existsSync(path.join(tmpDir, '.wwsw'))))
test('init sets empty state', () => assert.strictEqual(Object.keys(store.folders).length, 0))
test('init sets cycle 0', () => assert.strictEqual(store.cycle, 0))

store.folders['src'] = { path: 'src', files: ['src/app.js'], subfolderCount: 0, fileCount: 1 }
store.files['src/app.js'] = { path: 'src/app.js', lines: 10, summary: 'test', pieces: ['main'] }
store.save('folders')
store.save('files')

const store2 = new Store(tmpDir).init()
test('load preserves folders', () => assert.ok(store2.folders['src']))
test('load preserves files', () => assert.strictEqual(store2.files['src/app.js'].lines, 10))

const snap = store.getSnapshot()
test('snapshot has folders', () => assert.ok(snap.folders['src']))
test('snapshot has files', () => assert.ok(snap.files['src/app.js']))

const prev = store.getSnapshot()
store.folders = { src: { path: 'src', files: ['src/app.js'], subfolderCount: 0, fileCount: 1 }, lib: { path: 'lib', files: [], subfolderCount: 0, fileCount: 0 } }
store.files = { 'src/app.js': { path: 'src/app.js', lines: 10, summary: 'test', pieces: ['main'] }, 'lib/helper.js': { path: 'lib/helper.js', lines: 5, summary: 'helper', pieces: [] } }
const curr = store.getSnapshot()
const delta = store.recordDelta(prev, curr)
test('delta has added', () => assert.ok(delta.added.includes('lib/helper.js')))
test('delta has cycle', () => assert.strictEqual(delta.cycle, 1))

fs.rmSync(tmpDir, { recursive: true, force: true })

module.exports = { count: () => ({ passed, failed }) }

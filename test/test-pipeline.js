const { runPipeline } = require('../pipeline')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

const fixture = path.join(__dirname, 'fixture')

// mock LLM to avoid real API calls
const llm = require('../llm')
const origAnalyze = llm.analyzeFile
llm.analyzeFile = async (fp) => ({
  blocks: [{ startLine: 1, endLine: 10, desc: 'mock block' }],
  pieces: [{ name: 'mockPiece', type: 'function', filesUsed: [fp], references: [], consumes: [], produces: [] }],
  summary: 'mock summary',
  error: null
})

async function run() {
  const Store = require('../store')
  const store = new Store(fixture).init()
  const result = await runPipeline(store, 'test-key', {
    onScanComplete: () => {},
    onFileAnalyzed: () => {},
    onAllComplete: () => {}
  })
  const { folders, files, graph, delta } = result

  // wait for background mock analysis to finish
  if (store._analysisPromise) await store._analysisPromise

  llm.analyzeFile = origAnalyze

  test('folders include src', () => assert.ok(folders.some(f => f.path === 'src')))
  test('folders include tests', () => assert.ok(folders.some(f => f.path === 'tests')))
  test('files include src/app.js', () => assert.ok(files[path.join('src', 'app.js')]))
  test('files include src/utils/math.js', () => assert.ok(files[path.join('src', 'utils', 'math.js')]))
  test('files include tests/math.test.js', () => assert.ok(files[path.join('tests', 'math.test.js')]))
  test('files include src/types.d.ts', () => assert.ok(files[path.join('src', 'types.d.ts')]))

  const appFile = files[path.join('src', 'app.js')]
  test('app.js has lines', () => assert.ok(appFile.lines > 0))
  test('app.js has role', () => assert.strictEqual(appFile.role, 'entry'))

  const typesFile = files[path.join('src', 'types.d.ts')]
  test('types.d.ts has role type', () => assert.strictEqual(typesFile.role, 'type'))

  const TEST_DIR = path.join(__dirname, 'fixture', '.wwsw')
  test('wwsw folder exists', () => assert.ok(fs.existsSync(TEST_DIR)))
  test('folders.json exists', () => assert.ok(fs.existsSync(path.join(TEST_DIR, 'folders.json'))))
  test('files.json exists', () => assert.ok(fs.existsSync(path.join(TEST_DIR, 'files.json'))))
  test('pieces.json exists', () => assert.ok(fs.existsSync(path.join(TEST_DIR, 'pieces.json'))))
  test('graph.json exists', () => assert.ok(fs.existsSync(path.join(TEST_DIR, 'graph.json'))))
  test('deltas.json exists', () => assert.ok(fs.existsSync(path.join(TEST_DIR, 'deltas.json'))))

  test('graph is an array', () => assert.ok(Array.isArray(graph)))
  test('delta has cycle', () => assert.ok(delta.cycle > 0))
  test('delta has timestamp', () => assert.ok(delta.timestamp))

  if (typeof cleanup === 'function') cleanup()
}

module.exports = { run, count: () => ({ passed, failed }) }

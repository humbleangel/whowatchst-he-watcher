const { scanFolders, isEntryPoint, detectRole, countLines, getEntryPoints } = require('../scanner')
const path = require('path')
const assert = require('assert')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

const fixture = path.join(__dirname, 'fixture')

const { folders, entryFolders } = scanFolders(fixture)

test('scan returns folders', () => assert.ok(folders.length > 0))
test('finds src folder', () => assert.ok(folders.some(f => f.path === 'src')))
test('finds src/utils folder', () => assert.ok(folders.some(f => f.path.endsWith('src\\utils') || f.path.endsWith('src/utils'))))
test('finds tests folder', () => assert.ok(folders.some(f => f.path === 'tests')))
test('finds config folder', () => assert.ok(folders.some(f => f.path === 'config')))
test('does not include .gitkeep files', () => {
  for (const f of folders) {
    for (const file of f.files) {
      if (path.basename(file) === '.gitkeep') throw new Error('.gitkeep found')
    }
  }
})

test('entry point detection (app.js)', () => assert.ok(isEntryPoint(path.join('src', 'app.js'))))
test('entry point (index.js)', () => assert.ok(isEntryPoint(path.join('src', 'index.js'))))
test('entry point (main.ts)', () => assert.ok(isEntryPoint('main.ts')))
test('not entry point (math.js)', () => assert.ok(!isEntryPoint('math.js')))

test('role detection: test', () => assert.strictEqual(detectRole('/project/tests/math.test.js'), 'test'))
test('role detection: entry', () => assert.strictEqual(detectRole('/project/src/app.js'), 'entry'))
test('role detection: config', () => assert.strictEqual(detectRole('/project/config/app.json'), 'config'))
test('role detection: type', () => assert.strictEqual(detectRole('/project/src/types.d.ts'), 'type'))
test('role detection: module default', () => assert.strictEqual(detectRole('/project/utils/math.js'), 'module'))

test('line count on app.js', () => {
  const appPath = path.join(fixture, 'src', 'app.js')
  const lines = countLines(appPath)
  assert.ok(lines > 0)
  assert.strictEqual(lines, 15)
})

module.exports = { count: () => ({ passed, failed }) }

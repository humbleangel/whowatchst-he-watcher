const { shouldIgnore, isTextFile } = require('../ignore')
const assert = require('assert')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

test('ignores node_modules', () => assert.ok(shouldIgnore('node_modules', '/x/node_modules')))
test('ignores .git', () => assert.ok(shouldIgnore('.git', '/x/.git')))
test('ignores .wwsw', () => assert.ok(shouldIgnore('.wwsw', '/x/.wwsw')))
test('ignores .exe files', () => assert.ok(shouldIgnore('foo.exe', '/x/foo.exe')))
test('ignores .dll files', () => assert.ok(shouldIgnore('foo.dll', '/x/foo.dll')))
test('ignores .png files', () => assert.ok(shouldIgnore('img.png', '/x/img.png')))
test('ignores package-lock.json', () => assert.ok(shouldIgnore('package-lock.json', '/x/package-lock.json')))
test('keeps .js files', () => assert.ok(!shouldIgnore('app.js', '/x/app.js')))
test('keeps .ts files', () => assert.ok(!shouldIgnore('app.ts', '/x/app.ts')))
test('keeps .rs files', () => assert.ok(!shouldIgnore('main.rs', '/x/main.rs')))
test('text file .js', () => assert.ok(isTextFile('app.js')))
test('text file .rs', () => assert.ok(isTextFile('main.rs')))
test('not text .exe', () => assert.ok(!isTextFile('foo.exe')))
test('not text .png', () => assert.ok(!isTextFile('img.png')))

module.exports = { count: () => ({ passed, failed }) }

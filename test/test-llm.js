const { buildPrompt, parseResponse } = require('../llm')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

let passed = 0, failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

const fixture = path.join(__dirname, 'fixture', 'src', 'utils', 'math.js')

test('buildPrompt produces numbered lines', () => {
  const prompt = buildPrompt(fixture)
  assert.ok(prompt.startsWith('1:'))
  assert.ok(prompt.includes('2:'))
  assert.ok(prompt.includes('function'))
})

test('parseResponse handles bare JSON', () => {
  const result = parseResponse('[{"startLine":1,"endLine":3,"name":"add","type":"function","summary":"adds two numbers","consumes":[],"produces":[]}]')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result[0].name, 'add')
})

test('parseResponse handles markdown fences', () => {
  const result = parseResponse('```json\n[{"startLine":1,"endLine":3,"name":"add","type":"function","summary":"adds","consumes":[],"produces":[]}]\n```')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result[0].name, 'add')
})

test('parseResponse returns null for invalid', () => {
  const result = parseResponse('not json')
  assert.strictEqual(result, null)
})

module.exports = { count: () => ({ passed, failed }) }

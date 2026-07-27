const { add } = require('../src/utils/math')
const assert = require('assert')

describe('math', () => {
  it('adds', () => {
    assert.strictEqual(add(1, 2), 3)
  })
})

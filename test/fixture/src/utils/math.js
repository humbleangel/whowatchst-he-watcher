function add(a, b) {
  return a + b
}

function subtract(a, b) {
  return a - b
}

const PI = 3.14159

class Calculator {
  multiply(a, b) {
    return a * b
  }
  divide(a, b) {
    if (b === 0) throw new Error('div by zero')
    return a / b
  }
}

module.exports = { add, subtract, PI, Calculator }

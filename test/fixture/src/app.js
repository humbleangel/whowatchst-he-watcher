const express = require('express')
const app = express()
const port = 3000

function greet(name) {
  return `Hello, ${name}!`
}

app.get('/', (req, res) => {
  res.send(greet('World'))
})

app.listen(port, () => {
  console.log(`Server at http://localhost:${port}`)
})

const http = require('http')
const fs = require('fs')
const path = require('path')

function createServer(store, port) {
  const sseClients = new Set()
  const publicDir = path.join(__dirname, 'public')

  function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
  }

  function serveStatic(res, urlPath) {
    let filePath = path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath)
    if (!fs.existsSync(filePath)) {
      filePath = path.join(publicDir, 'index.html')
    }
    const ext = path.extname(filePath)
    const mime = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    }
    try {
      const content = fs.readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' })
      res.end(content)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }

  function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const client of sseClients) {
      client.write(msg)
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const p = url.pathname

    if (p.startsWith('/api/')) {
      if (p === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        })
        res.write('event: connected\ndata: {}\n\n')
        sseClients.add(res)
        req.on('close', () => sseClients.delete(res))
        return
      }

      if (p === '/api/status') return sendJSON(res, store.getStatus ? store.getStatus() : {})
      if (p === '/api/folders') return sendJSON(res, Object.values(store.folders))
      if (p === '/api/files') return sendJSON(res, Object.values(store.files))
      if (p === '/api/pieces') return sendJSON(res, Object.values(store.pieces))
      if (p === '/api/graph') return sendJSON(res, store.graph)
      if (p === '/api/delta') return sendJSON(res, store.deltas[store.deltas.length - 1] || null)

      if (p === '/api/folder') {
        const fp = url.searchParams.get('path')
        if (!fp) return sendJSON(res, { error: 'missing path' }, 400)
        return sendJSON(res, store.folders[fp] || { error: 'not found' }, store.folders[fp] ? 200 : 404)
      }

      if (p === '/api/file') {
        const fp = url.searchParams.get('path')
        if (!fp) return sendJSON(res, { error: 'missing path' }, 400)
        const fileData = store.files[fp]
        if (!fileData) return sendJSON(res, { error: 'not found' }, 404)
        const pieces = (fileData.pieces || []).map(name => {
          const key = `${fp}:${name}`
          return store.pieces[key] || { name, type: 'unknown' }
        })
        return sendJSON(res, { ...fileData, pieces })
      }

      return sendJSON(res, { error: 'not found' }, 404)
    }

    serveStatic(res, p)
  })

  server.broadcast = broadcast
  server.listen(port, () => {
    console.log(`WWWS server at http://localhost:${port}`)
  })

  return server
}

module.exports = { createServer }

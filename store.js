const fs = require('fs')
const path = require('path')

class Store {
  constructor(rootPath) {
    this.rootPath = rootPath
    this.wwswDir = path.join(rootPath, '.wwsw')
    this.folders = {}
    this.files = {}
    this.pieces = {}
    this.graph = []
    this.deltas = []
    this.cycle = 0
    this.lastScan = null
  }

  init() {
    if (!fs.existsSync(this.wwswDir)) {
      fs.mkdirSync(this.wwswDir, { recursive: true })
    }
    this.load('folders')
    this.load('files')
    this.load('pieces')
    this.load('graph')
    this.load('deltas')
    return this
  }

  filePath(name) {
    return path.join(this.wwswDir, `${name}.json`)
  }

  load(name) {
    const fp = this.filePath(name)
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf-8'))
      this[name] = data
      if (name === 'deltas') {
        this.cycle = data.length || 0
        this.lastScan = data.length > 0 ? data[data.length - 1].timestamp : null
      }
    } catch { }
  }

  save(name) {
    const fp = this.filePath(name)
    fs.writeFileSync(fp, JSON.stringify(this[name], null, 2), 'utf-8')
  }

  saveAll() {
    this.save('folders')
    this.save('files')
    this.save('pieces')
    this.save('graph')
    this.save('deltas')
  }

  getSnapshot() {
    return {
      folders: { ...this.folders },
      files: { ...this.files },
      pieces: { ...this.pieces },
      graph: [...this.graph]
    }
  }

  recordDelta(prevSnapshot, newSnapshot) {
    const added = Object.keys(newSnapshot.files).filter(k => !prevSnapshot.files[k])
    const removed = Object.keys(prevSnapshot.files).filter(k => !newSnapshot.files[k])
    const modified = Object.keys(newSnapshot.files).filter(k =>
      prevSnapshot.files[k] && (prevSnapshot.files[k].lines !== newSnapshot.files[k].lines || prevSnapshot.files[k].summary !== newSnapshot.files[k].summary)
    )
    this.cycle++
    const delta = {
      cycle: this.cycle,
      timestamp: new Date().toISOString(),
      added, removed, modified
    }
    this.deltas.push(delta)
    this.lastScan = delta.timestamp
    return delta
  }
}

module.exports = Store

const { scanFolders, countLines, detectRole, isEntryPoint, getEntryPoints } = require('./scanner')
const { isTextFile, isCodeFile } = require('./ignore')
const { analyzeFile } = require('./llm')
const Store = require('./store')
const path = require('path')

async function runPipeline(rootPath, apiKey, callbacks) {
  const store = new Store(rootPath).init()
  const scanResult = scanFolders(rootPath)
  const { folders, entryFolders } = scanResult

  const allFiles = folders.flatMap(f => f.files.map(fp => ({
    path: path.relative(rootPath, fp),
    fullPath: fp,
    lines: countLines(fp),
    isEntry: isEntryPoint(fp),
    role: detectRole(fp)
  })))

  const graph = []
  const piecesMap = {}
  const storeFiles = {}
  let filesProcessed = 0
  const llmFiles = allFiles.filter(f => {
    const name = path.basename(f.fullPath)
    if (!isTextFile(name)) {
      storeFiles[f.path] = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, summary: 'binary', pieces: [] }
      return false
    }
    if (f.lines <= 0) {
      storeFiles[f.path] = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, summary: 'empty', pieces: [] }
      return false
    }
    if (f.lines > 5000) {
      storeFiles[f.path] = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, summary: 'too large', pieces: [] }
      return false
    }
    if (!isCodeFile(name)) {
      storeFiles[f.path] = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, summary: 'documentation', pieces: [] }
      return false
    }
    return true
  })
  const totalFiles = llmFiles.length

  const CONCURRENCY = 5
  let idx = 0

  async function worker() {
    while (idx < llmFiles.length) {
      const myIdx = idx++
      const f = llmFiles[myIdx]
      const { fullPath, path: relPath } = f
      const baseInfo = { lines: f.lines, role: f.role, isEntry: f.isEntry }

      const result = await analyzeFile(fullPath, apiKey)
      filesProcessed++
      if (callbacks && callbacks.onFileDone) {
        callbacks.onFileDone(relPath, result.error, filesProcessed, totalFiles)
      }

      const pieceNames = result.pieces.map(p => {
        const key = `${relPath}:${p.name}`
        piecesMap[key] = { ...p, key }
        if (p.references && p.references.length > 0) {
          for (const ref of p.references) {
            graph.push({ from: key, to: ref, type: 'call' })
          }
        }
        return p.name
      })

      storeFiles[relPath] = { path: relPath, ...baseInfo, summary: result.summary, pieces: pieceNames }
    }
  }

  const workers = []
  for (let i = 0; i < Math.min(CONCURRENCY, llmFiles.length); i++) workers.push(worker())
  await Promise.all(workers)

  const prevSnapshot = store.getSnapshot()

  store.files = storeFiles
  store.folders = Object.fromEntries(folders.map(f => [f.path, f]))
  store.pieces = piecesMap
  store.graph = graph

  const newSnapshot = store.getSnapshot()
  const delta = store.recordDelta(prevSnapshot, newSnapshot)

  store.saveAll()

  return { folders, files: storeFiles, pieces: piecesMap, graph, delta, totalFiles, filesProcessed }
}

module.exports = { runPipeline }

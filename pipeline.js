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

  const storeFiles = {}

  for (const f of allFiles) {
    const name = path.basename(f.fullPath)
    const base = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, pieces: [] }

    if (!isTextFile(name)) { storeFiles[f.path] = { ...base, summary: 'binary' }; continue }
    if (f.lines <= 0) { storeFiles[f.path] = { ...base, summary: 'empty' }; continue }
    if (f.lines > 5000) { storeFiles[f.path] = { ...base, summary: 'too large' }; continue }
    if (!isCodeFile(name)) { storeFiles[f.path] = { ...base, summary: 'documentation' }; continue }

    storeFiles[f.path] = { ...base, summary: 'pending' }
  }

  const prevSnapshot = store.getSnapshot()

  store.files = storeFiles
  store.folders = Object.fromEntries(folders.map(f => [f.path, f]))
  store.pieces = {}
  store.graph = []

  const newSnapshot = store.getSnapshot()
  const delta = store.recordDelta(prevSnapshot, newSnapshot)

  store.saveAll()

  if (callbacks && callbacks.onFileDone) callbacks.onFileDone(null, null, allFiles.length, allFiles.length)

  return { folders, files: storeFiles, pieces: {}, graph: [], delta, totalFiles: allFiles.length, filesProcessed: allFiles.length }
}

async function analyzeSingleFile(rootPath, relPath, apiKey) {
  const store = new Store(rootPath).init()
  const fullPath = path.join(rootPath, relPath)
  const result = await analyzeFile(fullPath, apiKey)

  if (result.error) return result

  const piecesMap = {}
  const graph = []
  const pieceNames = result.pieces.map(p => {
    const key = `${relPath}:${p.name}`
    piecesMap[key] = { ...p, key }
    if (p.references && p.references.length > 0) {
      for (const ref of p.references) graph.push({ from: key, to: ref, type: 'call' })
    }
    return p.name
  })

  Object.assign(store.pieces, piecesMap)
  store.graph = [...store.graph, ...graph]
  if (store.files[relPath]) {
    store.files[relPath].summary = result.summary
    store.files[relPath].pieces = pieceNames
  }
  store.saveAll()

  return { summary: result.summary, pieces: result.pieces, error: null }
}

module.exports = { runPipeline, analyzeSingleFile }

const fs = require('fs')
const { scanFolders, countLines, detectRole, isEntryPoint, getEntryPoints } = require('./scanner')
const { isTextFile, isCodeFile } = require('./ignore')
const { analyzeFile } = require('./llm')
const Store = require('./store')
const path = require('path')

function applyAnalysisToStore(store, relPath, result) {
  for (const key of Object.keys(store.pieces)) {
    if (key.startsWith(`${relPath}:`)) delete store.pieces[key]
  }
  store.graph = store.graph.filter(e => !e.from.startsWith(`${relPath}:`))

  const pieceNames = result.pieces.map(p => {
    const key = `${relPath}:${p.name}`
    store.pieces[key] = { ...p, key }
    for (const ref of (p.references || [])) {
      store.graph.push({ from: key, to: ref, type: 'call' })
    }
    return p.name
  })

  if (store.files[relPath]) {
    store.files[relPath].summary = result.summary
    store.files[relPath].pieces = pieceNames
  }

  return pieceNames
}

async function runPipeline(store, apiKey, callbacks) {
  const rootPath = store.rootPath
  const scanResult = scanFolders(rootPath)
  const { folders } = scanResult

  const allFiles = folders.flatMap(f => f.files.map(fp => {
    const fullPath = path.join(rootPath, fp)
    let mtime = 0
    try { mtime = fs.statSync(fullPath).mtimeMs } catch {}
    return {
      path: fp,
      fullPath,
      mtime,
      lines: countLines(fullPath),
      isEntry: isEntryPoint(fullPath),
      role: detectRole(fullPath)
    }
  }))

  const storeFiles = {}
  const codeFiles = []
  const existingFiles = { ...store.files }

  for (const f of allFiles) {
    const name = path.basename(f.fullPath)
    const base = { path: f.path, lines: f.lines, role: f.role, isEntry: f.isEntry, pieces: [] }

    if (!isTextFile(name)) { storeFiles[f.path] = { ...base, summary: 'binary' }; continue }
    if (f.lines <= 0) { storeFiles[f.path] = { ...base, summary: 'empty' }; continue }
    if (f.lines > 5000) { storeFiles[f.path] = { ...base, summary: 'too large' }; continue }
    if (!isCodeFile(name)) { storeFiles[f.path] = { ...base, summary: 'documentation' }; continue }

    const existing = existingFiles[f.path]
    if (existing && existing.mtime === f.mtime && existing.summary && existing.summary !== 'pending' && existing.summary !== 'error') {
      storeFiles[f.path] = existing
      continue
    }

    storeFiles[f.path] = { ...base, summary: 'pending' }
    codeFiles.push(f)
  }

  const prevSnapshot = store.getSnapshot()

  store.files = storeFiles
  store.folders = Object.fromEntries(folders.map(f => [f.path, f]))
  store.graph = store.graph || []

  const newSnapshot = store.getSnapshot()
  const delta = store.recordDelta(prevSnapshot, newSnapshot)
  store.saveAll()
  store.save('graph')

  if (callbacks && callbacks.onScanComplete) {
    callbacks.onScanComplete({ total: codeFiles.length })
  }

  if (codeFiles.length > 0 && !store._analysisPromise) {
    store._analysisPromise = startBackgroundAnalysis(store, codeFiles, apiKey, callbacks)
    store._analysisPromise.finally(() => { store._analysisPromise = null })
  }

  return { folders, files: storeFiles, graph: store.graph, delta, totalFiles: allFiles.length, codeFiles: codeFiles.length }
}

async function startBackgroundAnalysis(store, codeFiles, apiKey, callbacks) {
  const CONCURRENCY = 5
  let idx = 0
  let done = 0
  const total = codeFiles.length

  async function worker() {
    while (idx < total) {
      const myIdx = idx++
      const f = codeFiles[myIdx]
      const { fullPath, path: relPath } = f

      const result = await analyzeFile(fullPath, apiKey)
      done++

      if (result.error) {
        if (callbacks && callbacks.onFileAnalyzed) {
          callbacks.onFileAnalyzed({ path: relPath, error: result.error, done, total })
        }
        continue
      }

      applyAnalysisToStore(store, relPath, result)
      store.saveAll()

      if (callbacks && callbacks.onFileAnalyzed) {
        callbacks.onFileAnalyzed({ path: relPath, summary: result.summary, pieces: result.pieces, error: null, done, total })
      }
    }
  }

  const workers = []
  for (let i = 0; i < Math.min(CONCURRENCY, total); i++) workers.push(worker())
  await Promise.all(workers)

  store.saveAll()
  if (callbacks && callbacks.onAllComplete) callbacks.onAllComplete({ total })
}

async function analyzeSingleFile(rootPath, relPath, apiKey) {
  const store = new Store(rootPath).init()
  const fullPath = path.join(rootPath, relPath)
  const result = await analyzeFile(fullPath, apiKey)

  if (result.error) return result

  applyAnalysisToStore(store, relPath, result)
  store.saveAll()

  return { summary: result.summary, pieces: result.pieces, error: null }
}

module.exports = { runPipeline, analyzeSingleFile }

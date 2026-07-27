const { scanFolders, countLines, detectRole, isEntryPoint, getEntryPoints } = require('./scanner')
const { isTextFile } = require('./ignore')
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
  let filesProcessed = 0
  const totalFiles = allFiles.filter(f => isTextFile(path.basename(f.fullPath)) && f.lines > 0 && f.lines <= 5000).length

  for (const f of allFiles) {
    const { fullPath, path: relPath } = f
    const name = path.basename(fullPath)
    const baseInfo = { lines: f.lines, role: f.role, isEntry: f.isEntry }

    if (!isTextFile(name)) {
      store.files[relPath] = { path: relPath, ...baseInfo, summary: 'binary', pieces: [], role: f.role, isEntry: f.isEntry }
      continue
    }

    if (f.lines <= 0) {
      store.files[relPath] = { path: relPath, ...baseInfo, summary: 'empty', pieces: [] }
      continue
    }

    if (f.lines > 5000) {
      store.files[relPath] = { path: relPath, ...baseInfo, summary: 'too large', pieces: [] }
      continue
    }

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

    store.files[relPath] = { path: relPath, ...baseInfo, summary: result.summary, pieces: pieceNames }
  }

  const prevSnapshot = store.getSnapshot()

  store.folders = Object.fromEntries(folders.map(f => [f.path, f]))
  store.pieces = piecesMap
  store.graph = graph

  const newSnapshot = store.getSnapshot()
  const delta = store.recordDelta(prevSnapshot, newSnapshot)

  store.saveAll()

  return { folders, files: store.files, pieces: piecesMap, graph, delta, totalFiles, filesProcessed }
}

module.exports = { runPipeline }

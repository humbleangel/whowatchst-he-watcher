const fs = require('fs')
const path = require('path')
const { shouldIgnore, isTextFile } = require('./ignore')

function scanFolders(rootPath) {
  const result = []
  const entryFolders = new Set()

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const folders = []
    const files = []

    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (shouldIgnore(e.name, full)) continue

      if (e.isDirectory()) {
        const sub = walk(full)
        folders.push(sub)
      } else if (e.isFile()) {
        files.push(full)
      }
    }

    const relPath = path.relative(rootPath, dir) || '.'
    const entry = {
      path: relPath,
      files: files,
      subfolderCount: folders.length,
      fileCount: files.length
    }
    result.push(entry)

    if (files.some(f => isEntryPoint(f))) {
      entryFolders.add(relPath)
    }

    return entry
  }

  walk(rootPath)
  return { folders: result, entryFolders: [...entryFolders] }
}

function isEntryPoint(filePath) {
  const name = path.basename(filePath).toLowerCase()
  return /^(main|app|index|router)\./.test(name)
}

function getEntryPoints(filePaths) {
  return filePaths.filter(f => isEntryPoint(f))
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return -1
  }
}

function detectRole(filePath) {
  const name = path.basename(filePath).toLowerCase()
  const dir = path.dirname(filePath).toLowerCase()

  if (name.endsWith('.test.') || name.endsWith('.spec.') || name.endsWith('_test.') || dir.includes('test') || dir.includes('__tests__')) return 'test'
  if (name === 'index.js' || name === 'index.ts' || name === 'main.js' || name === 'main.ts' || name === 'app.js' || name === 'app.ts') return 'entry'
  if (dir.endsWith('config') || dir.endsWith('configs') || name.startsWith('.') || name.endsWith('.config.') || name.endsWith('rc')) return 'config'
  if (dir.endsWith('types') || dir.endsWith('interfaces') || dir.endsWith('typings')) return 'type'
  if (dir.endsWith('model') || dir.endsWith('models') || dir.endsWith('entity') || dir.endsWith('entities')) return 'model'
  if (dir.endsWith('service') || dir.endsWith('services') || dir.endsWith('api')) return 'service'
  if (dir.endsWith('controller') || dir.endsWith('controllers') || dir.endsWith('route') || dir.endsWith('routes')) return 'controller'
  return 'module'
}

module.exports = { scanFolders, isEntryPoint, getEntryPoints, countLines, detectRole }

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
    const lines = content.split('\n')
    return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
  } catch {
    return -1
  }
}

function detectRole(filePath) {
  const name = path.basename(filePath).toLowerCase()
  const dir = path.dirname(filePath).toLowerCase()
  const lastDir = dir.split(/[/\\]/).filter(Boolean).pop() || ''

  if (name === 'index.js' || name === 'index.ts' || name === 'main.js' || name === 'main.ts' || name === 'app.js' || name === 'app.ts') return 'entry'
  if (name.includes('.test.') || name.includes('.spec.') || name.endsWith('_test.') || lastDir === 'test' || lastDir === '__tests__' || lastDir === 'spec') return 'test'
  if (name.endsWith('.d.ts')) return 'type'
  if (lastDir === 'config' || lastDir === 'configs' || name.startsWith('.')) return 'config'
  if (lastDir === 'types' || lastDir === 'interfaces' || lastDir === 'typings' || lastDir === 'type') return 'type'
  if (lastDir === 'model' || lastDir === 'models' || lastDir === 'entity' || lastDir === 'entities') return 'model'
  if (lastDir === 'service' || lastDir === 'services' || lastDir === 'api') return 'service'
  if (lastDir === 'controller' || lastDir === 'controllers' || lastDir === 'route' || lastDir === 'routes') return 'controller'
  return 'module'
}

module.exports = { scanFolders, isEntryPoint, getEntryPoints, countLines, detectRole }

const path = require('path')
const fs = require('fs')

const DEFAULT_IGNORE = [
  'node_modules', '.git', 'target', '.next', 'dist', 'build', '.wwsw',
  '.vscode', '.idea', '__pycache__', '.DS_Store', '*.exe', '*.dll',
  '*.so', '*.dylib', '*.png', '*.jpg', '*.gif', '*.ico', '*.svg',
  '*.woff', '*.eot', '*.ttf', '*.zip', '*.tar.gz', 'debug_out.txt',
  'debug_err.txt', 'package-lock.json', 'yarn.lock', '.gitkeep'
]

const TEXT_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.html', '.css',
  '.rs', '.py', '.rb', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.sh', '.ps1', '.bat',
  '.env', '.sql', '.vue', '.svelte', '.xml', '.tex', '.txt', '.gitignore',
  '.dockerfile', '.gradle', '.swift', '.kt', '.scala', '.php', '.r',
  '.mjs', '.cjs', '.mts', '.cts'
])

function shouldIgnore(name, fullPath) {
  for (const p of DEFAULT_IGNORE) {
    if (p.includes('*')) {
      const ext = p.slice(1)
      if (name.endsWith(ext)) return true
    } else if (name === p) return true
  }
  return false
}

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase()
  if (TEXT_EXTS.has(ext)) return true
  return TEXT_EXTS.has(name.toLowerCase())
}

module.exports = { shouldIgnore, isTextFile, DEFAULT_IGNORE }

let folders = {}
let files = {}
let pieces = {}
let currentPath = null

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function escapeHTML(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function renderTree(foldersList) {
  const tree = document.getElementById('tree')
  tree.innerHTML = ''
  const root = { path: '.', children: [], files: [] }

  for (const f of foldersList) {
    const parts = f.path.replace(/\\/g, '/').split('/')
    let node = root
    for (const p of parts) {
      if (p === '.' || p === '') continue
      let child = node.children.find(c => c.name === p)
      if (!child) {
        child = { name: p, path: '', children: [], files: [], fileCount: 0 }
        node.children.push(child)
      }
      node = child
    }
    node.fileCount = f.fileCount
    node.subfolderCount = f.subfolderCount
    node.files = f.files || []
    node.path = f.path
  }

  function renderNode(node, depth) {
    const div = document.createElement('div')
    div.className = 'tree-folder'
    div.dataset.path = node.path

    const label = document.createElement('div')
    label.className = 'tree-label'
    label.style.paddingLeft = (8 + depth * 16) + 'px'

    const arrow = document.createElement('span')
    arrow.className = 'arrow'
    arrow.textContent = '▶'

    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = node.name

    const count = document.createElement('span')
    count.className = 'count'
    count.textContent = `${node.fileCount}f`

    label.appendChild(arrow)
    label.appendChild(name)
    label.appendChild(count)
    div.appendChild(label)

    const children = document.createElement('div')
    children.className = 'tree-children'

    for (const sub of node.children) {
      children.appendChild(renderNode(sub, depth + 1))
    }
    for (const fp of node.files) {
      const fileEl = document.createElement('div')
      fileEl.className = 'tree-file'
      const fname = document.createElement('span')
      fname.className = 'name'
      fname.textContent = fp.split('/').pop() || fp.split('\\').pop()
      fileEl.appendChild(fname)
      fileEl.dataset.path = fp
      fileEl.addEventListener('click', (e) => {
        e.stopPropagation()
        selectFile(fp)
      })
      children.appendChild(fileEl)
    }

    div.appendChild(children)
    label.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = children.classList.toggle('open')
      arrow.classList.toggle('open', isOpen)
      if (isOpen && node.path) selectFolder(node.path)
    })

    return div
  }

  for (const child of root.children) {
    tree.appendChild(renderNode(child, 0))
  }
}

function selectFolder(path) {
  currentPath = path
  document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
  const folderEl = document.querySelector(`.tree-folder[data-path="${path}"]`)
  if (folderEl) folderEl.classList.add('selected')

  const data = folders[path]
  if (!data) return

  const content = document.getElementById('detail-content')
  const placeholder = document.getElementById('placeholder')
  placeholder.style.display = 'none'
  content.style.display = 'block'

  const fileRows = (data.files || []).map(fp => {
    const fi = files[fp]
    if (!fi) return `<tr><td>${escapeHTML(fp.split('/').pop())}</td><td>-</td><td>-</td><td></td></tr>`
    const roleBadge = fi.role && fi.role !== 'module' ? `<span class="badge badge-${fi.role}">${fi.role}</span>` : ''
    return `<tr><td>${escapeHTML(fp.split('/').pop())}</td><td>${fi.lines}</td><td>${escapeHTML(fi.summary || '')}</td><td>${roleBadge}</td></tr>`
  }).join('')

  content.innerHTML = `
    <div class="detail-section">
      <h2>${escapeHTML(path)}</h2>
    </div>
    <div class="detail-section">
      <h2>Overview</h2>
      <table class="detail-table">
        <tr><th>Subfolders</th><td>${data.subfolderCount}</td></tr>
        <tr><th>Files</th><td>${data.fileCount}</td></tr>
      </table>
    </div>
    <div class="detail-section">
      <h2>Files</h2>
      <table class="detail-table">
        <tr><th>Name</th><th>Lines</th><th>Summary</th><th>Role</th></tr>
        ${fileRows}
      </table>
    </div>
  `
}

function selectFile(fp) {
  currentPath = fp
  document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
  const fileEl = document.querySelector(`.tree-file[data-path="${fp}"]`)
  if (fileEl) fileEl.classList.add('selected')

  const content = document.getElementById('detail-content')
  const placeholder = document.getElementById('placeholder')
  placeholder.style.display = 'none'
  content.style.display = 'block'

  const data = files[fp]
  if (!data) {
    content.innerHTML = `<div class="detail-section"><h2>${escapeHTML(fp)}</h2><p>Not indexed yet</p></div>`
    return
  }

  const roleBadge = data.role && data.role !== 'module' ? `<span class="badge badge-${data.role}">${data.role}</span>` : ''
  const entryBadge = data.isEntry ? '<span class="badge badge-entry">entry</span>' : ''

  const piecesHTML = (data.pieces || []).map(name => {
    const key = `${fp}:${name}`
    const p = pieces[key]
    if (!p) return `<span class="piece">${escapeHTML(name)}</span>`
    return `<span class="piece" title="consumes: ${(p.consumes||[]).join(', ')} | produces: ${(p.produces||[]).join(', ')}">${escapeHTML(name)}${p.type !== 'block' ? ` <small>(${p.type})</small>` : ''}</span>`
  }).join('')

  const isPending = data.summary === 'pending'
  const hasPieces = (data.pieces || []).length > 0

  content.innerHTML = `
    <div class="detail-section">
      <h2>${escapeHTML(fp)} ${roleBadge} ${entryBadge}</h2>
    </div>
    <div class="detail-section">
      <h2>Info</h2>
      <table class="detail-table">
        <tr><th>Lines</th><td>${data.lines}</td></tr>
        <tr><th>Summary</th><td>${escapeHTML(data.summary || '')}</td></tr>
        <tr><th>Role</th><td>${data.role || 'module'}</td></tr>
      </table>
    </div>
    <div class="detail-section">
      <h2>Pieces</h2>
      <div>${piecesHTML || (isPending ? '<span style="color:#555">analyzing...</span>' : '<span style="color:#555">none</span>')}</div>
    </div>
  `
}

function selectCurrent() {
  if (!currentPath) return
  if (folders[currentPath]) selectFolder(currentPath)
  else if (files[currentPath]) selectFile(currentPath)
}

async function loadAll() {
  try {
    const [fData, fiData, pData] = await Promise.all([
      fetchJSON('/api/folders'),
      fetchJSON('/api/files'),
      fetchJSON('/api/pieces')
    ])
    folders = Object.fromEntries(fData.map(f => [f.path, f]))
    files = Object.fromEntries(fiData.map(f => [f.path, f]))
    pieces = Object.fromEntries(pData.filter(p => p.key).map(p => [p.key, p]))

    renderTree(fData)
    selectCurrent()
  } catch (err) {
  }
}

function connectSSE() {
  const es = new EventSource('/api/events')
  es.addEventListener('scan-complete', (e) => {
    const { total } = JSON.parse(e.data)
    document.getElementById('status').textContent = `analyzing ${total} files...`
  })
  es.addEventListener('file-analyzed', async (e) => {
    const { path: fp, error, done, total } = JSON.parse(e.data)
    document.getElementById('status').textContent = `analyzing ${done}/${total} files`
    if (!error && currentPath === fp) {
      await loadAll()
      selectFile(fp)
    }
  })
  es.addEventListener('all-complete', (e) => {
    const { total } = JSON.parse(e.data)
    document.getElementById('status').textContent = `${total} files analyzed`
    loadAll()
  })
  es.addEventListener('index-complete', (e) => {
    const data = JSON.parse(e.data)
    document.getElementById('status').textContent = `cycle ${data.cycle}: ${new Date(data.timestamp).toLocaleTimeString()}`
  })
  es.addEventListener('connected', () => {})
  es.onerror = () => {}
}

loadAll().then(() => {
  const pending = Object.values(files).filter(f => f.summary === 'pending').length
  document.getElementById('status').textContent = pending > 0 ? `${Object.keys(files).length} files, awaiting analysis...` : 'ready'
})
connectSSE()

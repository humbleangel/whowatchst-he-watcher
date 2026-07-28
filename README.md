# W.W.S.W. — Who Watches The Watcher?

A standalone Node.js codebase indexer that watches a project directory, scans its structure instantly, runs LLM analysis (NVIDIA Nemotron) in background workers, and serves a vanilla HTML/CSS/JS web UI with folder tree + detail panels via SSE live updates.

## Quick Start

```bash
npm install
node index.js /path/to/codebase --key nvapi-xxxxx
```

Opens a web UI at http://localhost:3456

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port, -p` | 3456 | HTTP server port |
| `--interval, -i` | 120000 | Poll interval in ms |
| `--key, -k` | env `NVIDIA_API_KEY` | NVIDIA API key |

## Architecture

### Files

| File | Purpose |
|------|---------|
| `index.js` | CLI entry, wires callbacks and SSE broadcasts |
| `scanner.js` | Recursive directory walk, role detection, entry point detection |
| `ignore.js` | File filtering — text vs binary, code vs documentation |
| `store.js` | In-memory state + JSON persistence, delta tracking |
| `pipeline.js` | Scan, incremental analysis, background workers, graph edges |
| `llm.js` | NVIDIA Nemotron API wrapper, prompt construction, retry loop |
| `watcher.js` | Poll loop with busy guard |
| `server.js` | HTTP static + REST API + SSE endpoints |
| `public/index.html` | UI shell |
| `public/app.js` | Tree rendering, detail panels, SSE handlers |
| `public/style.css` | Dark theme, split layout |

### Data Model (`.wwsw/` folder)

- **folders.json** — folder tree with file counts
- **files.json** — per-file: line count, summary, pieces, role
- **pieces.json** — functions, classes, vars with data flow (consumes/produces/references)
- **graph.json** — dependency edges between pieces (from references)
- **deltas.json** — what changed between cycles (added/removed/modified)

### API Routes

| Route | Description |
|-------|-------------|
| `GET /api/status` | Watcher status, last cycle time |
| `GET /api/folders` | All folders |
| `GET /api/files` | All files |
| `GET /api/pieces` | All pieces |
| `GET /api/graph` | All edges |
| `GET /api/delta` | Latest delta |
| `GET /api/file?path=...` | Single file detail |
| `GET /api/events` | SSE stream for live updates |

### How It Works

1. **Scan** — Recursive walk ignores node_modules, .git, binaries, .wwsw. Detects roles (test, config, entry, etc.) and entry points by filename pattern.
2. **Incremental analysis** — Compares mtime of each file against previous scan. Only new/changed files get queued for LLM analysis.
3. **Background workers** — 5 concurrent workers call NVIDIA Nemotron 3 Nano. Each file analysis takes ~20-30s. Workers clean stale pieces and graph edges before writing new results.
4. **Graph building** — LLM returns `references` (cross-file function/class names). Pipeline creates edges: `{ from: "file:piece", to: "referencedName", type: "call" }`.
5. **SSE live updates** — Frontend receives `scan-complete`, `file-analyzed`, `all-complete`, `index-complete` events. Status bar updates in real-time. Detail panel refreshes when viewing an analyzed file.
6. **Poll cycle** — Every 2 minutes (configurable), scanner runs again. Unchanged files preserve existing analysis. New/changed files get re-analyzed.

## Testing

```bash
npm test
```

72 tests covering: ignore logic, scanner output, store persistence, delta tracking, LLM prompt/response parsing, pipeline integration, server API.

## Bug Fixes Applied

### Critical
- **Graph edges never created** — LLM prompt didn't ask for `references`. Added `references:string[]` to prompt schema. Workers now create edges from `p.references`. Fixed `references: []` hardcode in `llm.js` that silently discarded LLM output.

### Data Integrity
- **Stale pieces on re-analysis** — Old pieces/graph edges persisted across re-analyses. Workers now clean old entries before writing new ones.
- **Incremental analysis wrong trigger** — Used `lines === lines` instead of `mtime === mtime`. Files with same length but different content were skipped.
- **graph.json never written to disk** — Added `store.save('graph')` to pipeline.

### UI
- **Tree duplication** — `renderTree()` appended without clearing. Added `tree.innerHTML = ''`.
- **Path mismatch** — Scanner stored absolute paths in folder arrays, but files.json used relative. Fixed scanner to use relative paths.
- **Selection lost on SSE refresh** — `loadAll()` didn't restore current selection. Added `selectCurrent()` after re-render.
- **Tree collapsed on each cycle** — `index-complete` handler called `loadAll()`. Removed it; SSE handlers manage status exclusively.
- **"Analyzing 0 files" flash** — `scan-complete` broadcast fired on empty batches. Guarded with `total > 0`.
- **Piece key fallback broken** — Filtered pieces without `p.key` instead of producing `:name` fallback.

### Code Quality (from code review)
- **Duplicated cleanup block** — Extracted `applyAnalysisToStore()` helper, called from both `startBackgroundAnalysis` and `analyzeSingleFile`.
- **Duplicated retry block** — Replaced copy-pasted try/catch with a `for` loop (2 attempts).
- **Dead return fields** — `runPipeline` returned empty `pieces`/`graph` objects. Removed; real data lives in `store`.

## Spec

Built from Issue #1 on GitHub. Key design decisions:

- **No frameworks** — Vanilla HTML/CSS/JS UI. Zero build step.
- **LLM cost accepted** — Graph edges built from LLM references (not post-processed imports). Higher quality, ongoing token cost.
- **Poll-based watching** — Not fs.watch. Simpler, no debounce needed.
- **Semantic roles** — Heuristic (filename patterns), not LLM. Zero cost.
- **Read-only UI** — No buttons, no actions. Pure display. Explore via click.

## Origin

Built as a standalone tool. The name comes from the folder: WHOWATCHSTHEWATCHER — a watcher that watches watchers. Developed iteratively with AI assistance, documented via GitHub issues and commits.

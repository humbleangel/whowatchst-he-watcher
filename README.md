# W.W.S.W. — Who Watches The Watcher?

Codebase indexer. Watches a directory, analyzes every file via LLM, produces structured JSON (folders, files, pieces, graph, deltas). Serves a web UI.

## Usage

```
node index.js /path/to/codebase --key nvapi-xxxxx
```

Opens a web UI at http://localhost:3456

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port, -p` | 3456 | HTTP server port |
| `--interval, -i` | 120000 | Poll interval in ms |
| `--key, -k` | env `NVIDIA_API_KEY` | NVIDIA API key |

## Output

All data stored in `.wwsw/` folder inside the watched project:

- **folders.json** — folder tree with file counts
- **files.json** — per-file: line count, summary, pieces, role
- **pieces.json** — functions, classes, vars with data flow
- **graph.json** — dependency edges between pieces
- **delta.json** — what changed between cycles

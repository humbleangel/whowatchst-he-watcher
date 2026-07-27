const fs = require('fs')

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'nvidia/nemotron-3-nano-30b-a3b'

function buildPrompt(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const numbered = lines.map((l, i) => `${i + 1}:${l}`).join('\n')
  return numbered
}

function parseResponse(raw) {
  let text = raw
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) text = match[1].trim()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function callNvidia(promptText, apiKey) {
  const messages = [{
    role: 'user',
    content: `Return ONLY JSON array of blocks. Each block: {startLine:number,endLine:number,name:string,type:"function"|"class"|"interface"|"variable"|"block",summary:string,consumes:string[],produces:string[]}. Cover the full file. Use real function/class/variable names. No other text.

${promptText}`
  }]

  const body = JSON.stringify({
    model: MODEL,
    messages,
    temperature: 0.1,
    max_tokens: 40000
  })

  const res = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body,
    signal: AbortSignal.timeout(300000)
  })

  if (!res.ok) {
    throw new Error(`NVIDIA API ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

async function analyzeFile(filePath, apiKey) {
  const stat = fs.statSync(filePath)
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length

  if (lines > 5000) {
    return { blocks: [], summary: 'too large', pieces: [], error: 'too large' }
  }

  try {
    const promptText = buildPrompt(filePath)
    const raw = await callNvidia(promptText, apiKey)
    const parsed = parseResponse(raw)
    if (!parsed || !Array.isArray(parsed)) {
      return { blocks: [], summary: 'parse error', pieces: [], error: 'parse error' }
    }

    const blocks = parsed.map(b => ({
      startLine: b.startLine || 0,
      endLine: b.endLine || 0,
      desc: b.summary || b.name || ''
    }))

    const pieces = parsed.map(b => ({
      name: b.name || 'unnamed',
      type: b.type || 'block',
      filesUsed: [filePath],
      references: [],
      consumes: b.consumes || [],
      produces: b.produces || []
    }))

    const summaryParts = parsed.map(b => b.summary).filter(Boolean)
    const summary = summaryParts.length > 0
      ? summaryParts.slice(0, 3).join('; ') + (summaryParts.length > 3 ? ' ...' : '')
      : 'no summary'

    return { blocks, pieces, summary, error: null }
  } catch (err) {
    try {
      const promptText = buildPrompt(filePath)
      const raw = await callNvidia(promptText, apiKey)
      const parsed = parseResponse(raw)
      if (!parsed || !Array.isArray(parsed)) {
        return { blocks: [], summary: 'parse error', pieces: [], error: 'parse error' }
      }
      const blocks = parsed.map(b => ({ startLine: b.startLine || 0, endLine: b.endLine || 0, desc: b.summary || b.name || '' }))
      const pieces = parsed.map(b => ({
        name: b.name || 'unnamed', type: b.type || 'block', filesUsed: [filePath], references: [], consumes: b.consumes || [], produces: b.produces || []
      }))
      const summaryParts = parsed.map(b => b.summary).filter(Boolean)
      const summary = summaryParts.length > 0 ? summaryParts.slice(0, 3).join('; ') + (summaryParts.length > 3 ? ' ...' : '') : 'no summary'
      return { blocks, pieces, summary, error: null }
    } catch (err2) {
      return { blocks: [], summary: 'error', pieces: [], error: err2.message }
    }
  }
}

module.exports = { analyzeFile }

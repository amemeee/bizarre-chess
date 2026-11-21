/* Stockfish (nmrugg/stockfish.js, GPLv3) run in a Web Worker loaded from a CDN. */
let worker = null

export function initEngine() {
  if (worker) return
  try {
    const url = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js'
    worker = new Worker(URL.createObjectURL(new Blob([`importScripts("${url}")`], { type: 'text/javascript' })))
    worker.postMessage('uci')
  } catch { worker = null }
}

/** Resolves with a UCI move like "e2e4", or null if the engine is unavailable / times out.
    `allowed` (optional) limits the search to those UCI moves (used by the player's Shield). */
export function engineMove(fen, { skill, depth }, allowed = null) {
  return new Promise(resolve => {
    if (!worker) return resolve(null)
    let done = false
    const finish = v => { if (done) return; done = true; clearTimeout(timer); worker.onmessage = null; resolve(v) }
    const timer = setTimeout(() => finish(null), 15000)
    worker.onmessage = e => {
      const m = typeof e.data === 'string' ? e.data : ''
      if (m.startsWith('bestmove')) { const mv = m.split(' ')[1]; finish(mv && mv !== '(none)' ? mv : null) }
    }
    worker.postMessage(`setoption name Skill Level value ${skill}`)
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(allowed?.length ? `go depth ${depth} searchmoves ${allowed.join(' ')}` : `go depth ${depth}`)
  })
}

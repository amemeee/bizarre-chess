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

/** The engine's `n` best moves in this position (UCI strings, best first), or null if the engine is unavailable.
    Used by AI-0's Calculate, which forbids your best moves. */
export function engineTopMoves(fen, n = 3, depth = 8) {
  return new Promise(resolve => {
    if (!worker) return resolve(null)
    const best = {}
    let done = false
    const finish = v => {
      if (done) return
      done = true; clearTimeout(timer); worker.onmessage = null
      worker.postMessage('setoption name MultiPV value 1')
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), 12000)
    worker.onmessage = e => {
      const m = typeof e.data === 'string' ? e.data : ''
      const pv = m.match(/ multipv (\d+) .* pv (\S+)/)
      if (pv) best[pv[1]] = pv[2]
      if (m.startsWith('bestmove')) finish(Object.keys(best).sort((a, b) => a - b).map(k => best[k]).slice(0, n))
    }
    worker.postMessage('setoption name Skill Level value 20')
    worker.postMessage(`setoption name MultiPV value ${n}`)
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}

/** The engine's best line from this position: { moves: ['e2e4', …] (the principal variation), mate: N | null }
    (`mate` > 0: the side to move can force checkmate in N). Used by Akane's Crimson Sight. */
export function engineLine(fen, depth = 12) {
  return new Promise(resolve => {
    if (!worker) return resolve(null)
    let last = null, done = false
    const finish = v => { if (done) return; done = true; clearTimeout(timer); worker.onmessage = null; resolve(v) }
    const timer = setTimeout(() => finish(last), 12000)
    worker.onmessage = e => {
      const m = typeof e.data === 'string' ? e.data : ''
      if (m.startsWith('info') && m.includes(' pv ')) {
        const mate = m.match(/score mate (-?\d+)/)
        last = { moves: m.split(' pv ')[1].trim().split(/\s+/), mate: mate ? +mate[1] : null }
      }
      if (m.startsWith('bestmove')) finish(last)
    }
    worker.postMessage('setoption name Skill Level value 20')
    worker.postMessage('setoption name MultiPV value 1')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}

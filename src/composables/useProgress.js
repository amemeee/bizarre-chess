import { ref } from 'vue'

/* Things the game remembers about how you play, kept in this browser:
   - habits: your favourite openings, how long you take per move, how your last game against each rival ended,
     so rivals can needle you about them ("You always open with e4.")
   - achievements, each with a title you earn
   - how many games each character has played, which is what evolves their piece set (Rai's Spark → Storm → Thunder God)
   Also a small queue of pop-up notifications (achievement unlocked, a set evolved). */
const KEY = 'bizarre-chess:progress'
const blank = () => ({ openings: {}, moveMs: { total: 0, n: 0 }, last: {}, ach: {}, ults: 0, beaten: {}, games: {} })
function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return blank() }
}
const state = ref(load())
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state.value)) } catch { /* lasts this visit only */ } }

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', text: 'Win a duel.', title: 'the Newcomer' },
  { id: 'untouchable', name: 'Untouchable', text: 'Win without losing your queen.', title: 'the Untouchable' },
  { id: 'pawn_power', name: 'Pawn Power', text: 'Win with only pawns left beside your king.', title: 'Friend of Pawns' },
  { id: 'comeback', name: 'Comeback Kid', text: 'Win after falling far behind in material.', title: 'the Unbroken' },
  { id: 'know_thyself', name: 'Know Thyself', text: 'Beat your own Alter in a mirror match.', title: 'the Original' },
  { id: 'giant_slayer', name: 'Giant Slayer', text: 'Beat any rival at Master difficulty.', title: 'Giant Slayer' },
  { id: 'lightning_rod', name: 'Lightning Rod', text: "Win a game after Rai's Chain Lightning hit you.", title: 'the Grounded' },
  { id: 'overcharged', name: 'Overcharged', text: 'Use 10 ultimates.', title: 'the Overcharged' },
  { id: 'grand_tour', name: 'Grand Tour', text: 'Beat every rival at least once.', title: 'the Conqueror' },
  { id: 'champion', name: 'Champion', text: 'Clear the story.', title: 'Champion' },
]

// pop-up notifications: { id, kind, title, text }
export const toasts = ref([])
let toastId = 0
export function notify(kind, title, text) {
  const id = ++toastId
  toasts.value = [...toasts.value, { id, kind, title, text }]
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 4200)
}

export function unlock(id) {
  if (state.value.ach[id]) return
  const a = ACHIEVEMENTS.find(x => x.id === id)
  if (!a) return
  state.value = { ...state.value, ach: { ...state.value.ach, [id]: Date.now() } }
  save()
  notify('ach', `Achievement · ${a.name}`, `Title earned: “${a.title}”`)
}

/** A character's piece-set stage: the last of their `evolve` stages they've played enough games to reach. */
export function stageOf(c) {
  if (!c?.evolve) return null
  const n = state.value.games[c.id] ?? 0
  return [...c.evolve].reverse().find(s => n >= s.games) ?? c.evolve[0]
}
/** The piece set a character uses right now (evolved, if they evolve). */
export const setOf = c => stageOf(c)?.set ?? c?.pieces ?? null

export function useProgress() {
  /** Your first move of a game (its SAN, e.g. 'e4'). */
  function recordOpening(san) {
    state.value = { ...state.value, openings: { ...state.value.openings, [san]: (state.value.openings[san] ?? 0) + 1 } }
    save()
  }
  /** How long you took over a move (ms); very long pauses (away from the screen) are ignored. */
  function recordMoveTime(ms) {
    if (ms <= 0 || ms > 180000) return
    const m = state.value.moveMs
    state.value = { ...state.value, moveMs: { total: m.total + ms, n: m.n + 1 } }
    save()
  }
  /** A character played a game (as your opponent, as you, or in Spectate): count it; their set may evolve. */
  function playedBy(c) {
    if (!c?.id) return
    const before = stageOf(c)
    state.value = { ...state.value, games: { ...state.value.games, [c.id]: (state.value.games[c.id] ?? 0) + 1 } }
    save()
    const after = stageOf(c)
    if (before && after && after.set !== before.set) notify('evolve', `${c.name}'s pieces evolved!`, `Now: ${after.name}`)
  }
  const usedUlt = () => {
    state.value = { ...state.value, ults: state.value.ults + 1 }
    save()
    if (state.value.ults >= 10) unlock('overcharged')
  }
  /** A duel ended. `g`: { char, result, resigned, moves, mirror, level, comeback, queenLost, onlyPawns, chainHit, roster } */
  function recordDuel(g) {
    const id = g.char.id
    state.value = { ...state.value, last: { ...state.value.last, [id]: { result: g.result, resigned: !!g.resigned, moves: g.moves } } }
    if (g.result === 'win') state.value = { ...state.value, beaten: { ...state.value.beaten, [id]: true } }
    save()
    if (g.result !== 'win') return
    unlock('first_win')
    if (!g.queenLost) unlock('untouchable')
    if (g.onlyPawns) unlock('pawn_power')
    if (g.comeback) unlock('comeback')
    if (g.mirror) unlock('know_thyself')
    if (g.level === 'Master') unlock('giant_slayer')
    if (g.chainHit) unlock('lightning_rod')
    if (g.roster?.length && g.roster.every(r => state.value.beaten[r])) unlock('grand_tour')
  }
  /** Something the rival can needle you about before the game, or null. */
  function habitLine(c) {
    const s = state.value, out = []
    const last = s.last[c.id]
    if (last?.resigned) out.push('You resigned last time. Running away again?')
    else if (last?.result === 'loss' && last.moves && last.moves < 15) out.push(`Last time you lasted only ${last.moves} moves. Let's see if you do better.`)
    const total = Object.values(s.openings).reduce((a, b) => a + b, 0)
    const [fav, n] = Object.entries(s.openings).sort((a, b) => b[1] - a[1])[0] ?? []
    if (fav && n >= 3 && n / total >= 0.5) out.push(`You always open with ${fav}. Predictable.`)
    const avg = s.moveMs.n >= 10 ? s.moveMs.total / s.moveMs.n : null
    if (avg && avg > 25000) out.push('You take forever on every move. Are you eating snacks over there?')
    else if (avg && avg < 4000) out.push('You move so fast. Do you even think before you play?')
    const games = s.games[c.id] ?? 0
    if (games >= 5) out.push(`This is our game number ${games + 1}. You must really like me.`)
    return out.length ? out[Math.floor(Math.random() * out.length)] : null
  }
  return { state, recordOpening, recordMoveTime, playedBy, usedUlt, recordDuel, habitLine, unlock }
}

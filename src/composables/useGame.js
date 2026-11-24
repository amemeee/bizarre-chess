import { ref, shallowRef, computed, watch } from 'vue'
import { Chess } from 'chess.js'
import { CHARS, LEVELS } from '../data/characters'
import { initEngine, engineMove, engineTopMoves, engineLine } from '../lib/engine'
import { notify } from './useProgress'
import { useStats } from './useStats'
import { usePlayer, HEROES, PLAYER_GLOW as HERO_GLOW } from './usePlayer'
import { useProgress, setOf } from './useProgress'
import { ROSTER } from '../data/characters'

/* Two modes:
   - 'duel':  you play White, a character plays Black.
   - 'watch': a character plays each side (computer vs computer) and you spectate.
   Every per-side value (character, meter, mood, speech bubble) is kept per colour. */

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const FILES = 'abcdefgh'
const ME = 'w' // the human's colour in a duel
const other = c => (c === 'w' ? 'b' : 'w')
const other_ = other
const pick = a => a[Math.floor(Math.random() * a.length)]
const sleep = ms => new Promise(r => setTimeout(r, ms))

const chess = shallowRef(new Chess())
const tick = ref(0) // bump after every mutation so computed values refresh
const mode = ref('duel')
const selected = ref(null)
const hints = ref([])
const lastMove = ref(null)
const busy = ref(false)
const over = ref(null)
const boom = ref([])
const cutin = ref(false)
const cutinChar = ref(null)
const quake = ref(false)
// set whenever an ultimate lands, so the 3D board can play its effect: { fx, glow, squares, n }
const ultEvent = ref(null)
const paused = ref(false)
const speed = ref(1) // spectate playback speed

// per-colour state
const newSide = () => ({ char: ref(null), charge: ref(0), bubble: ref(''), face: ref({ mood: 'idle', anim: '', n: 0 }) })
const side = { w: newSide(), b: newSide() }

let undoStack = [] // { fen, lost } snapshots, one per move of yours
// pieces each side has lost so far (captured, burned, shattered, or stolen by Noa); promotions are not losses
const lost = ref({ w: [], b: [] })
const loseTo = (color, type) => { lost.value = { ...lost.value, [color]: [...lost.value[color], type] } }
// a lost piece comes back (Haru's Bloom): take one of that type off the side's lost list
const regain = (color, type) => {
  const list = [...lost.value[color]], i = list.indexOf(type)
  if (i >= 0) { list.splice(i, 1); lost.value = { ...lost.value, [color]: list } }
}
let skipPending = { w: false, b: false }

/* ---- your ultimates (duel only) ----
   Your meter fills the same way the characters' do. When it's full you pick one; using it
   doesn't end your turn. Smite and Shield need a target, picked by clicking the board. */
const PLAYER = { id: 'you', name: 'You', glow: '#f4f2fb', img: null, emoji: { ult: '♛' } }
export const PLAYER_ULTS = {
  smite: { fx: 'smite', name: 'Smite', text: 'Remove one enemy knight, bishop or pawn of your choice.' },
  shield: { fx: 'shield', name: 'Shield', text: "One of your pieces can't be captured on the opponent's next turn." },
  rewind: { fx: 'rewind', name: 'Rewind', text: "Undo the opponent's last move. You move again." },
  double: { fx: 'double', name: 'Double Move', text: "Make two moves in a row. The second move can't capture." },
  // the heroes' signatures: only the one you play as is offered (`hero` = their HEROES key in usePlayer)
  // `boardFx` / `glow`: the effect the board plays (reusing an existing one), if not the same as `fx`
  swap: { fx: 'swap', hero: 'm', name: 'Shadow Swap', text: 'Two of your pieces (not the king) trade places in an instant. Your turn continues.' },
  sight: { fx: 'sight', hero: 'f', glow: '#ff3b5c', name: 'Crimson Sight', text: 'Her eyes see the path to victory: your best line of moves is marked in red, with a "Checkmate in N" warning if a forced mate exists.' },
}
// (Double Move was removed: an extra move is Ren's Time Skip, his alone)
export const SHARED_ULTS = ['smite', 'shield', 'rewind']
/** The ultimates you can pick from: your hero's signature (if you've chosen one) first, then the shared four. */
export function ultsFor(look) {
  const sig = Object.keys(PLAYER_ULTS).find(k => PLAYER_ULTS[k].hero && PLAYER_ULTS[k].hero === look)
  return sig ? [sig, ...SHARED_ULTS] : [...SHARED_ULTS]
}
const SMITABLE = ['n', 'b', 'p'] // worth up to 3, like the rivals' ultimates
const aim = ref(null)      // 'smite' | 'shield' | 'swap' while you're choosing a target
const swapFrom = ref(null) // Shadow Swap: the first piece picked
const shield = ref(null)   // square of your shielded piece, until the opponent's turn ends
let bonusMove = false      // Double Move: skip the opponent's next turn
const noCapture = ref(false) // the second move of a Double Move (or Time Skip) can't capture
// Kyo's Iron Dominion: { color, squares, turns } = pieces of `color` on these squares can't move for `turns` more turns
const seal = ref(null)
// Shion's Venom Kiss: { color, by, squares } = these pieces of `color` wither at the start of `by`'s next turn unless moved
const poison = ref(null)
/* Erika's Downpour: { color, squares, turns } = pieces of `color` can't move onto these flooded squares
   Melati's Tenunan: { color, squares: [a, b], turns } = two pieces tied by a gold thread; move one and the other is lost
   AI-0's Calculate: { color, moves: ['e2e4', …] | null, pending } = these moves of `color` are forbidden on its next turn */
const flood = ref(null)
const bond = ref(null)
const calc = ref(null)
const floodFor = color => (flood.value && color && flood.value.color === color ? flood.value.squares : [])
const calcFor = color => (calc.value && !calc.value.pending && calc.value.color === color ? calc.value.moves ?? [] : [])
const uciOf = m => m.from + m.to + (m.promotion || '')
/** The moves `color` may actually play right now, given floods and Calculate (never leaves nothing to play). */
function allowed(moves, color) {
  const fl = floodFor(color), cb = calcFor(color)
  if (!fl.length && !cb.length) return moves
  const ok = moves.filter(m => !fl.includes(m.to) && !cb.includes(uciOf(m)))
  return ok.length ? ok : moves
}
const sealedFor = color => (seal.value && color && seal.value.color === color ? seal.value.squares : [])
/** After a move: a piece that moved off a poisoned square is cured; anything captured on a marked square clears it. */
function afterMoveMarks(mv) {
  // Tenunan: moving one tied piece loses the other (only if that leaves the board legal); a captured one cuts the thread
  if (bond.value) {
    const b = bond.value
    if (b.squares.includes(mv.to) && mv.color !== b.color) bond.value = null
    else if (mv.color === b.color && b.squares.includes(mv.from)) {
      const other = b.squares.find(q => q !== mv.from), p = chess.value.get(other)
      bond.value = null
      if (p && p.color === b.color && p.type !== 'k' && safeChange(other, null, b.color) && kingSafe(other_(b.color))) {
        setSquare(other, null); loseTo(b.color, p.type)
        ultEvent.value = { fx: 'snap', glow: '#e3b23c', squares: [mv.to, other], gone: [{ sq: other, code: p.color + p.type }], side: other_(b.color), n: (ultEvent.value?.n ?? 0) + 1 }
        const owner = side[other_(b.color)].char.value
        if (owner) say(other_(b.color), 'The thread breaks… and so does your piece.')
      }
    } else if (mv.color === b.color && --b.turns <= 0) bond.value = null
  }
  if (flood.value?.color === mv.color && --flood.value.turns <= 0) flood.value = null
  if (calc.value?.color === mv.color && !calc.value.pending) calc.value = null
  if (seal.value) seal.value = { ...seal.value, squares: seal.value.squares.filter(q => q !== mv.to) }
  if (poison.value) poison.value = { ...poison.value, squares: poison.value.squares.filter(q => q !== mv.from && q !== mv.to) }
  // the victim's turn is over: one turn of the seal used up
  if (seal.value?.color === mv.color && --seal.value.turns <= 0) seal.value = null
}
let lastAiSnap = null      // position + losses just before the opponent's last move (for Rewind)
let moveCount = 0
let ultCount = 0
let session = 0
let recorded = false
let holdUntil = 0 // the screen is busy (a death close-up): the computer waits until then
const hold = ms => { holdUntil = Math.max(holdUntil, Date.now() + ms) }
const release = () => { holdUntil = 0 }

const touch = () => { tick.value++ }
const wait = ms => sleep(mode.value === 'watch' ? ms / speed.value : ms)

// what each square holds at the start, for spotting pieces that never moved
const START = new Map()
new Chess().board().forEach((row, r) => row.forEach((p, f) => { if (p) START.set(FILES[f] + (8 - r), p.color + p.type) }))

/** Each piece's mood, from what's happening around it. Priority, highest first:
    game over (cheer / sad) → targeted by an ultimate (shock) → king in check (panic) → just captured (proud)
    → attacked (afraid if undefended or attacked by something cheaper, else nervous)
    → threatening something bigger or giving check (smug) → never moved, late in the game (sleepy) → idle */
function moods(g, kingSq) {
  const out = {}
  const board = g.board()
  const at = []
  board.forEach((row, r) => row.forEach((p, f) => { if (p) at.push([FILES[f] + (8 - r), p]) }))

  const res = over.value?.result
  const winner = res === 'win' || res === 'white' ? 'w' : res === 'loss' || res === 'black' ? 'b' : null
  // pieces threatening something worth more than themselves (or the king)
  const smug = new Set()
  for (const [sq, p] of at) {
    for (const a of g.attackers(sq, other(p.color))) {
      const ap = g.get(a)
      if (ap && (p.type === 'k' || VAL[p.type] > VAL[ap.type])) smug.add(a)
    }
  }
  const late = g.moveNumber() >= 12
  const lm = lastMove.value
  for (const [sq, p] of at) {
    let m = 'idle'
    if (over.value) m = winner ? (p.color === winner ? 'cheer' : 'sad') : 'idle'
    else if (boom.value.includes(sq)) m = 'shock'
    else if (sq === kingSq) m = 'panic'
    else if (lm && lm.to === sq && lm.captured) m = 'proud'
    else if (p.type !== 'k' && g.attackers(sq, other(p.color)).length) {
      const attackers = g.attackers(sq, other(p.color)).map(a => VAL[g.get(a)?.type] ?? 9)
      const defended = g.attackers(sq, p.color).length > 0
      m = !defended || Math.min(...attackers) < VAL[p.type] ? 'afraid' : 'nervous'
    }
    else if (smug.has(sq)) m = 'smug'
    else if (late && p.type !== 'k' && START.get(sq) === p.color + p.type) m = 'sleepy'
    out[sq] = m
  }
  return out
}

const squares = computed(() => {
  tick.value
  const g = chess.value
  const b = g.board()
  const kingSq = g.inCheck() ? findKing(g.turn()) : null
  const mood = moods(g, kingSq)
  const out = []
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const name = FILES[f] + (8 - r)
    const hint = hints.value.find(m => m.to === name)
    out.push({
      name, piece: b[r][f], light: (r + f) % 2 === 0,
      selected: selected.value === name,
      last: !!lastMove.value && (lastMove.value.from === name || lastMove.value.to === name),
      hint: !!hint, capture: !!hint?.captured, stale: !!hint?.stale, check: kingSq === name, boom: boom.value.includes(name),
      mood: mood[name] ?? 'idle',
      aimable: !!aim.value && aimable(name),
      shielded: shield.value === name,
      sealed: sealedFor(b[r][f]?.color).includes(name),
      sight: seal.value?.kind === 'sight' && sealedFor(b[r][f]?.color).includes(name), // Akane's crimson rings, not chains
      picked: picks.value.includes(name),
      flooded: floodFor(flood.value?.color).includes(name),
      bonded: !!b[r][f] && !!bond.value && bond.value.color === b[r][f].color && bond.value.squares.includes(name),
      poisoned: !!b[r][f] && !!poison.value && poison.value.color === b[r][f].color && poison.value.squares.includes(name),
    })
  }
  return out
})

const turn = computed(() => { tick.value; return chess.value.turn() })

/** Status line for one side's panel. */
function statusOf(color) {
  tick.value
  const c = side[color].char.value
  if (!c || over.value) return ''
  if (mode.value === 'duel') return turn.value === ME ? 'Your turn' : `${c.name} is thinking…`
  if (paused.value) return 'Paused'
  return turn.value === color ? 'Thinking…' : 'Waiting'
}
const status = computed(() => statusOf('b'))

function findKing(color) {
  const b = chess.value.board()
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]
    if (p && p.type === 'k' && p.color === color) return FILES[f] + (8 - r)
  }
}

function setMood(color, mood, anim = '') { const f = side[color].face; f.value = { mood, anim, n: f.value.n + 1 } }
const say = (color, t) => { side[color].bubble.value = t; replyLater(color, t) }
/* A paired conversation (Rai and AI-0): if the other side has an answer to exactly this line (say.replyTo), they say it
   a moment later, over whatever they said at the same time. Answers never trigger answers. */
let replyTimer = null
function replyLater(color, t) {
  const o = color === 'w' ? 'b' : 'w', oc = side[o].char.value
  const answer = (oc?.flirting || oc?.flustered) && oc.say.replyTo?.[t]
  if (!answer) return
  const s = session
  clearTimeout(replyTimer)
  // the answer comes quicker when Spectate is sped up, so the next move doesn't cut it off
  const delay = mode.value === 'watch' ? 1500 / speed.value : 1700
  replyTimer = setTimeout(() => { if (s === session) { setMood(o, oc.flustered ? 'shock' : 'happy', 'react'); side[o].bubble.value = answer } }, delay)
}
const setCharge = (color, v) => { side[color].charge.value = Math.max(0, Math.min(100, v)) }
const worth = list => list.reduce((sum, t) => sum + (VAL[t] ?? 0), 0)
/** Comeback: a side 5+ points of material behind fills its meter 1.5x faster. */
const behind = color => worth(lost.value[color]) - worth(lost.value[other(color)]) >= 5
// each rival's meter speed (ult.charge) keeps the stronger ultimates rarer; yours fills at the normal speed
const rate = color => side[color].char.value?.ult?.charge ?? 1
const gain = (color, v) => setCharge(color, side[color].charge.value + v * rate(color) * (behind(color) ? 1.5 : 1))

function reset() {
  session++
  initEngine()
  chess.value = new Chess()
  selected.value = null; hints.value = []; lastMove.value = null
  busy.value = false; over.value = null; boom.value = []; cutin.value = false; paused.value = false
  gameFlags = { comeback: false, queenLost: false, chainHit: false }; clearTimeout(habitTimer)
  undoStack = []; skipPending = { w: false, b: false }; moveCount = 0; ultCount = 0; recorded = false
  lost.value = { w: [], b: [] }
  aim.value = null; swapFrom.value = null; shield.value = null; bonusMove = false; noCapture.value = false; lastAiSnap = null
  path.value = null; sightBoost.w = 0; sightBoost.b = 0; picks.value = []; pickInfo.value = null
  seal.value = null; poison.value = null; flood.value = null; bond.value = null; calc.value = null; playerSet.value = null; playAs.value = { hero: null, rival: null }
  for (const c of ['w', 'b']) { side[c].char.value = null; setCharge(c, 0); say(c, ''); setMood(c, 'idle') }
}

/* Story mode: your pieces change as the story goes on (bone → dark → awakened, a set of your own).
   `playerSet` is the piece set on your side (null = the default bone set). */
const playerSet = ref(null)
const PLAYER_GLOW = HERO_GLOW

/* Who you play as: a hero (Shin 'm' / Akane 'f': the player ultimates plus their signature) or, in Free Battle,
   any rival (their piece set, movement, voice, meter speed and their one ultimate, fired from your side). */
const playAs = ref({ hero: null, rival: null })
const you = computed(() => {
  const r = playAs.value.rival && CHARS[playAs.value.rival]
  if (r) return { kind: 'rival', id: r.id, name: r.name, img: r.img, glow: r.glow, focus: r.focus, ult: r.ult }
  const h = HEROES[playAs.value.hero]
  return { kind: 'hero', id: 'you', look: h?.key ?? null, name: h?.name ?? 'You', img: h?.img ?? null, glow: PLAYER_GLOW, focus: '50% 30%' }
})

/** Rai (say.vsFemale): against a female opponent he swaps in his flirty lines, and hearts float round his portrait. */
const withFlirt = (c, opp) => {
  // AI-0 answers Rai: her own replies, and her hearts flicker teal as she tries to process him
  if (opp?.id === 'rai' && c?.say?.vsRai) return { ...c, flustered: true, say: { ...c.say, ...c.say.vsRai } }
  const lines = opp?.id === 'ai' && c?.say?.vsAI ? c.say.vsAI : opp?.female ? c?.say?.vsFemale : null
  return lines ? { ...c, flirting: true, say: { ...c.say, ...lines } } : c
}
/** A character as they play right now: their evolved piece set, if they evolve (Rai). */
const live = c => (c?.evolve ? { ...c, pieces: setOf(c) } : c)
// for achievements: things that happened during this game
let gameFlags = { comeback: false, queenLost: false, chainHit: false }
let turnStart = 0 // when your current move started (for your habits)
let habitTimer = null

/** You (White) vs a character (Black). `level` (a LEVELS name) overrides the rival's own strength.
    `set` (story mode) is the piece set your side uses. */
function start(id, level = null, { set = null, as = null } = {}) {
  reset()
  mode.value = 'duel'
  // `as`: a rival's id, or a hero ('m' / 'f'); by default your story hero
  const rival = CHARS[as] ? as : null
  playAs.value = { rival, hero: rival ? null : HEROES[as] ? as : usePlayer().look.value }
  if (rival) side[ME].char.value = live(CHARS[rival]) // your side has a character: their meter speed, their ultimate
  playerSet.value = set ?? (rival ? setOf(CHARS[rival]) : null)
  // your side's glow: the rival you play as, or your own colour in the story (else falls back to the opponent's)
  if (rival) document.documentElement.style.setProperty('--cw', CHARS[rival].glow)
  else if (set) document.documentElement.style.setProperty('--cw', PLAYER_GLOW)
  else document.documentElement.style.removeProperty('--cw')
  const L = level && LEVELS.find(l => l.name === level)
  side.b.char.value = L ? { ...live(CHARS[id]), skill: L.skill, depth: L.depth, level: L.name } : live(CHARS[id])
  // who you are, as a character (for Rai's flirting): the rival you play as, or Akane / Shin
  const youAs = rival ? CHARS[rival] : CHARS[{ m: 'shin', f: 'akane' }[playAs.value.hero]] ?? null
  side.b.char.value = withFlirt(side.b.char.value, youAs)
  // facing yourself: the other one is your Alter
  if (mirror.value) side.b.char.value = { ...side.b.char.value, name: 'Alter ' + CHARS[id].name, alter: true }
  document.documentElement.style.setProperty('--c', CHARS[id].glow)
  const flirting = !!side.b.char.value.flirting || !!side.b.char.value.flustered
  say('b', mirror.value ? mirrorLine(CHARS[id], 'start', greeting(CHARS[id])) : flirting ? side.b.char.value.say.start : greeting(CHARS[id])); touch()
  // rival memory: a few seconds in, if you haven't moved yet, they needle you about your habits
  const habit = !mirror.value && !flirting && useProgress().habitLine(CHARS[id])
  clearTimeout(habitTimer)
  if (habit) { const s = session; habitTimer = setTimeout(() => { if (s === session && moveCount === 0 && !over.value) { setMood('b', 'happy', 'react'); say('b', habit) } }, 3500) }
}

/* A mirror match: a character against themselves. In a duel that's playing as the same rival (or as Shin against
   Shin, Akane against Akane); in Spectate, the same rival on both sides. They get their own lines (say.mirror). */
const HERO_CHAR = { m: 'shin', f: 'akane' }
const mirror = computed(() => {
  const b = side.b.char.value?.id
  if (!b) return false
  if (mode.value === 'watch') return side.w.char.value?.id === b
  return playAs.value.rival === b || (!playAs.value.rival && HERO_CHAR[playAs.value.hero] === b && !playerSet.value)
})
const mirrorLine = (c, key, fallback) => c.say.mirror?.[key] ?? fallback

/** Rival memory: a character greets you according to your record against them. */
function greeting(c) {
  const rec = useStats().byCharacter.value[c.id]
  if (!rec?.played) return c.say.start
  const fill = t => t.replace('{w}', rec.win).replace('{l}', rec.loss)
  if (rec.win > rec.loss && c.say.metBeaten) return fill(c.say.metBeaten)
  if (rec.loss > rec.win && c.say.metWon) return fill(c.say.metWon)
  return c.say.metAgain ? fill(c.say.metAgain) : c.say.start
}

/** Computer vs computer: `whiteId` plays White, `blackId` plays Black. */
function startWatch(whiteId, blackId) {
  reset()
  mode.value = 'watch'
  side.w.char.value = withFlirt(live(CHARS[whiteId]), CHARS[blackId])
  side.b.char.value = whiteId === blackId ? { ...live(CHARS[blackId]), name: 'Alter ' + CHARS[blackId].name, alter: true } : withFlirt(live(CHARS[blackId]), CHARS[whiteId])
  document.documentElement.style.setProperty('--c', CHARS[blackId].glow)
  document.documentElement.style.setProperty('--cw', CHARS[whiteId].glow)
  if (whiteId === blackId) { say('b', mirrorLine(CHARS[blackId], 'start', CHARS[blackId].say.start)); say('w', mirrorLine(CHARS[whiteId], 'reply', CHARS[whiteId].say.start)) }
  else if (side.w.char.value.flustered || side.b.char.value.flustered) {
    // Rai vs AI-0: he flirts first, and she answers him (her reply to his exact line)
    const her = side.w.char.value.flustered ? 'w' : 'b'
    say(other(her), side[other(her)].char.value.say.start)
  } else { say('w', side.w.char.value.say.start); say('b', side.b.char.value.say.start) }
  touch()
  watchLoop(session)
}

function leave() { session++; busy.value = false; paused.value = false; side.w.char.value = null; side.b.char.value = null }

function select(sq) {
  if (mode.value !== 'duel' || busy.value || over.value || chess.value.turn() !== ME) return
  if (aim.value === 'pick') return pickTarget(sq)
  if (aim.value) {
    if (!aimable(sq)) return
    const kind = aim.value
    if (kind === 'smite') { const t = chess.value.get(sq).type; fire('smite', [sq], () => { setSquare(sq, null); loseTo(other(ME), t) }) }
    else if (kind === 'swap') {
      if (!swapFrom.value) { swapFrom.value = sq; selected.value = sq; touch(); return }
      if (swapFrom.value === sq) { swapFrom.value = null; selected.value = null; touch(); return } // pick again
      const a = swapFrom.value
      fire('swap', [a, sq], () => swapPieces(a, sq))
    } else fire('shield', [sq], () => { shield.value = sq })
    return
  }
  const h = hints.value.find(m => m.to === sq)
  if (selected.value && h) return playerMove(h)
  const p = chess.value.get(sq)
  if (p && p.color === ME && sealedFor(ME).includes(sq)) { selected.value = null; hints.value = []; touch(); return } // chained
  if (p && p.color === ME) {
    selected.value = sq
    const legal = allowed(chess.value.moves({ verbose: true }), ME) // floods and Calculate, judged over all your moves
    hints.value = legal.filter(m => m.from === sq && (!noCapture.value || !m.captured)).map(m => ({ ...m, stale: wouldStalemate(m) }))
  }
  else { selected.value = null; hints.value = [] }
}

/** Both characters react to a move: the mover gloats, the other side winces. */
function react(mv, mover) {
  const g = chess.value
  // a paired conversation (Rai and AI-0): one of them speaks per move and the other answers (see replyLater).
  // A capture or check: the mover speaks. A quiet move: the one about to move sometimes muses, and the other answers.
  const convo = ['w', 'b'].some(c => side[c].char.value?.flustered) && ['w', 'b'].some(c => side[c].char.value?.flirting)
  const loud = !!mv.captured || g.inCheck()
  const quietTalk = convo && !loud && Math.random() < 0.45
  for (const color of ['w', 'b']) {
    const c = side[color].char.value
    const isYou = mode.value === 'duel' && color === ME
    if (!c && !isYou) continue
    // meters: +25 for a capture, +10 for giving check, +15 for losing a piece (x1.5 when far behind)
    if (color === mover) {
      if (mv.captured) gain(color, 25)
      if (g.inCheck()) gain(color, 10)
    } else if (mv.captured) gain(color, 15)
    if (!c) continue // you have a meter but no face or lines
    if (color === mover) {
      if (mv.captured) { setMood(color, 'happy', 'react'); say(color, pick(c.say.capture)) }
      if (g.inCheck()) { setMood(color, 'happy', 'react'); say(color, pick(c.say.check)) }
      if (!mv.captured && !g.inCheck()) setMood(color, 'idle')
    } else if (convo && loud) {
      setMood(color, mv.captured && VAL[mv.captured] >= 5 ? 'shock' : 'angry', 'hurt') // they'll answer the mover in a moment
    } else if (mv.captured) {
      setMood(color, VAL[mv.captured] >= 5 ? 'shock' : 'angry', 'hurt'); say(color, pick(c.say.lost))
    } else if (g.inCheck()) { setMood(color, 'shock', 'hurt'); say(color, pick(c.say.inCheck)) }
    else { setMood(color, 'idle'); if (!convo || quietTalk) say(color, pick(c.say.think)) }
  }
}

async function playerMove(m) {
  undoStack.push({ fen: chess.value.fen(), lost: lost.value })
  const mv = chess.value.move({ from: m.from, to: m.to, promotion: 'q' })
  path.value = null
  if (mode.value === 'duel') {
    const p = useProgress()
    if (moveCount === 0) p.recordOpening(mv.san)
    if (turnStart) p.recordMoveTime(Date.now() - turnStart)
  }
  if (mv.captured) loseTo(other(mv.color), mv.captured)
  if (shield.value === mv.from) shield.value = mv.to // the shield moves with its piece
  afterMoveMarks(mv)
  moveCount++
  lastMove.value = mv; selected.value = null; hints.value = []
  noCapture.value = false
  react(mv, ME); touch()
  if (checkOver()) return
  if (bonusMove) {
    bonusMove = false
    // a second move is only fair if the first didn't give check (otherwise the king could simply be taken)
    if (kingSafe(other(ME))) {
      const before = chess.value.fen()
      const parts = before.split(' '); parts[1] = ME; parts[3] = '-'
      try {
        chess.value.load(parts.join(' '))
        // the bonus move can't capture; if every legal move is a capture, the bonus is lost
        if (chess.value.moves({ verbose: true }).some(m => !m.captured)) {
          noCapture.value = true
          say('b', "Two moves?! That's not fair!"); touch(); return
        }
        chess.value.load(before)
      } catch { /* fall through */ }
    }
  }
  await aiTurn(other(ME))
}

/** The character playing `color` makes one engine move. `flip` forces it to be their turn (Time Skip). */
async function aiMove(color, flip = false) {
  const s = session, c = side[color].char.value
  let fen = chess.value.fen()
  const original = fen // to hand the turn back if a bonus move turns out impossible
  if (flip && chess.value.turn() !== color) {
    const parts = fen.split(' '); parts[1] = color; parts[3] = '-'
    try { chess.value.load(parts.join(' ')); fen = chess.value.fen() } catch { return }
  }
  // never capture a king: that can only be offered in a position chess doesn't allow (see Time Skip below)
  let moves = chess.value.moves({ verbose: true }).filter(x => x.captured !== 'k')
  // Time Skip's bonus move can't capture: it can set up a threat, but you get to answer it
  let quiet = false
  if (flip) {
    const q = moves.filter(x => !x.captured)
    if (!q.length) { if (fen !== original) chess.value.load(original); touch(); return }
    quiet = q.length < moves.length
    moves = q
  }
  // Iron Dominion: chained pieces can't move (unless nothing else can)
  if (calc.value?.color === color && calc.value.pending) await computeCalc(color)
  if (s !== session) return
  {
    const ok = allowed(moves, color)
    if (ok.length < moves.length) { moves = ok; quiet = true }
  }
  const chained = sealedFor(color)
  if (chained.length) {
    const free = moves.filter(x => !chained.includes(x.from))
    if (free.length && free.length < moves.length) { moves = free; quiet = true }
  }
  // your Shield: the shielded piece can't be captured (unless that's the only legal move)
  const guarded = shield.value && color !== ME ? moves.filter(x => !(x.to === shield.value && x.captured)) : moves
  const limited = quiet || (guarded.length && guarded.length < moves.length)
  if (limited) moves = guarded
  // the low levels sometimes slip and play a random move instead of the engine's (see LEVELS.blunder)
  const boosted = sightBoost[color] > 0
  if (boosted) sightBoost[color]--
  const slip = !boosted && Math.random() < (LEVELS.find(l => l.name === c.level)?.blunder ?? 0)
  const t0 = Date.now()
  const uci = slip ? null : await engineMove(fen, boosted ? { ...c, skill: 20, depth: Math.max(c.depth ?? 8, 14) } : c, limited ? moves.map(x => x.from + x.to + (x.promotion || '')) : null)
  if (s !== session) return
  if (!moves.length) return
  const m = (uci && moves.find(x => x.from + x.to + (x.promotion || '') === uci)) || pick(moves)
  // in a duel the rival takes a moment to think (1.5–3s, counting the engine's own time); a bonus move is quicker
  const think = mode.value === 'duel' ? (flip ? 700 : 1500 + Math.random() * 1500) : 450
  await wait(Math.max(700, think - (Date.now() - t0)))
  // a death close-up is playing: let it finish before moving
  while (Date.now() < holdUntil) { await sleep(60); if (s !== session) return }
  if (s !== session) return
  if (mode.value === 'duel' && color !== ME) lastAiSnap = { fen: chess.value.fen(), lost: lost.value }
  const mv = chess.value.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' })
  if (mv.captured) loseTo(other(mv.color), mv.captured)
  afterMoveMarks(mv)
  if (mode.value === 'watch') moveCount++ // in a duel, saved stats count only your moves
  lastMove.value = mv; react(mv, color); touch()
}

/** One full turn for the character playing `color`: ultimate if charged, a move, and a bonus move after Time Skip. */
/** AI-0's Calculate: find the `color` side's 3 best moves in the current position and forbid them for this turn. */
async function computeCalc(color) {
  const parts = chess.value.fen().split(' '); parts[1] = color; parts[3] = '-'
  let top = null
  try { top = await engineTopMoves(parts.join(' '), 3, 8) } catch { top = null }
  const legal = chess.value.moves({ verbose: true }).filter(m => m.color === color)
  if (!top?.length) top = legal.filter(m => m.captured).sort((a, b) => VAL[b.captured] - VAL[a.captured]).slice(0, 3).map(uciOf) // engine unavailable: its best guesses
  top = top.filter(u => legal.some(m => uciOf(m) === u))
  if (top.length >= legal.length) top = top.slice(0, Math.max(0, legal.length - 1)) // always leave a move to play
  calc.value = { color, moves: top, pending: false }
  touch()
}

async function aiTurn(color) {
  const s = session
  busy.value = true; touch()
  if (poison.value?.by === color) await wither(color)
  if (s !== session) return
  if (side[color].charge.value >= 100 && !ended() && canFire(color)) await ultimate(color)
  if (s !== session) return
  if (!ended()) await aiMove(color)
  if (s !== session) return
  if (!checkOver() && skipPending[color]) {
    const victim = side[other(color)].char.value
    if (!kingSafe(other(color))) {
      // The first move gave check. A bonus move now would let the king simply be taken (an illegal
      // position), so the victim answers the check first and the skip waits for the next turn.
      say(color, 'Time can wait… for now.')
    } else {
      skipPending[color] = false
      say(color, victim ? `Time is frozen. ${victim.name}'s turn is skipped!` : 'Time is frozen. Your turn is skipped!')
      await wait(700)
      if (s !== session) return
      await aiMove(color, true)
      if (s !== session) return
      checkOver()
    }
  }
  if (mode.value === 'duel' && poison.value?.by === ME && !ended()) { await wither(ME); if (s !== session) return; checkOver() }
  if (seal.value?.color === ME && mode.value === 'duel' && !chess.value.moves({ verbose: true }).some(m => !seal.value.squares.includes(m.from))) seal.value = null
  if (calc.value?.color === ME && calc.value.pending && mode.value === 'duel') { await computeCalc(ME); if (s !== session) return }
  if (mode.value === 'duel') { busy.value = false; shield.value = null }
  touch()
}

/** Spectate: both sides play until the game ends, the player leaves, or a new game starts. */
async function watchLoop(s) {
  await wait(1200)
  while (s === session && !over.value) {
    while (paused.value && s === session) await sleep(150)
    if (s !== session) return
    await aiTurn(chess.value.turn())
    if (s !== session || over.value) return
    await wait(500)
  }
}

/** Squares holding `color`'s pieces that match `filter`, in random order. */
function squaresOf(color, filter) {
  const out = []
  chess.value.board().forEach((row, r) => row.forEach((p, f) => {
    if (p && p.color === color && filter(p)) out.push(FILES[f] + (8 - r))
  }))
  return out.sort(() => Math.random() - .5)
}

/* Ultimates change pieces at the start of the attacker's turn. A change that leaves the defender's king
   attacked would be an illegal position (the attacker could "capture" the king), so every change is checked. */
function setSquare(sq, piece) { chess.value.remove(sq); if (piece) chess.value.put(piece, sq) }
function kingSafe(def) { const k = findKing(def); return !k || !chess.value.isAttacked(k, other(def)) }
/** Would replacing the piece on `sq` with `piece` (null = remove it) keep `def`'s king safe? */
function safeChange(sq, piece, def) {
  const old = chess.value.get(sq)
  setSquare(sq, piece)
  const ok = kingSafe(def)
  setSquare(sq, old)
  return ok
}

/** Works out what `att`'s ultimate does: a list of { sq, piece } changes (piece null = removed). */
function planUltimate(fx, att) {
  const def = other(att)
  const g = chess.value
  if (fx === 'burn') {
    // a knight or bishop (3 points); two pawns when none are left
    const minor = squaresOf(def, p => p.type === 'n' || p.type === 'b').filter(sq => safeChange(sq, null, def)).slice(0, 1)
    const hit = minor.length ? minor : squaresOf(def, p => p.type === 'p').filter(sq => safeChange(sq, null, def)).slice(0, 2)
    return hit.map(sq => ({ sq, piece: null }))
  }
  if (fx === 'freeze') {
    return squaresOf(def, p => p.type === 'p').filter(sq => safeChange(sq, null, def)).slice(0, 3).map(sq => ({ sq, piece: null }))
  }
  if (fx === 'promote') {
    // crown the attacker's most advanced pawn
    const queen = { type: 'q', color: att }
    const pawns = squaresOf(att, p => p.type === 'p').sort((a, b) => (att === 'b' ? +a[1] - +b[1] : +b[1] - +a[1]))
    return pawns.filter(sq => safeChange(sq, queen, def)).slice(0, 1).map(sq => ({ sq, piece: queen }))
  }
  if (fx === 'revive') {
    // one of the attacker's lost knights or bishops returns to an empty starting square; otherwise two lost pawns
    const back = att === 'w' ? '1' : '8', pawnRank = att === 'w' ? '2' : '7'
    const home = { n: ['b', 'g'], b: ['c', 'f'] }
    const minors = ['n', 'b'].filter(t => lost.value[att].includes(t)).sort(() => Math.random() - .5)
    for (const t of minors) {
      const sq = home[t].map(f => f + back).sort(() => Math.random() - .5)
        .find(q => !g.get(q) && safeChange(q, { type: t, color: att }, def))
      if (sq) return [{ sq, piece: { type: t, color: att } }]
    }
    const pawnsLost = lost.value[att].filter(t => t === 'p').length
    return FILES.split('').map(f => f + pawnRank).sort(() => Math.random() - .5)
      .filter(q => !g.get(q) && safeChange(q, { type: 'p', color: att }, def))
      .slice(0, Math.min(2, pawnsLost)).map(sq => ({ sq, piece: { type: 'p', color: att } }))
  }
  if (fx === 'demote') {
    // the defender's queen becomes a rook; with no queen, a rook becomes a knight
    for (const [from, to] of [['q', 'r'], ['r', 'n']]) {
      const hit = squaresOf(def, p => p.type === from).map(sq => ({ sq, piece: { type: to, color: def } }))
        .filter(ch => safeChange(ch.sq, ch.piece, def)).slice(0, 1)
      if (hit.length) return hit
    }
    return []
  }
  if (fx === 'gamble') {
    // roll a die: 1-2 backfires (lose one of your own pawns), 3-5 burn a knight/bishop, 6 burn two
    const roll = 1 + Math.floor(Math.random() * 6)
    let out
    if (roll <= 2) out = squaresOf(att, p => p.type === 'p').slice(0, 1).map(sq => ({ sq, piece: null }))
    else {
      const n = roll === 6 ? 2 : 1
      const minors = squaresOf(def, p => p.type === 'n' || p.type === 'b').filter(sq => safeChange(sq, null, def))
      const pawns = squaresOf(def, p => p.type === 'p').filter(sq => safeChange(sq, null, def))
      out = [...minors, ...pawns].slice(0, n).map(sq => ({ sq, piece: null }))
    }
    out.roll = roll
    return out
  }
  if (fx === 'seal') {
    // chain the defender's two most valuable pieces (never the king); nothing on the board changes
    return squaresOf(def, p => p.type !== 'k' && p.type !== 'p').sort((a, b2) => VAL[g.get(b2).type] - VAL[g.get(a).type])
      .slice(0, 2).map(sq => ({ sq, piece: g.get(sq) }))
  }
  if (fx === 'poison') {
    // mark two knights, bishops or rooks that could still escape (so there's always a real choice to make);
    // they wither later unless moved
    let canMove = new Set()
    try {
      const parts = g.fen().split(' '); parts[1] = def; parts[3] = '-'
      canMove = new Set(new Chess(parts.join(' ')).moves({ verbose: true }).map(x => x.from))
    } catch { /* no legal position for the defender to move in: nothing can escape */ }
    return squaresOf(def, p => ['n', 'b', 'r'].includes(p.type)).filter(q => canMove.has(q)).slice(0, 2).map(sq => ({ sq, piece: g.get(sq) }))
  }
  if (fx === 'swap') return planSwap(att)
  if (fx === 'reset') return planReset(att)
  // Downpour: flood the two empty squares the defender's pieces could most reach
  if (fx === 'flood') {
    let reach = {}
    try {
      const parts = g.fen().split(' '); parts[1] = def; parts[3] = '-'
      for (const m of new Chess(parts.join(' ')).moves({ verbose: true })) if (!m.captured) reach[m.to] = (reach[m.to] ?? 0) + VAL[m.piece] + 1
    } catch { reach = {} }
    return Object.entries(reach).sort((a, b) => b[1] - a[1] || Math.random() - .5).slice(0, 2).map(([sq]) => ({ sq, piece: null }))
  }
  // Tenunan: tie the defender's two most valuable pieces (never the king)
  // Chain Lightning: strike a knight, bishop or pawn, then arc to one more of the defender's pieces right next to it
  if (fx === 'chain') {
    const near = (a, b) => a !== b && Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) <= 1 && Math.abs(+a[1] - +b[1]) <= 1
    const firsts = squaresOf(def, p => ['n', 'b', 'p'].includes(p.type)).filter(sq => safeChange(sq, null, def))
      .sort((a, b2) => VAL[g.get(b2).type] - VAL[g.get(a).type] || Math.random() - .5)
    for (const first of firsts) {
      const before = g.get(first)
      setSquare(first, null)
      const second = squaresOf(def, p => ['n', 'b', 'p'].includes(p.type)).filter(sq => near(first, sq) && safeChange(sq, null, def))
        .sort((a, b2) => VAL[g.get(b2).type] - VAL[g.get(a).type])[0]
      setSquare(first, before)
      if (second) return [{ sq: first, piece: null }, { sq: second, piece: null }]
    }
    return firsts.slice(0, 1).map(sq => ({ sq, piece: null }))
  }
  if (fx === 'bond') {
    if (bond.value) return []
    return squaresOf(def, p => p.type !== 'k').sort((a, b2) => VAL[g.get(b2).type] - VAL[g.get(a).type] || Math.random() - .5)
      .slice(0, 2).map(sq => ({ sq, piece: g.get(sq) }))
  }
  // Crimson Sight: like Iron Dominion but for one turn; nothing on the board changes (not while a chain is already there)
  if (fx === 'sight') return [] // nothing on the board changes: see ultimate() / revealPath()
  if (fx === 'steal') {
    // turn one of the defender's knights or bishops into the attacker's
    return squaresOf(def, p => p.type === 'n' || p.type === 'b')
      .map(sq => ({ sq, piece: { type: g.get(sq).type, color: att } }))
      .filter(ch => safeChange(ch.sq, ch.piece, def)).slice(0, 1)
  }
  return []
}

/** Venom Kiss resolves: poisoned pieces still on their marked squares wither away. */
async function wither(att) {
  const s = session, pz = poison.value, c = side[att].char.value
  poison.value = null
  const hit = pz.squares.filter(q => chess.value.get(q)?.color === pz.color && safeChange(q, null, pz.color))
  if (!hit.length) { say(att, 'Tch… you cured them.'); touch(); return }
  say(att, 'The poison takes hold~')
  ultEvent.value = { fx: 'wither', glow: c.glow, squares: hit, side: att, n: (ultEvent.value?.n ?? 0) + 1 }
  boom.value = hit
  await wait(900)
  if (s !== session) return
  for (const q of hit) { const t = chess.value.get(q).type; setSquare(q, null); loseTo(pz.color, t) }
  boom.value = []
  try { chess.value.load(chess.value.fen()) } catch { /* keep position as is */ }
  touch()
  await wait(500)
}

/** Is there anything for this side's ultimate to do? (No point firing Bloom with nothing to bring back.) */
function canFire(att) {
  const fx = side[att].char.value?.ult?.fx
  if (fx === 'reset') return planReset(att).length > 0
  if (fx === 'calc') return !calc.value
  return fx === 'skip' || fx === 'gamble' || planUltimate(fx, att).length > 0
}

// how long each ultimate's board animation plays before the pieces actually change
const ULT_HOLD = { burn: 900, revive: 1000, promote: 1100, gamble: 700, freeze: 1000, skip: 700, demote: 1000, steal: 900, seal: 1000, poison: 900 }

async function ultimate(att, forced = null) {
  const c = side[att].char.value, s = session, def = other(att)
  if (att !== ME || mode.value === 'watch') ultCount++
  setMood(att, 'ult', 'react'); say(att, `${c.ult.name}!!`)
  cutinChar.value = c
  cutin.value = true
  await wait(2400)
  cutin.value = false
  if (s !== session) return
  quake.value = true; setTimeout(() => { quake.value = false }, 700)
  if (c.ult.fx === 'skip') skipPending[att] = true
  if (c.ult.fx === 'sight') {
    if (att === ME && mode.value === 'duel') { const line = await findPath(); if (s !== session) return; showPath(line) }
    else { sightBoost[att] = 3; say(att, 'I can see every move you will make.') }
  }
  const changes = forced ?? planUltimate(c.ult.fx, att)
  // the board plays this ultimate's own animation (Jun's die rolls across it first)
  ultEvent.value = { fx: c.ult.boardFx ?? c.ult.fx, glow: c.glow, squares: changes.map(ch => ch.sq), roll: changes.roll, side: att, n: (ultEvent.value?.n ?? 0) + 1 }
  if (changes.roll) {
    await wait(1300)
    if (s !== session) return
    say(att, changes.roll <= 2 ? `A ${changes.roll}?! Bad luck…` : changes.roll === 6 ? 'A SIX! Jackpot!' : `A ${changes.roll}! Pay up!`)
  }
  boom.value = changes.map(ch => ch.sq)
  await wait(ULT_HOLD[c.ult.fx] ?? 800)
  if (s !== session) return
  const before = changes.map(ch => chess.value.get(ch.sq))
  for (const ch of changes) setSquare(ch.sq, ch.piece)
  // several changes that are each legal could still combine into an illegal one; undo if so
  if (!kingSafe(def)) changes.forEach((ch, i) => setSquare(ch.sq, before[i]))
  else {
    // a piece removed (burned, shattered) or taken over (Noa's strings) is lost by its owner;
    // a pawn crowned into the same side's queen is not a loss
    changes.forEach((ch, i) => {
      const was = before[i]
      if (ch.moved) return // Factory Reset: the piece just went home
      if (was && (!ch.piece || ch.piece.color !== was.color)) loseTo(was.color, was.type)
      else if (!was && ch.piece) regain(ch.piece.color, ch.piece.type) // Bloom brought it back
    })
  }
  boom.value = []
  setCharge(att, 0)
  try { chess.value.load(chess.value.fen()) } catch { /* keep position as is */ }
  // marks that last beyond this turn
  if (c.ult.fx === 'seal' && changes.length) seal.value = { color: def, squares: changes.map(ch => ch.sq), turns: 2 }
  if (c.ult.fx === 'flood' && changes.length) flood.value = { color: def, squares: changes.map(ch => ch.sq), turns: 2 }
  if (c.ult.fx === 'bond' && changes.length === 2) bond.value = { color: def, squares: changes.map(ch => ch.sq), turns: 3 }
  if (c.ult.fx === 'chain' && def === ME && changes.length) gameFlags.chainHit = true
  if (c.ult.fx === 'reset' && changes.length && def === ME && mode.value === 'duel') say(att, 'Rolling your pieces back to their default settings.')
  if (c.ult.fx === 'calc') { calc.value = { color: def, moves: null, pending: true }; if (def === ME && mode.value === 'duel') say(att, 'Calculating your best moves…') }

  // a swapped piece moved off its square, so poison on it is cured (as with a normal move)
  if (c.ult.fx === 'swap' && poison.value?.color === att) poison.value = { ...poison.value, squares: poison.value.squares.filter(q => !changes.some(ch => ch.sq === q)) }
  if (c.ult.fx === 'poison' && changes.length) poison.value = { color: def, by: att, squares: changes.map(ch => ch.sq) }
  if (changes.length && !(changes.roll <= 2)) say(att, `${c.ult.shout ?? c.ult.name + '!'}`)
  touch()
}

/** The side whose king is gone, if any. chess.js doesn't treat a missing king as game over, so we do. */
function kinglessSide() {
  if (!findKing('w')) return 'w'
  if (!findKing('b')) return 'b'
  return null
}

/** Valid targets while aiming: Smite = an enemy knight, bishop or pawn whose removal keeps the position legal; Shield = one of your pieces (not the king). */
function aimable(sq) {
  if (aim.value === 'pick') return !!pickInfo.value && (picks.value.includes(sq) || pickInfo.value.spec.ok(sq, picks.value))
  const p = chess.value.get(sq)
  if (!p || !aim.value) return false
  if (aim.value === 'smite') return p.color !== ME && SMITABLE.includes(p.type) && safeChange(sq, null, other(ME))
  if (aim.value === 'swap') {
    if (!swapFrom.value) return swappable(sq) && hasPartner(sq)
    return sq === swapFrom.value || swapOk(swapFrom.value, sq)
  }
  return p.color === ME && p.type !== 'k'
}

/* ---- Shin's Shadow Swap: two of your pieces trade places ----
   Not the king, not a piece chained by Kyo, no pawn onto the first or last rank, and neither king may end up in
   check (the position has to stay legal: it's still your move). */
const swappable = (sq, color = ME) => { const p = chess.value.get(sq); return !!p && p.color === color && p.type !== 'k' && !sealedFor(color).includes(sq) }
const backRank = sq => sq[1] === '1' || sq[1] === '8'
function swapPieces(a, b) {
  const pa = chess.value.get(a), pb = chess.value.get(b)
  setSquare(a, pb); setSquare(b, pa)
  // a shield moves with its piece; moving a piece off a poisoned square cures it, as a normal move would
  if (shield.value === a) shield.value = b; else if (shield.value === b) shield.value = a
  if (poison.value) poison.value = { ...poison.value, squares: poison.value.squares.filter(q => q !== a && q !== b) }
}
function swapOk(a, b, color = ME) {
  if (a === b || !swappable(a, color) || !swappable(b, color)) return false
  const pa = chess.value.get(a), pb = chess.value.get(b)
  if (pa.type === pb.type) return false // nothing would change
  if ((pa.type === 'p' && backRank(b)) || (pb.type === 'p' && backRank(a))) return false
  // try it on the board (pieces only: the shield and poison are left alone), then put them back
  setSquare(a, pb); setSquare(b, pa)
  const ok = kingSafe(color) && kingSafe(other(color))
  setSquare(a, pa); setSquare(b, pb)
  return ok
}
/** A rival's Shadow Swap: try every legal swap and keep the one whose two pieces then threaten the most
    (the most valuable piece either could capture next turn); ties broken at random. */
function planSwap(att) {
  const mine = chess.value.board().flat().filter(p => p && p.color === att).map(p => p.square)
  let best = null, bestScore = -1
  for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
    const a = mine[i], b = mine[j]
    if (!swapOk(a, b, att)) continue
    const pa = chess.value.get(a), pb = chess.value.get(b)
    setSquare(a, pb); setSquare(b, pa)
    let score = 0
    try {
      const parts = chess.value.fen().split(' '); parts[1] = att; parts[2] = '-'; parts[3] = '-'
      const g = new Chess(parts.join(' '))
      for (const m of g.moves({ verbose: true })) if ((m.from === a || m.from === b) && m.captured) score = Math.max(score, VAL[m.captured])
    } catch { /* not a position chess.js accepts: skip it */ score = -1 }
    setSquare(a, pa); setSquare(b, pb)
    score += Math.random() * 0.5
    if (score > bestScore) { bestScore = score; best = [a, b, pa, pb] }
  }
  if (!best) return []
  const [a, b, pa, pb] = best
  return [{ sq: a, piece: pb }, { sq: b, piece: pa }]
}
function mySquares() { return chess.value.board().flat().filter(p => p && p.color === ME).map(p => p.square) }
const hasPartner = a => mySquares().some(b => swapOk(a, b))

/* ---- Akane's Crimson Sight: the opponent's two most valuable pieces are frozen for their next turn ----
   Uses the same chains as Kyo's Iron Dominion, so it can't be used while a chain is already on the board. */
/* ---- Akane's Crimson Sight: the path to victory ----
   For you: the engine's best line from here is drawn on the board (your moves in red, their replies faded), with a
   "Checkmate in N" warning when a forced mate exists. It stays until you move.
   For a computer Akane: her next three moves are played at full strength. */
const path = ref(null)       // { moves: ['e2e4', …], mate: N | null }
const sightBoost = { w: 0, b: 0 }
async function findPath() {
  const parts = chess.value.fen().split(' '); parts[1] = ME; parts[3] = '-'
  const fen = parts.join(' ')
  let r = null
  try { r = await engineLine(fen, 10) } catch { r = null }
  const mate = r?.mate > 0 ? r.mate : null
  const want = (r?.moves ?? []).slice(0, mate ? Math.min(2 * mate - 1, 7) : 3)
  const t = new Chess(fen), moves = []
  for (const u of want) { try { t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }); moves.push(u) } catch { break } }
  return { moves, mate, squares: moves.filter((_, i) => i % 2 === 0).map(u => u.slice(2, 4)) }
}
function showPath(line) {
  path.value = line
  notify('sight', 'Crimson Sight', line.mate ? `Checkmate in ${line.mate}! Follow the red path.` : line.moves.length ? 'Your best path is marked in red.' : 'No clear path… yet.')
  touch()
}

/* ---- AI-0's Factory Reset: two of the opponent's pieces are sent back to their starting squares ----
   A piece goes home to an empty starting square of its own type (a bishop to the one of its own square colour, a pawn
   to its own file); never the king, and both kings must stay out of check. The board changes are
   [{ sq: from, piece: null, moved: true }, { sq: home, piece, moved: true }] so nothing counts as lost. */
const HOME = { r: ['a', 'h'], n: ['b', 'g'], b: ['c', 'f'], q: ['d'] }
const sqColour = sq => (FILES.indexOf(sq[0]) + +sq[1]) % 2
function homeOf(sq, color) {
  const g = chess.value, p = g.get(sq)
  if (!p || p.color !== color || p.type === 'k') return null
  const back = color === 'w' ? '1' : '8'
  const homes = p.type === 'p' ? [sq[0] + (color === 'w' ? '2' : '7')]
    : HOME[p.type].map(f => f + back).filter(h => p.type !== 'b' || sqColour(h) === sqColour(sq))
  return homes.find(h => h === sq ? false : !g.get(h) && resetOk(sq, h)) ?? null
}
function resetOk(from, to) {
  const p = chess.value.get(from)
  setSquare(from, null); setSquare(to, p)
  const ok = kingSafe('w') && kingSafe('b')
  setSquare(to, null); setSquare(from, p)
  return ok
}
// how far a piece has come from home (its rank distance), weighted by its value: the AI resets the most advanced
const progressOf = (sq, color) => Math.abs(+sq[1] - (color === 'w' ? 1 : 8)) * (VAL[chess.value.get(sq).type] + 1)
function resetChanges(squares, color) {
  const out = [], used = new Set()
  for (const sq of squares) {
    const p = chess.value.get(sq), h = homeOf(sq, color)
    if (!h || used.has(h)) continue
    used.add(h)
    out.push({ sq, piece: null, moved: true }, { sq: h, piece: p, moved: true })
  }
  return out
}
function planReset(att) {
  const def = other(att)
  const picks = squaresOf(def, p => p.type !== 'k').filter(sq => homeOf(sq, def))
    .sort((a, b) => progressOf(b, def) - progressOf(a, def)).slice(0, 2)
  return resetChanges(picks, def)
}

function sightTargets(att = ME) {
  return chess.value.board().flat().filter(p => p && p.color !== att && p.type !== 'k')
    .sort((x, y) => VAL[y.type] - VAL[x.type] || Math.random() - .5).slice(0, 2).map(p => p.square)
}

/** After an ultimate moves or removes pieces: drop castling rights whose king or rook is no longer at home. */
function fixCastling(fen) {
  const parts = fen.split(' ')
  const at = (sq, code) => { const p = chess.value.get(sq); return p && p.color + p.type === code }
  const keep = { K: at('e1', 'wk') && at('h1', 'wr'), Q: at('e1', 'wk') && at('a1', 'wr'), k: at('e8', 'bk') && at('h8', 'br'), q: at('e8', 'bk') && at('a8', 'br') }
  parts[2] = [...parts[2]].filter(c => keep[c]).join('') || '-'
  return parts.join(' ')
}

/** Can Rewind be used right now? Not if your last move gave check (you'd move again with their king in check). */
function rewindOk() {
  if (!lastAiSnap) return false
  const parts = lastAiSnap.fen.split(' '); parts[1] = ME; parts[3] = '-'
  try {
    const g = new Chess(parts.join(' '))
    let k = null
    g.board().forEach(row => row.forEach(p => { if (p && p.type === 'k' && p.color !== ME) k = p.square }))
    return !k || !g.isAttacked(k, ME)
  } catch { return false }
}

const playerReady = computed(() => tick.value >= 0 && mode.value === 'duel' && side[ME].charge.value >= 100 && !busy.value && !over.value && turn.value === ME)
function canUse(kind) {
  if (!playerReady.value) return false
  if (kind === 'smite') return chess.value.board().some(row => row.some(p => p && p.color !== ME && SMITABLE.includes(p.type) && safeChange(p.square, null, other(ME))))
  if (kind === 'rewind') return rewindOk()
  if (kind === 'rival') return you.value.kind === 'rival' && canFire(ME)
  if (you.value.kind === 'rival') return false // a rival has only their own ultimate
  if (PLAYER_ULTS[kind]?.hero && PLAYER_ULTS[kind].hero !== you.value.look) return false // not your hero's
  if (kind === 'swap') return mySquares().some(a => swappable(a) && hasPartner(a))
  if (kind === 'sight') return true
  return true
}

/** Use one of your ultimates. Smite and Shield first ask for a target on the board. */
function playerUltimate(kind) {
  if (!canUse(kind)) return
  if (kind === 'smite' || kind === 'shield' || kind === 'swap') {
    aim.value = aim.value === kind ? null : kind; swapFrom.value = null; selected.value = null; hints.value = []; touch(); return
  }
  if (kind === 'rival') return fireRival()
  if (kind === 'sight') {
    // the engine reads the board while her cut-in plays, so there's no wait
    const reading = findPath()
    return fire('sight', [], () => { reading.then(showPath) })
  }
  if (kind === 'rewind') {
    return fire('rewind', [], () => {
      const parts = lastAiSnap.fen.split(' '); parts[1] = ME; parts[3] = '-'
      chess.value.load(parts.join(' '))
      lost.value = lastAiSnap.lost
      lastAiSnap = null
      lastMove.value = null
      say('b', 'W-wait, what just happened?!')
    })
  }
}
/* Playing as a rival, YOU choose their ultimate's targets (Kyo's two chained pieces, Mio's burned piece, Noa's stolen
   piece…). Ultimates with nothing to aim (Time Skip, All In's dice, Bloom, Calculate, Crimson Sight) fire at once.
   Each spec: { n: how many to pick, what: the prompt, ok(sq, picked), build(picked) -> the board changes }. */
const picks = ref([])
const pickInfo = ref(null)
const nearSq = (a, b) => a !== b && Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) <= 1 && Math.abs(+a[1] - +b[1]) <= 1
function targetSpec(fx, att) {
  const g = chess.value, def = other(att)
  const isEnemy = (sq, types) => { const p = g.get(sq); return !!p && p.color === def && types.includes(p.type) }
  const remove = ps => ps.map(sq => ({ sq, piece: null }))
  const keep = ps => ps.map(sq => ({ sq, piece: g.get(sq) }))
  switch (fx) {
    case 'burn': {
      const minors = squaresOf(def, p => p.type === 'n' || p.type === 'b').some(sq => safeChange(sq, null, def))
      return minors ? { n: 1, what: 'a knight or bishop to burn', ok: sq => isEnemy(sq, ['n', 'b']) && safeChange(sq, null, def), build: remove }
        : { n: 2, what: 'two pawns to burn', ok: sq => isEnemy(sq, ['p']) && safeChange(sq, null, def), build: remove }
    }
    case 'freeze': return { n: 3, what: 'three pawns to shatter', ok: sq => isEnemy(sq, ['p']) && safeChange(sq, null, def), build: remove }
    case 'promote': return { n: 1, what: 'one of your pawns to crown', ok: sq => { const p = g.get(sq); return !!p && p.color === att && p.type === 'p' && safeChange(sq, { type: 'q', color: att }, def) }, build: ps => ps.map(sq => ({ sq, piece: { type: 'q', color: att } })) }
    case 'demote': {
      const from = squaresOf(def, p => p.type === 'q').length ? 'q' : 'r', to = from === 'q' ? 'r' : 'n'
      return { n: 1, what: from === 'q' ? 'a queen to demote' : 'a rook to demote', ok: sq => isEnemy(sq, [from]) && safeChange(sq, { type: to, color: def }, def), build: ps => ps.map(sq => ({ sq, piece: { type: to, color: def } })) }
    }
    case 'steal': return { n: 1, what: 'a knight or bishop to take over', ok: sq => isEnemy(sq, ['n', 'b']) && safeChange(sq, { type: g.get(sq).type, color: att }, def), build: ps => ps.map(sq => ({ sq, piece: { type: g.get(sq).type, color: att } })) }
    case 'seal': return { n: 2, what: 'two pieces to chain', ok: sq => isEnemy(sq, ['q', 'r', 'b', 'n']), build: keep }
    case 'poison': return { n: 2, what: 'two pieces to poison', ok: sq => isEnemy(sq, ['n', 'b', 'r']), build: keep }
    case 'bond': return bond.value ? null : { n: 2, what: 'two pieces to tie together', ok: sq => isEnemy(sq, ['q', 'r', 'b', 'n', 'p']), build: keep }
    case 'flood': return { n: 2, what: 'two empty squares to flood', ok: sq => !g.get(sq), build: remove }
    case 'chain': return {
      n: 1, what: 'a knight, bishop or pawn to strike', ok: sq => isEnemy(sq, ['n', 'b', 'p']) && safeChange(sq, null, def),
      build: ([first]) => {
        const before = g.get(first); setSquare(first, null)
        const second = squaresOf(def, p => ['n', 'b', 'p'].includes(p.type)).filter(sq => nearSq(first, sq) && safeChange(sq, null, def))
          .sort((a, b2) => VAL[g.get(b2).type] - VAL[g.get(a).type])[0]
        setSquare(first, before)
        return second ? remove([first, second]) : remove([first])
      },
    }
    case 'reset': return { n: 2, what: 'two enemy pieces to reset', ok: sq => !!homeOf(sq, def), build: ps => resetChanges(ps, def) }
    case 'swap': return { n: 2, what: 'two of your pieces to swap', ok: (sq, picked) => (picked.length ? swapOk(picked[0], sq, att) : swappable(sq, att) && mySquares().some(b => swapOk(sq, b, att))), build: ([a, b]) => [{ sq: a, piece: g.get(b) }, { sq: b, piece: g.get(a) }] }
    default: return null
  }
}
const allSquares = () => { const out = []; for (const f of FILES) for (let r = 1; r <= 8; r++) out.push(f + r); return out }
function pickTarget(sq) {
  const info = pickInfo.value
  if (picks.value.includes(sq)) { picks.value = picks.value.filter(q => q !== sq); touch(); return } // unpick
  if (!info.spec.ok(sq, picks.value)) return
  picks.value = [...picks.value, sq]; touch()
  if (picks.value.length >= info.n) {
    const forced = info.spec.build(picks.value)
    picks.value = []; pickInfo.value = null; aim.value = null
    fireRival(forced)
  }
}
const aimHint = computed(() => (tick.value >= 0 && pickInfo.value ? `Choose ${pickInfo.value.spec.what} (${picks.value.length}/${pickInfo.value.n})` : ''))

/** Playing as a rival: fire their ultimate from your side. Your turn continues (Time Skip: you move twice). */
async function fireRival(forced = null) {
  const s = session
  if (!forced) {
    const spec = targetSpec(side[ME].char.value.ult.fx, ME)
    if (spec) {
      const n = Math.min(spec.n, allSquares().filter(q => spec.ok(q, [])).length)
      if (n > 0) { pickInfo.value = { spec, n }; picks.value = []; aim.value = 'pick'; selected.value = null; hints.value = []; touch(); return }
    }
  }
  aim.value = null; swapFrom.value = null; selected.value = null; hints.value = []; busy.value = true; touch()
  await ultimate(ME, forced)
  useProgress().usedUlt()
  if (s !== session) return
  // Time Skip from your side: the opponent's next turn is skipped, so you get a bonus (non-capturing) move
  if (skipPending[ME]) { skipPending[ME] = false; bonusMove = true }
  busy.value = false; touch()
  checkOver()
}
const cancelAim = () => { aim.value = null; swapFrom.value = null; picks.value = []; pickInfo.value = null; selected.value = null; touch() }

/** Play your ultimate: cut-in, the effect on its target squares, then apply it. Your turn continues. */
async function fire(kind, squares, apply) {
  const s = session
  aim.value = null; swapFrom.value = null; busy.value = true; selected.value = null; hints.value = []; touch()
  useProgress().usedUlt()
  const y = you.value
  cutinChar.value = y.img
    ? { ...PLAYER, name: y.name, img: y.img, art: 'color', focus: y.focus, ult: PLAYER_ULTS[kind] }
    : { ...PLAYER, ult: PLAYER_ULTS[kind] }
  cutin.value = true
  await sleep(1800)
  cutin.value = false
  if (s !== session) return
  quake.value = true; setTimeout(() => { quake.value = false }, 600)
  const u = PLAYER_ULTS[kind]
  ultEvent.value = { fx: u.boardFx ?? kind, glow: u.glow ?? PLAYER.glow, squares, side: ME, n: (ultEvent.value?.n ?? 0) + 1 }
  boom.value = squares
  await sleep(squares.length ? 900 : 600)
  if (s !== session) return
  apply()
  try { chess.value.load(fixCastling(chess.value.fen())) } catch { /* keep position as is */ }
  boom.value = []
  setCharge(ME, 0)
  busy.value = false
  touch()
  checkOver()
}

/** Would this move of yours stalemate the opponent (a win in this game)? */
function wouldStalemate(m) {
  try {
    const t = new Chess(chess.value.fen())
    t.move({ from: m.from, to: m.to, promotion: 'q' })
    return t.isStalemate()
  } catch { return false }
}

/* This game's rules for the end: checkmate wins, and so does STALEMATE (the stalemated side loses).
   Repetition and the 50-move rule don't end the game here; only too few pieces to mate is a draw. */
const ended = () => {
  const g = chess.value
  if (g.isCheckmate() || g.isStalemate() || g.isInsufficientMaterial()) return true
  // Spectate: two computers could shuffle forever, so there repetition and the 50-move rule still draw
  return mode.value === 'watch' && (g.isThreefoldRepetition() || g.isDrawByFiftyMoves())
}

/** Why the game was drawn, in plain words. */
function drawReason() {
  const g = chess.value
  if (g.isInsufficientMaterial()) return { name: 'Not enough pieces', text: 'Neither side has enough pieces left to checkmate.' }
  if (g.isThreefoldRepetition()) return { name: 'Repetition', text: '' }
  if (g.isDrawByFiftyMoves()) return { name: '50-move rule', text: '' }
  return { name: 'Draw', text: '' }
}

function checkOver() {
  const g = chess.value
  const kingless = kinglessSide()
  if (!kingless && !ended()) return false
  // the loser: whoever lost their king, else whoever is checkmated, or (this game's rule) stalemated
  const loser = kingless ?? (g.isCheckmate() || g.isStalemate() ? g.turn() : null)
  if (mode.value === 'watch') return finishWatch(loser)
  const c = side.b.char.value
  let title, msg, mood, result
  if (loser) {
    if (loser === ME) { title = 'You lose'; msg = mirror.value ? mirrorLine(c, 'win', c.say.win) : c.say.win; mood = 'happy'; result = 'loss' }
    else { title = 'You win!'; msg = mirror.value ? mirrorLine(c, 'lose', c.say.lose) : c.say.lose; mood = 'sad'; result = 'win' }
  } else { title = 'Draw'; msg = c.say.draw; mood = 'idle'; result = 'draw' }
  const why = kingless ? { name: 'King captured', text: '' } : g.isStalemate() ? { name: 'Stalemate', text: loser === ME ? "Your king had no legal move. In Bizarre Chess, being stalemated is a loss." : "Their king had no legal move. In Bizarre Chess, stalemating your opponent is a win." } : loser ? { name: 'Checkmate', text: '' } : drawReason()
  setMood('b', mood, 'react'); say('b', msg)
  over.value = { title, msg: `${c.name}: “${msg}”`, result, why: why.name, explain: why.text }
  busy.value = false; touch()
  if (!recorded) {
    recorded = true
    useStats().saveGame({ character_id: c.id, result, moves: moveCount, ultimates_faced: ultCount })
    endDuel(c, result, false)
  }
  return true
}
/** Remember how a duel went: your habits, achievements, and the games each character has played. */
function endDuel(c, result, resigned) {
  const p = useProgress()
  const mine = chess.value.board().flat().filter(x => x && x.color === ME)
  p.recordDuel({
    char: CHARS[c.id] ?? c, result, resigned, moves: moveCount, mirror: mirror.value, level: c.level,
    comeback: gameFlags.comeback, queenLost: lost.value[ME].includes('q') || gameFlags.queenLost, chainHit: gameFlags.chainHit,
    onlyPawns: mine.every(x => x.type === 'p' || x.type === 'k') && mine.some(x => x.type === 'p'),
    roster: ROSTER.filter(id => !CHARS[id].hero),
  })
  p.playedBy(CHARS[c.id])
  if (playAs.value.rival) p.playedBy(CHARS[playAs.value.rival])
}

/** Spectated games end with a winner announcement; nothing is saved to your stats. */
function finishWatch(loser) {
  if (loser) {
    const winner = other(loser)
    const wc = side[winner].char.value, lc = side[loser].char.value
    const same = mirror.value, winLine = same ? mirrorLine(wc, 'win', wc.say.win) : wc.say.win
    setMood(winner, 'happy', 'react'); say(winner, winLine)
    setMood(loser, 'sad', 'hurt'); say(loser, same ? mirrorLine(lc, 'lose', lc.say.lose) : lc.say.lose)
    // in a mirror match, say which copy won
    over.value = { title: `${wc.name} wins`, msg: `${wc.name}: “${winLine}”`, result: winner === 'w' ? 'white' : 'black', winner }
  } else {
    for (const c of ['w', 'b']) { setMood(c, 'idle', 'react'); say(c, side[c].char.value.say.draw) }
    over.value = { title: 'Draw', msg: 'Neither rival could break through.', result: 'draw' }
  }
  busy.value = false; touch()
  if (!recorded) { recorded = true; const p = useProgress(); p.playedBy(CHARS[side.w.char.value.id]); if (side.b.char.value.id !== side.w.char.value.id) p.playedBy(CHARS[side.b.char.value.id]) }
  return true
}

function undo() {
  if (mode.value !== 'duel' || busy.value || over.value || !undoStack.length) return
  const snap = undoStack.pop()
  chess.value.load(snap.fen)
  lost.value = snap.lost
  moveCount = Math.max(0, moveCount - 1)
  selected.value = null; hints.value = []; lastMove.value = null
  setMood('b', 'idle'); say('b', 'Taking it back? Fine.'); touch()
}

/** Resign the duel: counts as a loss, and the rival has something to say about it. */
function surrender() {
  const c = side.b.char.value
  if (mode.value !== 'duel' || over.value || !c) return
  session++ // stop the rival's turn if they were thinking
  aim.value = null; selected.value = null; hints.value = []
  setMood('b', 'happy', 'react'); say('b', c.say.surrender)
  over.value = { title: 'You surrendered', msg: `${c.name}: “${c.say.surrender}”`, result: 'loss', resigned: true }
  busy.value = false; touch()
  if (!recorded) {
    recorded = true
    useStats().saveGame({ character_id: c.id, result: 'loss', moves: moveCount, ultimates_faced: ultCount })
    endDuel(c, 'loss', true)
  }
}

/* Taking too long: while it's your move in a duel, the rival gets more and more impatient (say.slow, after 20s, 45s
   and 80s). The clock starts over with every move (yours or theirs), so a Double Move's second move gets a fresh one. */
const SLOW_AT = [20000, 45000, 80000]
let slowTimers = []
const yourMove = computed(() => tick.value >= 0 && mode.value === 'duel' && !!side.b.char.value && !busy.value && !over.value && turn.value === ME)
watch([yourMove, lastMove], ([mine]) => {
  if (mine) turnStart = Date.now()
  if (mode.value === 'duel' && behind(ME)) gameFlags.comeback = true
  slowTimers.forEach(clearTimeout); slowTimers = []
  const lines = side.b.char.value?.say.slow
  if (!mine || !lines?.length) return
  slowTimers = SLOW_AT.map((ms, i) => setTimeout(() => {
    if (!yourMove.value) return
    setMood('b', i === 0 ? 'idle' : 'angry', 'react'); say('b', lines[Math.min(i, lines.length - 1)])
  }, ms))
})

const togglePause = () => { paused.value = !paused.value; touch() }
const cycleSpeed = () => { speed.value = speed.value >= 3 ? 1 : speed.value + 1 }

export function useGame() {
  return {
    mode, over, cutin, cutinChar, quake, squares, status, busy, paused, speed, turn, lastMove, ultEvent, lost,
    // the opponent (Black) — what the duel screen uses
    char: side.b.char, charge: side.b.charge, bubble: side.b.bubble, face: side.b.face,
    // White's character in spectate mode
    white: side.w,
    statusOf,
    canUndo: computed(() => tick.value >= 0 && mode.value === 'duel' && !busy.value && !over.value && undoStack.length > 0),
    start, startWatch, leave, select, undo, surrender, togglePause, cycleSpeed,
    // your ultimates
    playerSet, you, mirror, hold, release,
    aimHint, pathMoves: computed(() => (tick.value >= 0 && path.value ? path.value.moves : [])),
    calcMoves: computed(() => tick.value >= 0 && calc.value && !calc.value.pending ? calc.value.moves : []),
    playerCharge: side[ME].charge, playerReady, noCapture, aim, swapFrom, shield, canUse, playerUltimate, cancelAim,
    comeback: computed(() => tick.value >= 0 && behind(ME)),
  }
}

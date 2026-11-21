import { ref, shallowRef, computed } from 'vue'
import { Chess } from 'chess.js'
import { CHARS } from '../data/characters'
import { initEngine, engineMove } from '../lib/engine'
import { useStats } from './useStats'

/* Two modes:
   - 'duel':  you play White, a character plays Black.
   - 'watch': a character plays each side (computer vs computer) and you spectate.
   Every per-side value (character, meter, mood, speech bubble) is kept per colour. */

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const FILES = 'abcdefgh'
const ME = 'w' // the human's colour in a duel
const other = c => (c === 'w' ? 'b' : 'w')
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
let skipPending = { w: false, b: false }

/* ---- your ultimates (duel only) ----
   Your meter fills the same way the characters' do. When it's full you pick one; using it
   doesn't end your turn. Smite and Shield need a target, picked by clicking the board. */
const PLAYER = { id: 'you', name: 'You', glow: '#f4f2fb', img: null, emoji: { ult: '♛' } }
export const PLAYER_ULTS = {
  smite: { name: 'Smite', text: 'Remove one enemy pawn of your choice.' },
  shield: { name: 'Shield', text: "One of your pieces can't be captured on the opponent's next turn." },
  rewind: { name: 'Rewind', text: "Undo the opponent's last move. You move again." },
  double: { name: 'Double Move', text: 'Make two moves in a row.' },
}
const aim = ref(null)      // 'smite' | 'shield' while you're choosing a target
const shield = ref(null)   // square of your shielded piece, until the opponent's turn ends
let bonusMove = false      // Double Move: skip the opponent's next turn
let lastAiSnap = null      // position + losses just before the opponent's last move (for Rewind)
let moveCount = 0
let ultCount = 0
let session = 0
let recorded = false

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
      hint: !!hint, capture: !!hint?.captured, check: kingSq === name, boom: boom.value.includes(name),
      mood: mood[name] ?? 'idle',
      aimable: !!aim.value && aimable(name),
      shielded: shield.value === name,
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
const say = (color, t) => { side[color].bubble.value = t }
const setCharge = (color, v) => { side[color].charge.value = Math.max(0, Math.min(100, v)) }
const worth = list => list.reduce((sum, t) => sum + (VAL[t] ?? 0), 0)
/** Comeback: a side 5+ points of material behind fills its meter 1.5x faster. */
const behind = color => worth(lost.value[color]) - worth(lost.value[other(color)]) >= 5
const gain = (color, v) => setCharge(color, side[color].charge.value + v * (behind(color) ? 1.5 : 1))

function reset() {
  session++
  initEngine()
  chess.value = new Chess()
  selected.value = null; hints.value = []; lastMove.value = null
  busy.value = false; over.value = null; boom.value = []; cutin.value = false; paused.value = false
  undoStack = []; skipPending = { w: false, b: false }; moveCount = 0; ultCount = 0; recorded = false
  lost.value = { w: [], b: [] }
  aim.value = null; shield.value = null; bonusMove = false; lastAiSnap = null
  for (const c of ['w', 'b']) { side[c].char.value = null; setCharge(c, 0); say(c, ''); setMood(c, 'idle') }
}

/** You (White) vs a character (Black). */
function start(id) {
  reset()
  mode.value = 'duel'
  side.b.char.value = CHARS[id]
  document.documentElement.style.setProperty('--c', CHARS[id].glow)
  say('b', greeting(CHARS[id])); touch()
}

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
  side.w.char.value = CHARS[whiteId]
  side.b.char.value = CHARS[blackId]
  document.documentElement.style.setProperty('--c', CHARS[blackId].glow)
  document.documentElement.style.setProperty('--cw', CHARS[whiteId].glow)
  say('w', CHARS[whiteId].say.start); say('b', CHARS[blackId].say.start); touch()
  watchLoop(session)
}

function leave() { session++; busy.value = false; paused.value = false; side.w.char.value = null; side.b.char.value = null }

function select(sq) {
  if (mode.value !== 'duel' || busy.value || over.value || chess.value.turn() !== ME) return
  if (aim.value) {
    if (!aimable(sq)) return
    const kind = aim.value
    if (kind === 'smite') fire('smite', [sq], () => { setSquare(sq, null); loseTo(other(ME), 'p') })
    else fire('shield', [sq], () => { shield.value = sq })
    return
  }
  const h = hints.value.find(m => m.to === sq)
  if (selected.value && h) return playerMove(h)
  const p = chess.value.get(sq)
  if (p && p.color === ME) { selected.value = sq; hints.value = chess.value.moves({ square: sq, verbose: true }) }
  else { selected.value = null; hints.value = [] }
}

/** Both characters react to a move: the mover gloats, the other side winces. */
function react(mv, mover) {
  const g = chess.value
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
    } else if (mv.captured) {
      setMood(color, VAL[mv.captured] >= 5 ? 'shock' : 'angry', 'hurt'); say(color, pick(c.say.lost))
    } else if (g.inCheck()) { setMood(color, 'shock', 'hurt'); say(color, pick(c.say.inCheck)) }
    else { setMood(color, 'idle'); say(color, pick(c.say.think)) }
  }
}

async function playerMove(m) {
  undoStack.push({ fen: chess.value.fen(), lost: lost.value })
  const mv = chess.value.move({ from: m.from, to: m.to, promotion: 'q' })
  if (mv.captured) loseTo(other(mv.color), mv.captured)
  if (shield.value === mv.from) shield.value = mv.to // the shield moves with its piece
  moveCount++
  lastMove.value = mv; selected.value = null; hints.value = []
  react(mv, ME); touch()
  if (checkOver()) return
  if (bonusMove) {
    bonusMove = false
    // a second move is only fair if the first didn't give check (otherwise the king could simply be taken)
    if (kingSafe(other(ME))) {
      const parts = chess.value.fen().split(' '); parts[1] = ME; parts[3] = '-'
      try { chess.value.load(parts.join(' ')); say('b', "Two moves?! That's not fair!"); touch(); return } catch { /* fall through */ }
    }
  }
  await aiTurn(other(ME))
}

/** The character playing `color` makes one engine move. `flip` forces it to be their turn (Time Skip). */
async function aiMove(color, flip = false) {
  const s = session, c = side[color].char.value
  let fen = chess.value.fen()
  if (flip && chess.value.turn() !== color) {
    const parts = fen.split(' '); parts[1] = color; parts[3] = '-'
    try { chess.value.load(parts.join(' ')); fen = chess.value.fen() } catch { return }
  }
  // never capture a king: that can only be offered in a position chess doesn't allow (see Time Skip below)
  let moves = chess.value.moves({ verbose: true }).filter(x => x.captured !== 'k')
  // your Shield: the shielded piece can't be captured (unless that's the only legal move)
  const guarded = shield.value && color !== ME ? moves.filter(x => !(x.to === shield.value && x.captured)) : moves
  const limited = guarded.length && guarded.length < moves.length
  if (limited) moves = guarded
  const uci = await engineMove(fen, c, limited ? moves.map(x => x.from + x.to + (x.promotion || '')) : null)
  if (s !== session) return
  if (!moves.length) return
  const m = (uci && moves.find(x => x.from + x.to + (x.promotion || '') === uci)) || pick(moves)
  await wait(450)
  if (s !== session) return
  if (mode.value === 'duel' && color !== ME) lastAiSnap = { fen: chess.value.fen(), lost: lost.value }
  const mv = chess.value.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' })
  if (mv.captured) loseTo(other(mv.color), mv.captured)
  if (mode.value === 'watch') moveCount++ // in a duel, saved stats count only your moves
  lastMove.value = mv; react(mv, color); touch()
}

/** One full turn for the character playing `color`: ultimate if charged, a move, and a bonus move after Time Skip. */
async function aiTurn(color) {
  const s = session
  busy.value = true; touch()
  if (side[color].charge.value >= 100 && !chess.value.isGameOver()) await ultimate(color)
  if (s !== session) return
  if (!chess.value.isGameOver()) await aiMove(color)
  if (s !== session) return
  if (!checkOver() && skipPending[color]) {
    skipPending[color] = false
    const victim = side[other(color)].char.value
    if (!kingSafe(other(color))) {
      // The first move gave check. A bonus move now would let the king simply be taken (an illegal
      // position), so time resumes instead and the victim gets to answer the check.
      say(color, 'Time resumes… for now.')
    } else {
      say(color, victim ? `Time is frozen. ${victim.name}'s turn is skipped!` : 'Time is frozen. Your turn is skipped!')
      await wait(700)
      if (s !== session) return
      await aiMove(color, true)
      if (s !== session) return
      checkOver()
    }
  }
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
    return squaresOf(def, p => ['n', 'b', 'r', 'p'].includes(p.type)).filter(sq => safeChange(sq, null, def)).slice(0, 1).map(sq => ({ sq, piece: null }))
  }
  if (fx === 'freeze') {
    return squaresOf(def, p => p.type === 'p').filter(sq => safeChange(sq, null, def)).slice(0, 2).map(sq => ({ sq, piece: null }))
  }
  if (fx === 'promote') {
    // crown the attacker's most advanced pawn
    const queen = { type: 'q', color: att }
    const pawns = squaresOf(att, p => p.type === 'p').sort((a, b) => (att === 'b' ? +a[1] - +b[1] : +b[1] - +a[1]))
    return pawns.filter(sq => safeChange(sq, queen, def)).slice(0, 1).map(sq => ({ sq, piece: queen }))
  }
  if (fx === 'steal') {
    // turn one of the defender's knights or bishops into the attacker's
    return squaresOf(def, p => p.type === 'n' || p.type === 'b')
      .map(sq => ({ sq, piece: { type: g.get(sq).type, color: att } }))
      .filter(ch => safeChange(ch.sq, ch.piece, def)).slice(0, 1)
  }
  return []
}

async function ultimate(att) {
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
  const changes = planUltimate(c.ult.fx, att)
  ultEvent.value = { fx: c.ult.fx, glow: c.glow, squares: changes.map(ch => ch.sq), n: (ultEvent.value?.n ?? 0) + 1 }
  boom.value = changes.map(ch => ch.sq)
  await wait(700)
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
      if (was && (!ch.piece || ch.piece.color !== was.color)) loseTo(was.color, was.type)
    })
  }
  boom.value = []
  setCharge(att, 0)
  try { chess.value.load(chess.value.fen()) } catch { /* keep position as is */ }
  if (changes.length) say(att, `${c.ult.shout ?? c.ult.name + '!'}`)
  touch()
}

/** The side whose king is gone, if any. chess.js doesn't treat a missing king as game over, so we do. */
function kinglessSide() {
  if (!findKing('w')) return 'w'
  if (!findKing('b')) return 'b'
  return null
}

/** Valid targets while aiming: Smite = an enemy pawn whose removal keeps the position legal; Shield = one of your pieces (not the king). */
function aimable(sq) {
  const p = chess.value.get(sq)
  if (!p || !aim.value) return false
  if (aim.value === 'smite') return p.color !== ME && p.type === 'p' && safeChange(sq, null, other(ME))
  return p.color === ME && p.type !== 'k'
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
  if (kind === 'smite') return chess.value.board().some(row => row.some(p => p && p.color !== ME && p.type === 'p' && safeChange(p.square, null, other(ME))))
  if (kind === 'rewind') return rewindOk()
  return true
}

/** Use one of your ultimates. Smite and Shield first ask for a target on the board. */
function playerUltimate(kind) {
  if (!canUse(kind)) return
  if (kind === 'smite' || kind === 'shield') { aim.value = aim.value === kind ? null : kind; selected.value = null; hints.value = []; touch(); return }
  if (kind === 'double') return fire('double', [], () => { bonusMove = true })
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
const cancelAim = () => { aim.value = null; touch() }

/** Play your ultimate: cut-in, the effect on its target squares, then apply it. Your turn continues. */
async function fire(kind, squares, apply) {
  const s = session
  aim.value = null; busy.value = true; selected.value = null; hints.value = []; touch()
  cutinChar.value = { ...PLAYER, ult: PLAYER_ULTS[kind] }
  cutin.value = true
  await sleep(1800)
  cutin.value = false
  if (s !== session) return
  quake.value = true; setTimeout(() => { quake.value = false }, 600)
  ultEvent.value = { fx: kind, glow: PLAYER.glow, squares, n: (ultEvent.value?.n ?? 0) + 1 }
  boom.value = squares
  await sleep(squares.length ? 650 : 350)
  if (s !== session) return
  apply()
  try { chess.value.load(chess.value.fen()) } catch { /* keep position as is */ }
  boom.value = []
  setCharge(ME, 0)
  busy.value = false
  touch()
  checkOver()
}

function checkOver() {
  const g = chess.value
  const kingless = kinglessSide()
  if (!kingless && !g.isGameOver()) return false
  // the loser: whoever lost their king, else whoever is checkmated
  const loser = kingless ?? (g.isCheckmate() ? g.turn() : null)
  if (mode.value === 'watch') return finishWatch(loser)
  const c = side.b.char.value
  let title, msg, mood, result
  if (loser) {
    if (loser === ME) { title = 'You lose'; msg = c.say.win; mood = 'happy'; result = 'loss' }
    else { title = 'You win!'; msg = c.say.lose; mood = 'sad'; result = 'win' }
  } else { title = 'Draw'; msg = c.say.draw; mood = 'idle'; result = 'draw' }
  setMood('b', mood, 'react'); say('b', msg)
  over.value = { title, msg: `${c.name}: “${msg}”`, result }
  busy.value = false; touch()
  if (!recorded) {
    recorded = true
    useStats().saveGame({ character_id: c.id, result, moves: moveCount, ultimates_faced: ultCount })
  }
  return true
}

/** Spectated games end with a winner announcement; nothing is saved to your stats. */
function finishWatch(loser) {
  if (loser) {
    const winner = other(loser)
    const wc = side[winner].char.value, lc = side[loser].char.value
    setMood(winner, 'happy', 'react'); say(winner, wc.say.win)
    setMood(loser, 'sad', 'hurt'); say(loser, lc.say.lose)
    over.value = { title: `${wc.name} wins`, msg: `${wc.name}: “${wc.say.win}”`, result: winner === 'w' ? 'white' : 'black', winner }
  } else {
    for (const c of ['w', 'b']) { setMood(c, 'idle', 'react'); say(c, side[c].char.value.say.draw) }
    over.value = { title: 'Draw', msg: 'Neither rival could break through.', result: 'draw' }
  }
  busy.value = false; touch()
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
    start, startWatch, leave, select, undo, togglePause, cycleSpeed,
    // your ultimates
    playerCharge: side[ME].charge, playerReady, aim, shield, canUse, playerUltimate, cancelAim,
    comeback: computed(() => tick.value >= 0 && behind(ME)),
  }
}

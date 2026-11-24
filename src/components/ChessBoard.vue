<script setup>
/* 2D board with animation:
   - a new `lastMove` slides the piece across (knights hop) and shatters any captured piece
   - `ultEvent` ({ fx, glow, squares }) plays the ultimate's effect; pieces it then removes or changes
     get that ultimate's style (burn, freeze, crown, puppet strings, time stop)
   - each square's `mood` (from useGame) drives the piece's body language and aura, and short spoken captions */
import { ref, computed, watch, onUnmounted } from 'vue'
import PieceArt from './PieceArt.vue'
import { lineFor, hoverLineFor } from '../data/pieceLines'
import * as sound from '../lib/sound'

const props = defineProps({
  squares: Array,
  interactive: { type: Boolean, default: true },
  lastMove: Object,
  ultEvent: Object,
  calcMoves: { type: Array, default: () => [] },
  pathMoves: { type: Array, default: () => [] }, // Akane's Crimson Sight: your best line (UCI), yours in red, theirs faded // AI-0's Calculate: forbidden moves (UCI), drawn as numbered arrows
  sets: { type: Object, default: () => ({}) }, // { w, b }: exclusive piece set per side (e.g. 'ice'), or none
  trails: { type: Object, default: () => ({}) }, // { w, b }: mark left where that side's pieces land ('ice'), or none
  motions: { type: Object, default: () => ({}) }, // { w, b }: 'puppet' = pieces sway, are carried by strings, yank captures away
  quiet: { type: Boolean, default: false }, // a demo board: no sounds, no spoken captions
  owners: { type: Object, default: () => ({}) },
  alter: { type: String, default: null }, // a mirror match: the colour of the Alter, whose effects are shown in black-and-white negative // { w, b }: whose pieces these are ('you' or a character id), for their voice
})
// sounds go through here, so a quiet board stays silent
const sfx = new Proxy(sound, { get: (t, k) => (...a) => { if (!props.quiet) return t[k](...a) } })
// `captured`: a piece was taken on a move ({ type, color, set, rect, delay, yours }), so the game screen can fly it to its tray
// `lost`: one of YOUR pieces was just taken ({ type, tier }), so the game screen can play the dread around the board
const emit = defineEmits(['select', 'captured', 'lost'])

const FILES = 'abcdefgh'
const fileOf = sq => FILES.indexOf(sq[0])
const rankOf = sq => +sq[1]
const rand = (a, b) => a + Math.random() * (b - a)

const arrivals = ref({})  // square -> { fx, fy, hop, n }: piece slides in from another square
const morphs = ref({})    // square -> { kind: 'crown' | 'puppet', n }: piece changed in place
const pokes = ref({})     // square -> { kind: 'own' | 'enemy', n }: piece reacting to the pointer
const frost = ref({})     // square -> { born, n }: frozen squares left by an ice trail
const FROST_LIFE = 6      // plies before a frozen square has fully melted
let ply = 0
const fx = ref([])        // transient effects drawn over the board
const timeStop = ref(false)
const bubbles = ref([])   // spoken captions over pieces
let prevMood = new Map()  // square -> 'mood|code', to notice mood changes
const lastSpoke = new Map()
let seq = 0
let prev = new Map()      // square -> 'wp', 'bq', …
let lastSeen
let recent = null         // last ultimate, used to style the pieces it removes/changes
/** How slowly pieces travel: 1 = original speed, higher = slower, so each move can be watched and enjoyed. */
const PACE = 1.7
const paced = ms => Math.round(ms * PACE)
const timers = new Set()
const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }
onUnmounted(() => timers.forEach(clearTimeout))

/** CSS colour of the side that made a move (White is you in a duel, a character in spectate). */
/* ---- capture impact ----
   Every capture on a move lands with weight, scaled by what was taken:
   pawn: a light tap · knight/bishop: a flash and a small shake · rook: plus a shockwave ring
   queen: plus slow motion, a bigger shake and a burst of light across the board.
   Hit-stop: the whole board freezes for a split second as it lands, then carries on.
   When it's YOUR piece being taken (a duel), it lands with dread instead: a red flash, and for bigger losses a shake,
   the board draining of colour, a freeze and (a queen) slow motion; the game screen adds a red vignette and a banner. */
const boardEl = ref(null)
const IMPACT = {
  p: { tier: 1, stop: 45, shake: 0 },
  n: { tier: 2, stop: 80, shake: 3 }, b: { tier: 2, stop: 80, shake: 3 },
  r: { tier: 3, stop: 110, shake: 5 },
  q: { tier: 4, stop: 170, shake: 9, slow: 520 },
  k: { tier: 4, stop: 170, shake: 9, slow: 520 },
}
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
/** Freeze (rate 0) or slow down every animation running on the board for `ms`, then let them carry on. */
function timeScale(rate, ms) {
  const el = boardEl.value
  if (!el?.getAnimations) return
  const running = el.getAnimations({ subtree: true }).filter(a => a.playState === 'running')
  for (const a of running) { try { rate === 0 ? a.pause() : a.updatePlaybackRate(rate) } catch { /* ignore */ } }
  later(ms, () => { for (const a of running) { try { rate === 0 ? (a.playState === 'paused' && a.play()) : a.updatePlaybackRate(1) } catch { /* ignore */ } } })
}
function shakeBoard(px) {
  const el = boardEl.value
  if (!el?.animate || !px) return
  el.animate([
    { transform: 'none' }, { transform: `translate(${px}px, ${-px * 0.6}px)` }, { transform: `translate(${-px * 0.8}px, ${px * 0.5}px)` },
    { transform: `translate(${px * 0.5}px, ${px * 0.3}px)` }, { transform: `translate(${-px * 0.3}px, ${-px * 0.2}px)` }, { transform: 'none' },
  ], { duration: 260 + px * 18, easing: 'ease-out' })
}
function yourLoss(sq, type, m) {
  addFx({ kind: 'hit', tier: 'loss' + m.tier, glow: '#ff2a4f', pos: at(sq) }, 900)
  emit('lost', { type, tier: m.tier })
  sfx.loss(m.tier)
  if (reduceMotion) return
  const el = boardEl.value
  if (m.tier >= 3) {
    timeScale(0, m.stop)
    // the board drains of colour for a moment
    el?.animate?.([{ filter: 'none' }, { filter: 'grayscale(.85) brightness(.6) contrast(1.1)', offset: 0.25 }, { filter: 'grayscale(.5) brightness(.8)', offset: 0.7 }, { filter: 'none' }],
      { duration: m.tier >= 4 ? 1600 : 900, easing: 'ease-out' })
  }
  later(m.tier >= 3 ? m.stop : 0, () => {
    if (m.tier >= 2) shakeBoard(Math.round(m.shake * 0.8))
    if (m.slow) timeScale(0.3, 800)
  })
}
function impact(sq, victim, type, glow, delay, by = null) {
  const m = IMPACT[type] ?? IMPACT.p
  const yours = props.interactive && victim === 'w'
  // fly the taken piece to its tray, once its death effect has mostly played
  const r = boardEl.value?.getBoundingClientRect()
  if (r) {
    const size = r.width / 8
    emit('captured', {
      type, color: victim, set: props.sets?.[victim] ?? null, yours, delay: delay + (yours ? 320 : 480), by,
      rect: { left: r.left + fileOf(sq) * size, top: r.top + (8 - rankOf(sq)) * size, size },
    })
  }
  later(delay, () => {
    if (yours) { yourLoss(sq, type, m); return }
    if (!reduceMotion) timeScale(0, m.stop)
    addFx({ kind: 'hit', tier: m.tier, glow, pos: at(sq) }, 900)
    if (m.tier >= 4) addFx({ kind: 'burst', glow, pos: at(sq) }, 1100)
    later(m.stop, () => {
      if (reduceMotion) return
      shakeBoard(m.shake)
      if (m.slow) timeScale(0.35, m.slow)
    })
  })
}

const glowOf = color => (color === 'b' ? 'var(--c)' : props.interactive ? '#f4f2fb' : 'var(--cw, #f4f2fb)')

// Tenunan's thread, and Calculate's arrows (board % units, square centres)
const centre = sq => ({ x: (fileOf(sq) + 0.5) * 12.5, y: (8 - rankOf(sq) + 0.5) * 12.5 })
const bondLine = computed(() => { const b = props.squares.filter(s => s.bonded).map(s => centre(s.name)); return b.length === 2 ? b : null })
const pathArrows = computed(() => props.pathMoves.map((u, i) => {
  const a = centre(u.slice(0, 2)), b = centre(u.slice(2, 4))
  return { mine: i % 2 === 0, x: a.x, y: a.y, tx: b.x, ty: b.y, len: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) }
}))
const calcArrows = computed(() => props.calcMoves.map(u => {
  const a = centre(u.slice(0, 2)), b = centre(u.slice(2, 4))
  return { x: a.x, y: a.y, tx: b.x, ty: b.y, len: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) }
}))

// which side made the effects being added right now (the mover, or whoever fired the ultimate)
let fxSide = null
/* Move effects scale with how far the piece moved, so a 1-square step doesn't get a board-crossing blast:
   1 square ≈ 60% size, 2 squares ≈ 80%, 3+ full. Path effects (streaks) only get thinner, never shorter.
   Captured pieces and ultimates are never scaled. */
let moveMag = 1
const magFor = (from, to) => { const d = Math.max(Math.abs(fileOf(from) - fileOf(to)), Math.abs(rankOf(from) - rankOf(to))); return d >= 3 ? 1 : d === 2 ? 0.8 : 0.6 }
function addFx(e, life) {
  const id = ++seq
  // a dying piece stays in the normal layer (its piece art already shows whose it is); its capture effect follows the attacker
  const tag = e.ghost ? { by: null, atk: e.side === 'w' ? 'b' : 'w' } : { by: e.by ?? fxSide }
  if (moveMag < 1 && !e.ghost && e.pos) e = { ...e, pos: { ...e.pos, scale: e.kind === 'streak' ? `1 ${moveMag}` : `${moveMag}` } }
  fx.value = [...fx.value, { id, ...e, ...tag }]
  later(life, () => { fx.value = fx.value.filter(f => f.id !== id) })
}
const at = sq => ({ left: fileOf(sq) * 12.5 + '%', top: (8 - rankOf(sq)) * 12.5 + '%' })
// a position between squares (file 0–7, rank 1–8, fractions allowed)
const atFR = (f, r) => ({ left: f * 12.5 + '%', top: (8 - r) * 12.5 + '%' })
const particles = (n, make) => Array.from({ length: n }, (_, i) => make(i))

/* ---- spoken captions (script) ---- */
// which moods get to speak first when several change at once
const PRIORITY = { panic: 0, shock: 1, dying: 1, afraid: 2, proud: 3, cheer: 3, sad: 4, smug: 5, nervous: 6, sleepy: 7 }
const MAX_BUBBLES = 2

/** Show a caption over a square. Pieces on the top rank speak below themselves; edge files lean inward. */
function say(sq, text, side, mood, hover = false) {
  if (!text || props.quiet) return
  const id = ++seq
  const file = fileOf(sq)
  const bubble = { id, text, side, mood, hover, pos: at(sq), below: rankOf(sq) === 8, align: file === 0 ? 'l' : file === 7 ? 'r' : 'c' }
  bubbles.value = [...bubbles.value.filter(b => (b.pos.left !== bubble.pos.left || b.pos.top !== bubble.pos.top) && !(hover && b.hover)), bubble].slice(-(MAX_BUBBLES + 1))
  lastSpoke.set(sq, Date.now())
  later(mood === 'panic' || mood === 'cheer' ? 2700 : 2300, () => { bubbles.value = bubbles.value.filter(b => b.id !== id) })
}

/** After each update, let a couple of pieces whose mood just changed say something. */
function chatter(squares) {
  const t = Date.now()
  const speakers = []
  const next = new Map()
  for (const s of squares) {
    if (!s.piece) continue
    const code = s.piece.color + s.piece.type
    next.set(s.name, s.mood + '|' + code)
    if (!s.mood || s.mood === 'idle' || prevMood.get(s.name) === s.mood + '|' + code) continue
    if (t - (lastSpoke.get(s.name) ?? 0) < 3500) continue
    if (s.mood === 'sleepy' && Math.random() > 0.25) continue // sleepy pieces only mumble now and then
    if (s.mood === 'nervous' && Math.random() > 0.5) continue
    speakers.push(s)
  }
  prevMood = next
  speakers.sort(() => Math.random() - 0.5).sort((a, b) => PRIORITY[a.mood] - PRIORITY[b.mood])
  const room = Math.max(0, MAX_BUBBLES - bubbles.value.length)
  // urgent moods (panic, shock) always get a line, even when the board is busy
  const count = Math.max(room, speakers[0] && PRIORITY[speakers[0].mood] <= 1 ? 1 : 0)
  for (const s of speakers.slice(0, count)) say(s.name, lineFor(s.mood, s.piece.type, props.owners[s.piece.color]), s.piece.color, s.mood)
}

/** Mark a square's piece as animating; the mark clears itself so hover/selection lifts work again afterwards. */
function mark(store, sq, value, life) {
  const n = ++seq
  store.value = { ...store.value, [sq]: { ...value, n } }
  later(life, () => { if (store.value[sq]?.n === n) { const { [sq]: _, ...rest } = store.value; store.value = rest } })
}
// `style` names a character's own move ('grow', 'glide', 'flip'), drawn instead of the plain slide or hop
function arrive(from, to, hop, lift = false, dash = false, skip = false, style = null) {
  mark(arrivals, to, { fx: fileOf(from) - fileOf(to), fy: rankOf(to) - rankOf(from), hop: hop && !dash && !skip && !style, lift, dash, skip, style }, paced(1000))
}
const OWN_MOVES = ['grow', 'glide', 'flip', 'ooze', 'drag', 'mist', 'rain', 'weave', 'glitch', 'bolt', 'blink', 'snow']
const morph = (sq, kind) => mark(morphs, sq, { kind }, 1500)

/** A piece leaving the board, drawn as a "ghost" that plays its death animation. */
function ghost(sq, code, kind, glow, delay = 0) {
  const base = { kind, ghost: true, type: code[1], side: code[0], glow, delay, pos: at(sq) }
  if (kind === 'poof') {
    // a playful capture: the piece flares pink and goes up in a puff of pink fire and embers
    addFx({ ...base, bits: particles(16, () => ({ dx: rand(-60, 60), dy: rand(-110, -30), r: 0, s: rand(0.6, 1.2) })) }, 1000 + delay)
  } else if (kind === 'knockout') {
    // a charging capture: a gold impact flash, then the piece is sent flying off the board, spinning
    addFx({ ...base, dir: Math.random() < 0.5 ? -1 : 1 }, 1000 + delay)
  } else if (kind === 'sand') {
    // time's capture: the piece ages and crumbles into falling red sand
    addFx({ ...base, bits: particles(22, i => ({ dx: rand(-26, 26), d: 150 + i * 32, s: rand(0.5, 1.1) })) }, 1900)
  } else if (kind === 'yank') {
    // a puppeteer's capture: strings hook the piece and jerk it up off the board
    addFx({ kind: 'strings', glow, hook: true, pos: at(sq) }, 1300)
    addFx(base, 1000 + delay)
  } else if (kind === 'capture') {
    addFx({ ...base, bits: particles(12, () => ({ dx: rand(-140, 140), dy: rand(-160, 40), r: rand(-360, 360), s: rand(0.5, 1.1) })) }, 1100 + delay)
  } else if (kind === 'crush') {
    // Kyo's capture: chains wrap the piece, squeeze, and it bursts into iron shards
    addFx({ ...base, bits: particles(14, () => ({ dx: rand(-120, 120), dy: rand(-130, 40), r: rand(-300, 300), s: rand(0.5, 1.1) })) }, 1300)
  } else if (kind === 'vanish') {
    // Shin & Akane's capture: the piece blurs, swells and drifts apart into wisps of mist
    addFx({ ...base, bits: particles(10, i => ({ dx: rand(-50, 50), dy: rand(-70, -20), d: 120 + i * 45, s: rand(0.7, 1.4) })) }, 1500)
  } else if (kind === 'dissolve') {
    // Shion's poison: the piece turns sickly green, sags, and dissolves into bubbling venom
    addFx({ ...base, bits: particles(12, i => ({ dx: rand(-30, 30), d: 200 + i * 60, s: rand(0.6, 1.2) })) }, 1700)
  } else if (kind === 'wilt') {
    // Haru's capture: the piece droops, browns and falls apart into drifting petals
    addFx({ ...base, bits: particles(14, i => ({ dx: rand(-50, 50), dy: rand(30, 90), r: rand(-240, 240), d: 300 + i * 40, s: rand(0.6, 1.1) })) }, 1700)
  } else if (kind === 'shatter') {
    // Sena's capture: the piece turns to blue glass, cracks, and bursts into sharp shards
    addFx({ ...base, bits: particles(18, () => ({ dx: rand(-170, 170), dy: rand(-170, 60), r: rand(-400, 400), s: rand(0.5, 1.3) })) }, 1300)
  } else if (kind === 'cardflip') {
    // Jun's capture: the piece flips over like a card and spins away, with a puff of cards
    addFx({ ...base, dir: Math.random() < 0.5 ? -1 : 1, bits: particles(6, () => ({ dx: rand(-90, 90), dy: rand(-110, -20), r: rand(-200, 200), s: rand(0.7, 1.1) })) }, 1200)
  } else if (kind === 'drip' || kind === 'slash' || kind === 'delete' || kind === 'zapped' || kind === 'seen') {
    // Erika: melts into a raindrop · Melati: a keris flashes across it · AI-0: deleted into pixels
    addFx(base, 1300)
  } else if (kind === 'burn') {
    addFx({ ...base, bits: particles(14, i => ({ dx: rand(-30, 30), d: i * 70, s: rand(0.6, 1.3) })) }, 1700)
  } else if (kind === 'freeze') {
    addFx({ ...base, bits: particles(14, () => ({ dx: rand(-150, 150), dy: rand(-170, 30), r: rand(-300, 300), s: rand(0.5, 1.2) })) }, 1600)
  }
}

/* ---- hover reactions ----
   Resting the pointer on a piece for a moment makes it react: yours perk up, the enemy's recoil,
   and it says a line that fits its mood. Each piece has a short cooldown so sweeping the mouse stays quiet. */
const HOVER_DWELL = 220
const HOVER_COOLDOWN = 2500
let hoverTimer = null
const lastPoked = new Map()
function hoverIn(s) {
  clearTimeout(hoverTimer)
  if (!s.piece) return
  hoverTimer = setTimeout(() => {
    const t = Date.now()
    if (t - (lastPoked.get(s.name) ?? 0) < HOVER_COOLDOWN) return
    lastPoked.set(s.name, t)
    const own = props.interactive && s.piece.color === 'w'
    mark(pokes, s.name, { kind: own ? 'own' : 'enemy' }, 600)
    say(s.name, hoverLineFor(s.mood, s.piece.type, own, props.owners[s.piece.color]), s.piece.color, s.mood === 'panic' ? 'panic' : 'hover', true)
  }, HOVER_DWELL)
}
function hoverOut() { clearTimeout(hoverTimer) }
onUnmounted(() => clearTimeout(hoverTimer))

/* ---- time (Ren) ----
   A time-bending move leaves fading crimson afterimages along its path,
   and a clock ring with a sweeping second hand appears where the piece lands. */
function timeTrail(lm) {
  const f0 = fileOf(lm.from), r0 = rankOf(lm.from), f1 = fileOf(lm.to), r1 = rankOf(lm.to)
  const steps = 4
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    addFx({ kind: 'echo', type: lm.piece, side: lm.color, pos: atFR(f0 + (f1 - f0) * t, r0 + (r1 - r0) * t), delay: i * 55 }, 900)
  }
  addFx({ kind: 'clock', pos: at(lm.to) }, 1200)
}

/* ---- ice trail ----
   Squares where an ice-trail character's pieces land freeze over, with a burst of shards,
   then slowly melt over the next few moves. Purely visual. */
function leaveTrail(sq, kind) {
  frost.value = { ...frost.value, [sq]: { born: ply, n: ++seq, kind, by: fxSide } }
  if (kind === 'venom') {
    addFx({ kind: 'petals', tone: 'venom', pos: at(sq), bits: particles(9, () => ({ dx: rand(-45, 45), dy: rand(-50, 0), r: 0, s: rand(0.6, 1.1) })) }, 1000)
  } else if (kind === 'bloom') {
    // a soft landing: petals and leaves puff out around the piece
    addFx({ kind: 'petals', pos: at(sq), bits: particles(10, () => ({ dx: rand(-55, 55), dy: rand(-60, 10), r: rand(-180, 180), s: rand(0.6, 1) })) }, 1100)
  } else if (kind === 'crack') {
    // a heavy landing: a shockwave and a spray of sparks
    addFx({ kind: 'impact', pos: at(sq), bits: particles(12, () => ({ dx: rand(-70, 70), dy: rand(-80, -10), s: rand(0.5, 1) })) }, 900)
  } else {
    if (kind === 'ice') addFx({ kind: 'icesplash', pos: at(sq) }, 800)
    if (kind === 'scorch') return
    if (kind === 'rainpool') { addFx({ kind: 'ripple', pos: at(sq) }, 900); return }
    addFx({ kind: 'frost', pos: at(sq), bits: particles(10, () => ({ dx: rand(-60, 60), dy: rand(-70, 10), r: rand(-200, 200), s: rand(0.5, 1) })) }, 900)
  }
}

/* ---- skip (Mio) ----
   The piece floats along a smooth low arc, leaving a soft pink afterglow that fades,
   with a few embers drifting up from it. */
const ARC = 0.24 // arc height, in squares (matches the floatArc keyframes)
function emberTrail(lm) {
  const f0 = fileOf(lm.from), r0 = rankOf(lm.from), f1 = fileOf(lm.to), r1 = rankOf(lm.to)
  const steps = 5
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    // follow the same arc the piece flies along
    const pos = atFR(f0 + (f1 - f0) * t, r0 + (r1 - r0) * t + Math.sin(Math.PI * t) * ARC)
    addFx({ kind: 'echo', tone: 'glow', type: lm.piece, side: lm.color, pos, delay: 40 + i * 70 }, 1000)
    if (i % 2) addFx({ kind: 'embers', pos, delay: 80 + i * 70, bits: particles(3, () => ({ dx: rand(-14, 14), dy: rand(-36, -14), s: rand(0.5, 0.9) })) }, 1000)
  }
}

/* ---- charge (Kaito) ----
   A charging move dashes straight to its square, leaving an amber speed streak along the path. */
function chargeStreak(lm) {
  const f0 = fileOf(lm.from), r0 = rankOf(lm.from), f1 = fileOf(lm.to), r1 = rankOf(lm.to)
  const dx = f1 - f0, dy = r0 - r1 // screen space: y grows downward
  addFx({
    kind: 'streak', tone: 'charge',
    pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' },
    len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad',
  }, 700)
}
/* ---- drag (Kyo) ----
   An iron chain lashes from the new square back to the piece and hauls it across. */
function dragChain(lm) {
  const f0 = fileOf(lm.to), r0 = rankOf(lm.to), f1 = fileOf(lm.from), r1 = rankOf(lm.from)
  const dx = f1 - f0, dy = r0 - r1
  addFx({
    kind: 'streak', tone: 'chain',
    pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' },
    len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad',
  }, 700)
}

/** A streak along a move's path (from the landing square back to where it came from). */
function pathFx(lm, tone, life) {
  const f0 = fileOf(lm.to), r0 = rankOf(lm.to), f1 = fileOf(lm.from), r1 = rankOf(lm.from)
  const dx = f1 - f0, dy = r0 - r1
  addFx({ kind: 'streak', tone, pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' }, len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad' }, life)
}

/* ---- Rai: the piece crackles square by square along its path (never skipping a square), a thin bolt jumping
   from each square to the next; a knight runs two squares, then turns for one. Its own landing effect ends it. ---- */
const STEP_MS = 110
function squarePath(from, to, knight) {
  const f0 = fileOf(from), r0 = rankOf(from), f1 = fileOf(to), r1 = rankOf(to)
  const sq = (f, r) => FILES[f] + r
  const out = [from]
  if (knight) {
    // the long leg first (two squares), then the short one
    const longFile = Math.abs(f1 - f0) === 2
    const mid = longFile ? [f1, r0] : [f0, r1]
    const legs = [[f0, r0, mid[0], mid[1]], [mid[0], mid[1], f1, r1]]
    for (const [a, b, c, d] of legs) {
      const n = Math.max(Math.abs(c - a), Math.abs(d - b))
      for (let i = 1; i <= n; i++) out.push(sq(a + Math.sign(c - a) * i, b + Math.sign(d - b) * i))
    }
    return out
  }
  const n = Math.max(Math.abs(f1 - f0), Math.abs(r1 - r0))
  for (let i = 1; i <= n; i++) out.push(sq(f0 + Math.sign(f1 - f0) * i, r0 + Math.sign(r1 - r0) * i))
  return out
}
function raiSteps(lm) {
  const t = lm.piece, path = squarePath(lm.from, lm.to, t === 'n')
  const step = paced(STEP_MS)
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const dx = fileOf(a) - fileOf(b), dy = rankOf(b) - rankOf(a)
    addFx({ kind: 'streak', tone: 'raiseg', pos: { left: (fileOf(b) + 0.5) * 12.5 + '%', top: (8 - rankOf(b) + 0.5) * 12.5 + '%' }, len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad', delay: (i - 1) * step }, (i - 1) * step + paced(380))
    if (i < path.length - 1) addFx({ kind: 'zapdot', pos: at(b), delay: i * step }, i * step + paced(320))
  }
  const steps = path.length - 1
  // the piece itself jumps square by square (a knight turns at its corner)
  const knee = t === 'n' ? path[2] : null
  arrivals.value = { ...arrivals.value, [lm.to]: { ...arrivals.value[lm.to], steps, kx: knee ? fileOf(knee) - fileOf(lm.to) : 0, ky: knee ? rankOf(lm.to) - rankOf(knee) : 0, knight: t === 'n' } }
  addFx({ kind: 'railand', piece: t, pos: at(lm.to), delay: steps * step }, steps * step + paced(t === 'q' || t === 'k' ? 1000 : 800))
}

/* ---- mist (Shin & Akane) ----
   The piece dissolves into mist, a drifting veil of it crosses the board, and the piece re-forms from it. */
// Akane's mist is crimson-tinged; Shin's (and yours) silver-lavender
const mistArt = lm => (props.owners?.[lm.color] === 'akane' ? 'akane' : 'shin')
function mistTrail(lm, glow) {
  const f0 = fileOf(lm.to), r0 = rankOf(lm.to), f1 = fileOf(lm.from), r1 = rankOf(lm.from)
  const dx = f1 - f0, dy = r0 - r1
  addFx({
    kind: 'streak', tone: 'mist ' + mistArt(lm), glow,
    pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' },
    len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad',
  }, 1000)
  addFx({ kind: 'mistpuff', glow, art: mistArt(lm), pos: at(lm.from) }, 900)
  addFx({ kind: 'mistpuff', glow, art: mistArt(lm), pos: at(lm.to), delay: 380 }, 1200)
}

/* ---- glide (Sena) ----
   The piece slides like polished glass, leaving a thin cold reflection along its path. */
function glideTrail(lm) {
  const f0 = fileOf(lm.from), r0 = rankOf(lm.from), f1 = fileOf(lm.to), r1 = rankOf(lm.to)
  const dx = f1 - f0, dy = r0 - r1
  addFx({
    kind: 'streak', tone: 'glass',
    pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' },
    len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad',
  }, 800)
}
function melt() {
  const next = {}
  for (const [sq, f] of Object.entries(frost.value)) if (ply - f.born < FROST_LIFE) next[sq] = f
  frost.value = next
}
/** 1 when freshly frozen, fading toward 0 as it melts. */
const frostLeft = sq => (frost.value[sq] ? 1 - (ply - frost.value[sq].born) / FROST_LIFE : 0)

let wasCheck = false
function checkSound(squares) {
  const inCheck = squares.some(s => s.check)
  if (inCheck && !wasCheck) sfx.check()
  wasCheck = inCheck
}

// chained squares (Iron Dominion / Crimson Sight) as of the last update, to spot chains breaking
let chained = new Map() // square -> was it Akane's ring (true) or Kyo's chain (false)
function onSquares(squares) {
  checkSound(squares)
  const nowChained = new Map(squares.filter(s => s.sealed).map(s => [s.name, !!s.sight]))
  if (props.lastMove) for (const [sq, sight] of chained) if (!nowChained.has(sq)) addFx({ kind: 'unchain', sight, pos: at(sq) }, 900)
  chained = nowChained
  const now = new Map()
  for (const s of squares) if (s.piece) now.set(s.name, s.piece.color + s.piece.type)
  const lm = props.lastMove
  if (lm !== lastSeen) {
    fxSide = lm?.color ?? null
    moveMag = lm ? magFor(lm.from, lm.to) : 1
    lastSeen = lm
    if (!lm) { frost.value = {}; ply = 0 } // new game / undo: the board thaws
    if (lm && prev.size) {
      ply++
      melt()
      if (props.trails?.[lm.color]) { leaveTrail(lm.to, props.trails[lm.color]); sfx.trail(props.trails[lm.color]) }
      sfx.move(props.motions?.[lm.color])
      const puppet = props.motions?.[lm.color] === 'puppet'
      // a puppeteer's pieces are lifted by strings and carried across
      const skip = props.motions?.[lm.color] === 'skip'
      const own = OWN_MOVES.includes(props.motions?.[lm.color]) ? props.motions[lm.color] : null
      arrive(lm.from, lm.to, lm.piece === 'n', puppet, props.motions?.[lm.color] === 'charge', skip, own)
      if (skip) emberTrail(lm)
      if (own === 'grow') addFx({ kind: 'sprout', pos: at(lm.from) }, paced(700)) // the old square: leaves fold away
      if (own === 'glide') { glideTrail(lm); addFx({ kind: 'glint', pos: at(lm.to), delay: paced(300) }, paced(1000)) }
      if (own === 'ooze') { addFx({ kind: 'puddle', pos: at(lm.from) }, paced(900)); addFx({ kind: 'puddle', pos: at(lm.to), delay: paced(250) }, paced(1100)) }
      if (own === 'drag') { dragChain(lm); addFx({ kind: 'slam', pos: at(lm.to), delay: paced(420) }, paced(1000)) }
      if (own === 'mist') mistTrail(lm, glowOf(lm.color))
      if (own === 'rain') { addFx({ kind: 'ripple', pos: at(lm.to), delay: paced(300) }, paced(900)); addFx({ kind: 'splash', pos: at(lm.to), delay: paced(300) }, paced(900)) }
      if (own === 'weave') { pathFx(lm, 'thread', paced(900)); addFx({ kind: 'jasmine', pos: at(lm.to), delay: paced(350) }, paced(1100)) }
      // Rai: each piece type has its own lightning (public/assets/fx/rai/move/): a travel effect along its path and a
      // landing effect, each a blue layer with a white-hot core on top
      if (own === 'bolt') raiSteps(lm)
      if (own === 'blink') { addFx({ kind: 'blinkeye', pos: at(lm.from) }, paced(600)); addFx({ kind: 'blinkeye', pos: at(lm.to), delay: paced(260) }, paced(700)) }
      if (own === 'snow') { addFx({ kind: 'snowpuff', pos: at(lm.from) }, paced(800)); addFx({ kind: 'snowpuff', pos: at(lm.to), delay: paced(300) }, paced(1000)) }
      if (own === 'glitch') { addFx({ kind: 'glitch', pos: at(lm.from) }, paced(500)); addFx({ kind: 'glitch', pos: at(lm.to), delay: paced(250) }, paced(600)) }
      if (own === 'flip') addFx({ kind: 'chips', pos: at(lm.to), delay: paced(480), bits: particles(7, i => ({ dx: rand(-60, 60), dy: rand(-50, -5), r: rand(-300, 300), s: rand(0.7, 1), die: i < 2 })) }, paced(1300))
      if (puppet) addFx({ kind: 'strings', glow: glowOf(lm.color), pos: at(lm.to) }, paced(1300))
      const time = props.motions?.[lm.color] === 'time'
      if (time) timeTrail(lm)
      const charge = props.motions?.[lm.color] === 'charge'
      if (charge) chargeStreak(lm)
      if (lm.captured) {
        moveMag = 1 // the capture itself lands at full size
        const capSq = lm.flags?.includes('e') ? lm.to[0] + lm.from[1] : lm.to
        const victim = lm.color === 'w' ? 'b' : 'w'
        const capKind = puppet ? 'yank' : time ? 'sand' : props.trails?.[lm.color] === 'ice' ? 'freeze' : charge ? 'knockout' : skip ? 'poof'
          : own === 'grow' ? 'wilt' : own === 'glide' ? 'shatter' : own === 'flip' ? 'cardflip' : own === 'ooze' ? 'dissolve' : own === 'drag' ? 'crush' : own === 'mist' ? 'vanish' : own === 'rain' ? 'drip' : own === 'weave' ? 'slash' : own === 'glitch' ? 'delete' : own === 'bolt' ? 'zapped' : own === 'blink' ? 'seen' : 'capture'
        const capDelay = paced(puppet ? 60 : charge ? 120 : own === 'glide' ? 220 : own === 'flip' ? 380 : own === 'drag' ? 360 : 180)
        ghost(capSq, victim + lm.captured, capKind, glowOf(lm.color), capDelay)
        impact(capSq, victim, lm.captured, glowOf(lm.color), capDelay, lm.color)
        sfx.capture(capKind)
        say(capSq, lineFor('dying', lm.captured, props.owners[victim]), victim, 'dying')
      }
      const rank = lm.from[1]
      if (lm.flags?.includes('k')) arrive('h' + rank, 'f' + rank, false, puppet)
      if (lm.flags?.includes('q')) arrive('a' + rank, 'd' + rank, false, puppet)
      if (lm.promotion) { morph(lm.to, 'crown'); addFx({ kind: 'beam', glow: '#ffcf4a', pos: at(lm.to), delay: paced(250) }, paced(1400)) }
    }
    moveMag = 1 // anything added later (capture impacts, ultimates) is full size
    prev = now
    chatter(squares)
    return
  }
  // same move as before, but the board changed: an ultimate removed or transformed pieces
  const style = recent && Date.now() - recent.t < 5000 ? recent : null
  for (const [sq, code] of prev) {
    const cur = now.get(sq)
    if (!cur && style?.fx === 'reset') { addFx({ kind: 'glitch', pos: at(sq) }, 600); continue }
    if (!cur) {
      const kind = style?.fx === 'chain' ? 'zapped' : style?.fx === 'burn' ? 'burn' : style?.fx === 'freeze' ? 'freeze' : style?.fx === 'wither' ? 'dissolve' : 'capture'
      ghost(sq, code, kind, style?.glow ?? 'var(--c)')
      sfx.capture(kind)
      say(sq, lineFor('dying', code[1], props.owners[code[0]]), code[0], 'dying')
    } else if (cur !== code) {
      const kind = style?.fx === 'steal' ? 'puppet' : 'crown'
      morph(sq, kind)
      if (kind === 'puppet') addFx({ kind: 'strings', glow: style.glow, pos: at(sq) }, 1300)
      else addFx({ kind: 'beam', glow: style?.fx === 'demote' ? style.glow : '#ffcf4a', pos: at(sq) }, 1400)
    }
  }
  // Factory Reset: the pieces render back in on their starting squares
  if (style?.fx === 'reset') for (const [sq] of now) {
    if (!prev.has(sq)) { morph(sq, 'crown'); addFx({ kind: 'glitch', pos: at(sq), delay: 200 }, 700) }
  }
  // pieces that appear out of nowhere (Haru's Bloom) rise out of a beam of light
  if (style?.fx === 'revive') for (const [sq] of now) {
    if (!prev.has(sq)) { morph(sq, 'crown'); addFx({ kind: 'beam', glow: style?.glow ?? '#4dff9b', pos: at(sq) }, 1400) }
  }
  prev = now
  chatter(squares)
}

/* ---- ultimate takeovers ----
   Each ultimate plays its own animation across the whole board before the pieces change:
   Mio's flames rise from the bottom edge, Haru's vines grow round the frame and a flower opens on the square,
   Kaito's lightning strikes and a crown drops, Jun's die tumbles across and lands on his roll,
   Yuki's frost creeps in with falling snow, Ren's giant clock spins, Sena's cracks race out from the target,
   Noa's strings drop onto the board; your Smite strikes in white, Shield raises a dome. */
const ultFx = ref(null)
const ULT_LIFE = { reset: 1900, chain: 1700, flood: 2000, bond: 2000, calc: 1900, snap: 1100, swap: 1400, sight: 1900, seal: 1900, poison: 1800, wither: 1400, burn: 1700, revive: 2000, promote: 1800, gamble: 2300, freeze: 2000, skip: 1900, rewind: 1900, demote: 1800, steal: 1800, smite: 1300, shield: 1500, double: 1300 }
// pips on a die face (x, y in %)
const PIPS = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}
function boltTo(x, y) {
  // a jagged lightning path from the top edge down to (x, y), in board % units
  const pts = [[x + rand(-14, 14), -4]]
  const steps = 6
  for (let i = 1; i < steps; i++) pts.push([x + rand(-8, 8) * (1 - i / steps), (y * i) / steps])
  pts.push([x, y])
  return pts.map(p => p.join(',')).join(' ')
}
function playUlt(ev) {
  const sq = ev.squares?.[0]
  const x = sq ? (fileOf(sq) + 0.5) * 12.5 : 50, y = sq ? (8 - rankOf(sq) + 0.5) * 12.5 : 50
  const n = ++seq
  fxSide = ev.side ?? null
  moveMag = 1
  const u = { fx: ev.fx, glow: ev.glow, n, x, y, hasTarget: !!sq, roll: ev.roll, side: ev.side ?? null }
  if (ev.fx === 'burn') u.bits = particles(18, i => ({ x: (i / 17) * 100, h: rand(14, 34), d: rand(0, 350) }))
  if (ev.fx === 'revive') u.bits = particles(16, () => ({ x: rand(0, 100), d: rand(0, 800), dx: rand(-20, 20), r: rand(180, 600) }))
  if (ev.fx === 'freeze') u.bits = particles(24, () => ({ x: rand(0, 100), d: rand(0, 900), dx: rand(-8, 8), s: rand(.5, 1.1) }))
  if (ev.fx === 'demote') u.bits = particles(8, i => ({ a: i * 45 + rand(-15, 15), l: rand(30, 75), d: rand(0, 150) }))
  if (ev.fx === 'poison') u.bits = particles(9, () => ({ x: rand(0, 100), y: rand(10, 90), s: rand(.6, 1.4), d: rand(0, 500) }))
  if (['seal', 'swap', 'sight', 'poison', 'flood', 'bond', 'snap', 'calc', 'chain', 'reset'].includes(ev.fx)) u.targets = (ev.squares ?? []).map(q => ({ x: (fileOf(q) + 0.5) * 12.5, y: (8 - rankOf(q) + 0.5) * 12.5 }))
  if (ev.fx === 'steal') u.bits = particles(10, () => ({ x: rand(4, 96), h: rand(25, 95), d: rand(0, 400) }))
  if (ev.fx === 'promote' || ev.fx === 'smite') u.bolt = boltTo(x, y)
  if (ev.fx === 'gamble') u.pips = PIPS[ev.roll] ?? PIPS[1]
  ultFx.value = u
  later(ULT_LIFE[ev.fx] ?? 1500, () => { if (ultFx.value?.n === n) ultFx.value = null })
}

/** An ultimate just resolved: mark its targets and, for Time Skip, stop time on the whole board. */
function onUlt(ev) {
  if (!ev) return
  recent = { ...ev, t: Date.now() }
  playUlt(ev)
  // Tenunan's thread snapped: the tied piece that was lost goes up in gold
  for (const g of ev.gone ?? []) { ghost(g.sq, g.code, 'slash', ev.glow); sfx.capture('crush') }
  for (const sq of ev.squares) {
    addFx({ kind: 'beam', glow: ev.glow, pos: at(sq) }, 1000)
    addFx({ kind: 'target', glow: ev.glow, pos: at(sq) }, 800)
  }
  if (ev.fx === 'double') addFx({ kind: 'shock', glow: ev.glow }, 1500) // your Double Move: a pulse across the board
  if (ev.fx === 'skip' || ev.fx === 'rewind') {
    timeStop.value = true
    later(1300, () => { timeStop.value = false })
    addFx({ kind: 'shock', glow: ev.glow }, 1500)
  }
}

watch(() => props.squares, onSquares, { immediate: true })
watch(() => props.ultEvent, onUlt)
</script>

<template>
  <div class="frame" :class="{ static: !interactive }">
    <!-- coordinates -->
    <div class="files"><span v-for="f in FILES" :key="f">{{ f }}</span></div>
    <div class="ranks"><span v-for="r in 8" :key="r">{{ 9 - r }}</span></div>

    <div ref="boardEl" class="board" :class="{ timestop: timeStop }" :style="{ '--pace': PACE }">
      <div
        v-for="(s, i) in squares" :key="s.name" class="sq"
        :class="[s.light ? 'l' : 'd', { sel: s.selected, last: s.last, hint: s.hint, cap: s.capture, stale: s.stale, check: s.check, boom: s.boom, own: interactive && s.piece?.color === 'w', aimable: s.aimable, shielded: s.shielded, sealed: s.sealed, sight: s.sight, poisoned: s.poisoned, flooded: s.flooded, bonded: s.bonded, picked: s.picked }]"
        @click="$emit('select', s.name)" @pointerenter="hoverIn(s)" @pointerleave="hoverOut"
      >
        <i v-if="frost[s.name]" :key="frost[s.name].n" class="frost" :class="[frost[s.name].kind, { alterfx: alter && frost[s.name].by === alter }]" :style="{ '--left': frostLeft(s.name) }" />
        <span
          v-if="s.piece" :key="`${s.piece.color}${s.piece.type}-${arrivals[s.name]?.n ?? 0}-${morphs[s.name]?.n ?? 0}`"
          class="piece" :class="{
            arrive: arrivals[s.name], hop: arrivals[s.name]?.hop, lift: arrivals[s.name]?.lift, dash: arrivals[s.name]?.dash, skip: arrivals[s.name]?.skip,
            ['m-' + arrivals[s.name]?.style]: arrivals[s.name]?.style, knightpath: arrivals[s.name]?.knight,
            crown: morphs[s.name]?.kind === 'crown', puppet: morphs[s.name]?.kind === 'puppet',
            'poke-own': pokes[s.name]?.kind === 'own', 'poke-enemy': pokes[s.name]?.kind === 'enemy',
          }"
          :style="arrivals[s.name] ? { '--fx': arrivals[s.name].fx, '--fy': arrivals[s.name].fy, '--steps': arrivals[s.name].steps ?? 1, '--kx': arrivals[s.name].kx ?? 0, '--ky': arrivals[s.name].ky ?? 0 } : null"
        >
          <span class="inner" :class="'m-' + (s.mood || 'idle')"><PieceArt
            :type="s.piece.type" :color="s.piece.color" :set="sets[s.piece.color]"
            :sway="motions[s.piece.color] === 'puppet'" :sway-delay="(i * 0.61) % 3.8"
          /></span>
        </span>
      </div>

      <!-- effects layer -->
      <!-- Tenunan: the gold thread between the two tied pieces, while it holds -->
      <svg v-if="bondLine" class="bondline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line :x1="bondLine[0].x" :y1="bondLine[0].y" :x2="bondLine[1].x" :y2="bondLine[1].y" />
      </svg>
      <!-- Calculate: your forbidden best moves, as numbered arrows -->
      <div v-if="pathArrows.length" class="calcarrows path" aria-hidden="true">
        <template v-for="(a, i) in pathArrows" :key="i">
          <i class="carrow" :class="a.mine ? 'mine' : 'theirs'" :style="{ left: a.x + '%', top: a.y + '%', width: a.len + '%', '--angle': a.angle + 'rad' }" />
          <i class="cbadge" :class="a.mine ? 'mine' : 'theirs'" :style="{ left: a.tx + '%', top: a.ty + '%' }"><b>{{ i + 1 }}</b></i>
        </template>
      </div>
      <div v-if="calcArrows.length" class="calcarrows" aria-hidden="true">
        <template v-for="(a, i) in calcArrows" :key="i">
          <i class="carrow" :style="{ left: a.x + '%', top: a.y + '%', width: a.len + '%', '--angle': a.angle + 'rad' }" />
          <i class="cbadge" :style="{ left: a.tx + '%', top: a.ty + '%' }"><b>{{ i + 1 }}</b></i>
        </template>
      </div>
      <!-- two effect layers: the Alter's effects (a mirror match) are drawn in black-and-white negative -->
      <div v-for="L in [false, true]" :key="String(L)" class="fx" :class="{ alterfx: L }" aria-hidden="true">
        <template v-for="f in fx.filter(x => !!(alter && x.by === alter) === L)" :key="f.id">
          <!-- a piece leaving the board -->
          <div v-if="f.ghost" class="cell ghost" :class="[f.kind, { byalter: alter && f.atk === alter }]" :style="{ ...f.pos, '--g': f.glow, '--delay': f.delay + 'ms', '--dir': f.dir ?? 1 }">
            <span class="piece"><span class="inner"><PieceArt :type="f.type" :color="f.side" :set="sets[f.side]" /></span></span>
            <i
              v-for="(b, i) in f.bits" :key="i" class="bit"
              :style="{ '--dx': (b.dx ?? 0) + 'px', '--dy': (b.dy ?? 0) + 'px', '--r': (b.r ?? 0) + 'deg', '--s': b.s, '--d': (b.d ?? 0) + 'ms' }"
            />
          </div>
          <!-- time: a fading crimson afterimage of a moving piece -->
          <div v-else-if="f.kind === 'echo'" class="cell echo" :class="f.tone" :style="{ ...f.pos, '--delay': f.delay + 'ms' }">
            <span class="piece"><span class="inner"><PieceArt :type="f.type" :color="f.side" :set="sets[f.side]" /></span></span>
          </div>
          <!-- time: a clock ring with a sweeping second hand -->
          <div v-else-if="f.kind === 'clock'" class="cell clock" :style="f.pos"><i class="hand" /></div>
          <!-- skip: little pink embers drifting up from Mio's afterglow -->
          <div v-else-if="f.kind === 'embers'" class="cell embers" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }">
            <i
              v-for="(b, i) in f.bits" :key="i" class="bit"
              :style="{ '--dx': b.dx + 'px', '--dy': b.dy + 'px', '--s': b.s }"
            />
          </div>
          <!-- charge: an amber speed streak along the path -->
          <div v-else-if="f.kind === 'streak'" class="streak" :class="f.tone" :style="{ ...f.pos, width: f.len, '--angle': f.angle, '--g': f.glow, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- Shin & Akane: a puff of mist where the piece dissolves, and where it re-forms -->
          <div v-else-if="f.kind === 'mistpuff'" class="cell mistpuff" :class="f.art" :style="{ ...f.pos, '--g': f.glow, '--delay': (f.delay ?? 0) + 'ms' }"><i /><i /><i /></div>
          <!-- Haru: petals and leaves puffing out of a blooming square; leaves folding away from the old one -->
          <div v-else-if="f.kind === 'petals'" class="cell petals" :class="f.tone" :style="f.pos">
            <i v-for="(b, i) in f.bits" :key="i" class="bit" :class="{ leaf: i % 3 === 0 }" :style="{ '--dx': b.dx + 'px', '--dy': b.dy + 'px', '--r': b.r + 'deg', '--s': b.s }" />
          </div>
          <div v-else-if="f.kind === 'sprout'" class="cell sprout" :style="f.pos"><i /><i /><i /></div>
          <!-- Shion: a venom puddle where the piece melts away and re-forms -->
          <div v-else-if="f.kind === 'puddle'" class="cell puddle" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- Kyo: a heavy crimson slam on landing -->
          <div v-else-if="f.kind === 'slam'" class="cell slam" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }"><i /></div>
          <!-- a capture lands: a flash on the square (bigger for bigger pieces), a ring for rooks and queens -->
          <div v-else-if="f.kind === 'hit'" class="cell hit" :class="'t' + f.tier" :style="{ ...f.pos, '--g': f.glow }"><i /><b /></div>
          <!-- a queen falls: light bursts across the whole board from that square -->
          <div v-else-if="f.kind === 'burst'" class="burst" :style="{ '--x': parseFloat(f.pos.left) + 6.25 + '%', '--y': parseFloat(f.pos.top) + 6.25 + '%', '--g': f.glow }" />
          <!-- Erika: a ripple and a splash where her piece lands -->
          <div v-else-if="f.kind === 'ripple'" class="cell ripple" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'splash'" class="cell splashfx" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- Melati: jasmine opening where her piece lands -->
          <div v-else-if="f.kind === 'jasmine'" class="cell jasmine" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- AI-0: the square glitches as the piece leaves and renders in -->
          <div v-else-if="f.kind === 'boltdown'" class="cell boltdown" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'blinkeye'" class="cell blinkeye" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'snowpuff'" class="cell snowpuff" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'zapdot'" class="cell zapdot" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'railand'" class="cell railand" :class="f.piece" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }"><i /><b /></div>
          <div v-else-if="f.kind === 'zapburst'" class="cell zapburst" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <div v-else-if="f.kind === 'glitch'" class="cell glitchfx" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- Iron Dominion wears off: the chain on that square snaps -->
          <div v-else-if="f.kind === 'unchain'" class="cell unchain" :class="{ sight: f.sight }" :style="f.pos"><i /></div>
          <!-- Yuki: a splash of ice shards where her piece lands -->
          <div v-else-if="f.kind === 'icesplash'" class="cell icesplash" :style="f.pos" />
          <!-- Sena: a cold glint where the piece lands -->
          <div v-else-if="f.kind === 'glint'" class="cell glint" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- Jun: chips and dice scattering on landing -->
          <div v-else-if="f.kind === 'chips'" class="cell chips" :style="{ ...f.pos, '--delay': (f.delay ?? 0) + 'ms' }">
            <i v-for="(b, i) in f.bits" :key="i" class="bit" :class="{ die: b.die }" :style="{ '--dx': b.dx + 'px', '--dy': b.dy + 'px', '--r': b.r + 'deg', '--s': b.s }" />
          </div>
          <!-- charge: a heavy landing, with a shockwave and sparks -->
          <div v-else-if="f.kind === 'impact'" class="cell impact" :style="f.pos">
            <i
              v-for="(b, i) in f.bits" :key="i" class="bit"
              :style="{ '--dx': b.dx + 'px', '--dy': b.dy + 'px', '--r': '0deg', '--s': b.s, '--delay': '0ms' }"
            />
          </div>
          <!-- ice shards bursting from a freshly frozen square -->
          <div v-else-if="f.kind === 'frost'" class="cell frostburst" :style="f.pos">
            <i
              v-for="(b, i) in f.bits" :key="i" class="bit"
              :style="{ '--dx': b.dx + 'px', '--dy': b.dy + 'px', '--r': b.r + 'deg', '--s': b.s, '--delay': '0ms' }"
            />
          </div>
          <!-- a pillar of light over a square -->
          <div v-else-if="f.kind === 'beam'" class="cell beam" :style="{ ...f.pos, '--g': f.glow, '--delay': (f.delay ?? 0) + 'ms' }" />
          <!-- a closing target ring -->
          <div v-else-if="f.kind === 'target'" class="cell target" :style="{ ...f.pos, '--g': f.glow }" />
          <!-- Noa's strings -->
          <div v-else-if="f.kind === 'strings'" class="cell strings" :class="{ hooked: f.hook }" :style="{ ...f.pos, '--g': f.glow }"><i /><i /><i /><b v-if="f.hook" class="hook" /></div>
          <!-- Ren's time-stop shockwaves -->
          <div v-else-if="f.kind === 'shock'" class="shock" :style="{ '--g': f.glow }"><i /><i /><i /></div>
        </template>
      </div>

      <!-- the ultimate's own takeover of the board -->
      <div
        v-if="ultFx" :key="ultFx.n" class="ultfx" :class="['u-' + ultFx.fx, { alterfx: alter && ultFx.side === alter }]" aria-hidden="true"
        :style="{ '--g': ultFx.glow, '--x': ultFx.x + '%', '--y': ultFx.y + '%' }"
      >
        <template v-if="ultFx.fx === 'burn'">
          <i class="tint" />
          <i class="flamewall" />
          <i v-for="(f, i) in ultFx.bits" :key="i" class="flame" :style="{ left: f.x + '%', '--h': f.h + '%', '--d': f.d + 'ms' }" />
          <i v-if="ultFx.hasTarget" class="tflame" />
          <i class="embers" />
        </template>
        <template v-else-if="ultFx.fx === 'revive'">
          <svg class="vines" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 C 4 80, -2 70, 3 55 S 0 30, 4 15 S 2 4, 10 0" />
            <path d="M100 0 C 96 20, 102 30, 97 45 S 100 70, 96 85 S 98 96, 90 100" />
            <path d="M0 0 C 20 4, 30 -2, 45 3 S 70 0, 85 4" />
            <path d="M100 100 C 80 96, 70 102, 55 97 S 30 100, 15 96" />
          </svg>
          <i v-for="(f, i) in ultFx.bits" :key="i" class="petal" :style="{ left: f.x + '%', '--d': f.d + 'ms', '--dx': f.dx + '%', '--r': f.r + 'deg' }" />
          <div v-if="ultFx.hasTarget" class="flower"><i v-for="k in 8" :key="k" :style="{ '--k': k }" /><b /></div>
          <i class="vineart top" /><i class="vineart bottom" />
          <i v-if="ultFx.hasTarget" class="bloomart" />
        </template>
        <template v-else-if="ultFx.fx === 'promote' || ultFx.fx === 'smite'">
          <i class="tint" />
          <svg class="bolt" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline :points="ultFx.bolt" /><polyline class="core" :points="ultFx.bolt" /></svg>
          <i class="impact" />
          <i v-if="ultFx.fx === 'promote'" class="boltart" />
          <i v-if="ultFx.fx === 'promote'" class="crowndrop" />
          <svg v-if="ultFx.fx === 'promote'" class="crownmark" viewBox="0 0 100 80">
            <path d="M8 72 L8 30 L30 50 L50 16 L70 50 L92 30 L92 72 Z" /><circle cx="8" cy="26" r="6" /><circle cx="50" cy="11" r="7" /><circle cx="92" cy="26" r="6" />
          </svg>
        </template>
        <template v-else-if="ultFx.fx === 'gamble'">
          <i class="felt" />
          <i class="tumble" />
          <i class="rollfx" :class="ultFx.roll <= 2 ? 'bad' : 'good'" />
          <div class="die"><i v-for="(pp, i) in ultFx.pips" :key="i" :style="{ left: pp[0] + '%', top: pp[1] + '%' }" /></div>
          <span class="rollnum" :class="{ bad: ultFx.roll <= 2, jackpot: ultFx.roll === 6 }">{{ ultFx.roll }}</span>
        </template>
        <template v-else-if="ultFx.fx === 'freeze'">
          <i class="frostedge" />
          <i class="icicles top" /><i class="icicles bottom" /><i class="icicles left" /><i class="icicles right" />
          <i class="swirl" />
          <i v-for="(f, i) in ultFx.bits" :key="i" class="flake" :style="{ left: f.x + '%', '--d': f.d + 'ms', '--dx': f.dx + '%', '--s': f.s }" />
        </template>
        <template v-else-if="ultFx.fx === 'skip' || ultFx.fx === 'rewind'">
          <i class="hourglass" />
          <div class="bigclock"><i class="gears" /><i class="hand hr" /><i class="hand mn" /></div>
          <i class="clockshards" />
        </template>
        <template v-else-if="ultFx.fx === 'demote'">
          <i class="chill" />
          <i class="crackimg" />
          <i class="crownfall" />
          <i v-for="(c, i) in ultFx.bits" :key="i" class="crack" :style="{ '--a': c.a + 'deg', '--l': c.l + '%', '--d': c.d + 'ms' }" />
          <i class="ring" />
        </template>
        <template v-else-if="ultFx.fx === 'steal'">
          <i class="dim" />
          <i v-if="ultFx.hasTarget" class="control" />
          <i v-for="(f, i) in ultFx.bits" :key="i" class="pstring" :style="{ left: f.x + '%', height: f.h + '%', '--d': f.d + 'ms' }" />
          <i v-if="ultFx.hasTarget" class="pstring main" :style="{ left: ultFx.x + '%', height: ultFx.y + '%', '--d': '200ms' }" />
        </template>
        <!-- Shin: a swap sigil turns over the board, mirror shards flash on the two pieces trading places -->
        <template v-else-if="ultFx.fx === 'swap'">
          <i class="mistveil" />
          <i class="swapsym" />
          <i v-for="(t, i) in ultFx.targets" :key="i" class="mirror" :style="{ left: t.x + '%', top: t.y + '%', '--d': 200 + i * 120 + 'ms' }" />
        </template>
        <!-- Akane: a crimson eye opens over the board, and locks onto her two targets -->
        <template v-else-if="ultFx.fx === 'sight'">
          <i class="eyedim" />
          <i class="eye" />
          <i v-for="(t, i) in ultFx.targets" :key="i" class="reticle" :style="{ left: t.x + '%', top: t.y + '%', '--d': 550 + i * 160 + 'ms' }"><b /></i>
        </template>
        <!-- Erika: a storm cloud, rain sheeting down, a flash of lightning; puddles form on the flooded squares -->
        <template v-else-if="ultFx.fx === 'flood'">
          <i class="raindim" /><i class="rainfall" /><i class="cloudart" /><i class="flash" />
          <i v-for="(t, i) in ultFx.targets" :key="i" class="floodin" :style="{ left: t.x + '%', top: t.y + '%', '--d': 500 + i * 200 + 'ms' }" />
        </template>
        <!-- Melati: a gold thread runs between the two pieces and knots tight -->
        <template v-else-if="ultFx.fx === 'bond' || ultFx.fx === 'snap'">
          <i class="golddim" />
          <svg v-if="ultFx.targets?.length === 2" class="tie" viewBox="0 0 100 100" preserveAspectRatio="none"><line :x1="ultFx.targets[0].x" :y1="ultFx.targets[0].y" :x2="ultFx.targets[1].x" :y2="ultFx.targets[1].y" /></svg>
          <i v-for="(t, i) in ultFx.targets" :key="i" class="knot" :class="{ snapped: ultFx.fx === 'snap' }" :style="{ left: t.x + '%', top: t.y + '%', '--d': 300 + i * 150 + 'ms' }" />
          <i v-if="ultFx.fx === 'bond'" class="loomart" />
        </template>
        <!-- Rai: a bolt strikes the first piece, and arcs to the second -->
        <template v-else-if="ultFx.fx === 'chain'">
          <i class="stormdim" />
          <i v-for="(t, i) in ultFx.targets" :key="i" :class="i ? 'zring' : 'zbolt'" :style="i ? { left: t.x + '%', top: t.y + '%', '--d': '350ms' } : { left: t.x + '%', height: t.y + '%' }" />
          <i v-if="ultFx.targets?.length === 2" class="zarc" :style="{ left: ultFx.targets[0].x + '%', top: ultFx.targets[0].y + '%', width: Math.hypot(ultFx.targets[1].x - ultFx.targets[0].x, ultFx.targets[1].y - ultFx.targets[0].y) + '%', '--angle': Math.atan2(ultFx.targets[1].y - ultFx.targets[0].y, ultFx.targets[1].x - ultFx.targets[0].x) + 'rad' }" />
        </template>
        <!-- AI-0: a wireframe grid sweeps the board and a loading ring spins while it calculates -->
        <template v-else-if="ultFx.fx === 'calc' || ultFx.fx === 'reset'">
          <i class="scan" /><i class="loading" /><i class="panelart" />
        </template>
        <template v-else-if="ultFx.fx === 'seal'">
          <i class="dark" />
          <template v-for="(t, i) in ultFx.targets" :key="i">
            <i class="chain l" :style="{ top: t.y + '%', width: t.x + '%', '--d': i * 150 + 'ms' }" />
            <i class="chain r" :style="{ top: t.y + '%', width: 100 - t.x + '%', '--d': i * 150 + 'ms' }" />
            <i class="lock" :style="{ left: t.x + '%', top: t.y + '%', '--d': 450 + i * 150 + 'ms' }" />
          </template>
        </template>
        <template v-else-if="ultFx.fx === 'poison' || ultFx.fx === 'wither'">
          <i class="toxic" />
          <i class="fogart" /><i v-if="ultFx.fx === 'poison'" class="dripsart" />
          <i v-for="(t, i) in ultFx.targets ?? []" :key="'k' + i" class="kiss" :style="{ left: t.x + '%', top: t.y + '%', '--d': 500 + i * 180 + 'ms' }" />
          <i v-for="(f, i) in ultFx.bits ?? []" :key="i" class="cloud" :style="{ left: f.x + '%', top: f.y + '%', '--s': f.s, '--d': f.d + 'ms' }" />
        </template>
        <template v-else-if="ultFx.fx === 'shield'">
          <i class="dome" />
        </template>
      </div>

      <!-- spoken captions -->
      <div class="talk" aria-live="polite">
        <div v-for="b in bubbles" :key="b.id" class="cell bubble" :class="[b.side, 'a-' + b.align, { below: b.below }, 't-' + b.mood]" :style="b.pos">
          <span>{{ b.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frame { position: relative; width: 100%; height: 100%; }
.frame.static .sq { cursor: default; }
.files, .ranks { position: absolute; display: flex; font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .1em; color: var(--faint); text-transform: uppercase; pointer-events: none; }
.files { left: 0; right: 0; bottom: -20px; }
.files span { flex: 1; text-align: center; }
.ranks { top: 0; bottom: 0; left: -18px; flex-direction: column; }
.ranks span { flex: 1; display: flex; align-items: center; }

.board {
  position: relative; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); grid-template-rows: repeat(8, minmax(0, 1fr)); width: 100%; aspect-ratio: 1; user-select: none;
  outline: 1px solid var(--line); outline-offset: 6px; transition: filter .3s;
  box-shadow: 0 30px 80px -30px #000, 0 0 90px -30px color-mix(in srgb, var(--c) 55%, transparent);
}
/* corner ticks on the outer frame */
.board::before, .board::after { content: ''; position: absolute; width: 18px; height: 18px; border: 2px solid var(--text); pointer-events: none; z-index: 3; }
.board::before { top: -8px; left: -8px; border-right: 0; border-bottom: 0; }
.board::after { bottom: -8px; right: -8px; border-left: 0; border-top: 0; }

.sq { position: relative; min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: min(7.2vh, 7.6vw); line-height: 1; transition: background .15s; }
.l { background: #36333f; }
.d { background: #201e29; }
.sq.own:hover { background: #45414f; }

.sq.last::after { content: ''; position: absolute; inset: 0; background: color-mix(in srgb, var(--c) 20%, transparent); }
.sq.sel::after { content: ''; position: absolute; inset: 0; background: color-mix(in srgb, var(--c) 28%, transparent); box-shadow: inset 0 0 0 2px var(--c); }
.sq.check { background: radial-gradient(circle, rgba(255, 95, 138, .9) 0%, rgba(255, 95, 138, 0) 70%), #36333f; animation: checkpulse 1s ease-in-out infinite; }
@keyframes checkpulse { 50% { box-shadow: inset 0 0 24px rgba(255, 95, 138, .7) } }
.sq.hint::before { content: ''; position: absolute; width: 22%; height: 22%; border-radius: 50%; background: color-mix(in srgb, var(--c) 60%, #fff); box-shadow: 0 0 12px var(--c); opacity: .8; z-index: 2; animation: hintin .25s ease-out; }
.sq.hint.cap::before { width: 84%; height: 84%; background: none; border: 2px solid var(--c); box-shadow: 0 0 14px var(--c); }
@keyframes hintin { from { transform: scale(0); opacity: 0 } }
.sq.boom { animation: boom .8s; }
@keyframes boom { 0% { box-shadow: inset 0 0 0 0 #fff } 40% { box-shadow: inset 0 0 30px 20px var(--c) } 100% { box-shadow: inset 0 0 40px 10px var(--c) } }

/* ---- crack trail (Kaito): a scorched square with glowing amber cracks that cool over a few moves ---- */
.frost.crack {
  background:
    linear-gradient(28deg, transparent 46%, #ffd27a 47.5%, #ff8a1a 49%, transparent 51%),
    linear-gradient(-62deg, transparent 55%, #ffb020 56.5%, transparent 58.5%),
    linear-gradient(118deg, transparent 33%, #ff8a1a 34%, transparent 36%),
    linear-gradient(-15deg, transparent 70%, #ffb020 71%, transparent 72.5%),
    radial-gradient(circle at 50% 50%, rgba(255, 140, 30, .35), rgba(20, 10, 5, .55) 70%);
  box-shadow: inset 0 0 16px rgba(255, 140, 30, .5);
  filter: drop-shadow(0 0 3px rgba(255, 160, 40, .6));
}

/* ---- ice trail: a frozen square that melts over a few moves ---- */
.frost {
  position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: calc(.25 + var(--left) * .75);
  background:
    /* sharp crack lines */
    linear-gradient(32deg, transparent 47%, rgba(255, 255, 255, .55) 48%, transparent 50%),
    linear-gradient(-58deg, transparent 58%, rgba(220, 248, 255, .45) 59%, transparent 60.5%),
    linear-gradient(105deg, transparent 30%, rgba(220, 248, 255, .35) 31%, transparent 32%),
    /* frozen sheen */
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .45), transparent 45%),
    linear-gradient(135deg, rgba(190, 240, 255, .55), rgba(110, 190, 235, .35) 55%, rgba(60, 120, 190, .45));
  box-shadow: inset 0 0 0 1px rgba(220, 248, 255, .6), inset 0 0 18px rgba(143, 240, 255, .55);
  animation: freezeIn .45s cubic-bezier(.2, .8, .2, 1) both;
  transition: opacity 1s;
}
@keyframes freezeIn { from { clip-path: circle(0% at 50% 50%); filter: brightness(2.2) } to { clip-path: circle(75% at 50% 50%); filter: none } }
.frostburst .bit { background: linear-gradient(135deg, #ffffff, #8ff0ff); clip-path: polygon(50% 0, 100% 60%, 60% 100%, 0 40%); animation: shard .7s cubic-bezier(.2, .7, .4, 1) both; }

/* ---- your ultimates ---- */
/* valid targets while choosing where to Smite / Shield */
.sq.aimable { cursor: crosshair; }
.sq.aimable::before { content: ''; position: absolute; inset: 8%; z-index: 2; border: 2px dashed rgba(244, 242, 251, .85); border-radius: 50%; box-shadow: 0 0 14px rgba(244, 242, 251, .6); animation: aimspin 4s linear infinite; pointer-events: none; }
@keyframes aimspin { to { transform: rotate(360deg) } }
/* your shielded piece: a shimmering barrier until the opponent's turn is over */
.sq.shielded::after {
  content: ''; position: absolute; inset: 4%; z-index: 3; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, transparent 55%, rgba(220, 235, 255, .25) 68%, rgba(244, 242, 251, .55) 72%, transparent 74%);
  box-shadow: 0 0 18px rgba(200, 225, 255, .55), inset 0 0 14px rgba(200, 225, 255, .4);
  animation: barrier 1.6s ease-in-out infinite;
}
@keyframes barrier { 50% { transform: scale(1.05); opacity: .75 } }

/* ---- pieces ---- */
/* the piece fills its square, so 100% in a transform = one square */
.piece { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transition: transform .15s; }
.sq.own:hover .piece { transform: translateY(-3px) scale(1.06); }
.sq.sel .piece { transform: translateY(-5px) scale(1.1); filter: drop-shadow(0 6px 6px rgba(0, 0, 0, .5)); }
/* the drawn piece sits inside, a little smaller than the square */
.inner { display: block; width: 92%; height: 92%; transform-origin: 50% 90%; }

/* ---- moods: body language and a soft aura (no faces) ---- */
.m-afraid { animation: tremble .11s linear infinite; filter: drop-shadow(0 0 6px rgba(150, 210, 255, .75)) brightness(1.05); }
.m-nervous { animation: jitter 1.4s ease-in-out infinite; filter: drop-shadow(0 0 4px rgba(150, 210, 255, .4)); }
.m-panic { animation: shake .16s linear infinite; filter: drop-shadow(0 0 9px rgba(255, 70, 110, .95)); }
.m-shock { animation: jolt .5s cubic-bezier(.2, 1.6, .4, 1) both, tremble .1s linear .5s infinite; filter: drop-shadow(0 0 10px rgba(255, 255, 255, .85)); }
.m-proud { animation: rise .55s ease-in-out infinite alternate; filter: drop-shadow(0 0 8px rgba(255, 207, 74, .8)); }
.m-smug { animation: sway 2.4s ease-in-out infinite; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c) 70%, transparent)); }
.m-sleepy { animation: doze 3.2s ease-in-out infinite; filter: brightness(.6) saturate(.6); }
.m-cheer { animation: cheer .5s cubic-bezier(.3, .6, .4, 1) infinite alternate; filter: drop-shadow(0 0 10px rgba(255, 207, 74, .9)); }
.m-sad { transform: translateY(5%) rotate(-5deg) scale(.95); filter: grayscale(.85) brightness(.55); transition: transform .6s, filter .6s; }
@keyframes tremble { 0% { transform: translate(-1.5%, 0) } 25% { transform: translate(1.5%, -.5%) } 50% { transform: translate(-1%, .5%) } 75% { transform: translate(1%, 0) } }
@keyframes jitter { 0%, 100% { transform: none } 40% { transform: translateX(-1.5%) rotate(-1.5deg) } 60% { transform: translateX(1.5%) rotate(1.5deg) } }
@keyframes shake { 0%, 100% { transform: translate(0, 0) rotate(0) } 25% { transform: translate(-4%, 0) rotate(-4deg) } 75% { transform: translate(4%, 0) rotate(4deg) } }
@keyframes jolt { 0% { transform: none } 40% { transform: translateY(-14%) scale(1.1) } 100% { transform: translateY(-2%) scale(1.03) } }
@keyframes rise { from { transform: translateY(0) } to { transform: translateY(-8%) } }
@keyframes sway { 0%, 100% { transform: rotate(-4deg) translateY(-2%) } 50% { transform: rotate(-2deg) translateY(-4%) } }
@keyframes doze { 0%, 100% { transform: rotate(4deg) scaleY(.98) } 50% { transform: rotate(6deg) scaleY(.95) translateY(2%) } }
@keyframes cheer { from { transform: translateY(0) } to { transform: translateY(-16%) } }

/* hover reactions: your pieces perk up, enemy pieces recoil */
.piece.poke-own { z-index: 3; animation: perk .5s cubic-bezier(.3, 1.6, .5, 1) both; }
.piece.poke-enemy { z-index: 3; animation: recoil .5s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes perk {
  0% { transform: none; filter: none }
  35% { transform: translateY(-14%) scale(1.12); filter: drop-shadow(0 0 10px rgba(244, 242, 251, .8)) }
  100% { transform: translateY(-3px) scale(1.06); filter: none }
}
@keyframes recoil {
  0% { transform: none; filter: none }
  30% { transform: translateX(5%) rotate(7deg) scale(1.05); filter: drop-shadow(0 0 10px color-mix(in srgb, var(--c) 90%, transparent)) brightness(1.2) }
  60% { transform: translateX(-2%) rotate(-3deg) }
  100% { transform: none; filter: none }
}

/* slide in from the square it came from; knights hop over */
.piece.arrive { z-index: 4; animation: slide calc(.34s * var(--pace, 1)) cubic-bezier(.3, .7, .25, 1) both; }
.piece.arrive.hop { animation: hop calc(.42s * var(--pace, 1)) cubic-bezier(.3, .7, .25, 1) both; }
@keyframes slide {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) scale(1.08); }
  70% { transform: translate(0, 0) scale(1.08); }
  85% { transform: translate(0, 0) scale(.94, 1.06); }
  to { transform: translate(0, 0) scale(1); }
}
@keyframes hop {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) scale(1); }
  50% { transform: translate(calc(var(--fx) * 50%), calc(var(--fy) * 50% - 45%)) scale(1.3); filter: drop-shadow(0 18px 10px rgba(0, 0, 0, .45)); }
  85% { transform: translate(0, 0) scale(.92, 1.08); }
  to { transform: translate(0, 0) scale(1); }
}
/* a puppeteer's move: lifted on strings, carried across, lowered with a little bounce */
.piece.arrive.lift { animation: lift calc(.65s * var(--pace, 1)) cubic-bezier(.45, 0, .25, 1) both; }
@keyframes lift {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); }
  25% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100% - 42%)) rotate(-5deg); filter: drop-shadow(0 16px 8px rgba(0, 0, 0, .45)); }
  72% { transform: translate(0, -42%) rotate(4deg); filter: drop-shadow(0 16px 8px rgba(0, 0, 0, .45)); }
  88% { transform: translate(0, 5%) scale(1.03, .96); }
  to { transform: none; }
}

/* Kaito's crown / promotion: the new queen rises out of the light */
.piece.crown { z-index: 4; animation: crown .9s cubic-bezier(.3, 1.6, .4, 1) .25s both; }
@keyframes crown {
  from { transform: scale(0) rotate(-30deg); filter: brightness(4) drop-shadow(0 0 20px #ffcf4a); }
  60% { filter: brightness(1.6) drop-shadow(0 0 16px #ffcf4a); }
  to { transform: scale(1); filter: none; }
}
/* Noa's puppet strings: lifted, spun round, set down in her colour */
.piece.puppet { z-index: 4; animation: puppet 1.1s cubic-bezier(.4, 0, .2, 1) both; }
@keyframes puppet {
  from { transform: translateY(-60%) rotateY(180deg) scale(1.15); filter: drop-shadow(0 0 14px var(--c)); }
  45% { transform: translateY(-75%) rotateY(360deg) scale(1.15); }
  80% { transform: translateY(4%) rotateY(360deg) scale(.95, 1.05); }
  to { transform: translateY(0) rotateY(360deg) scale(1); filter: none; }
}

/* ---- Haru: grow ----
   The piece grows up out of its new square, with a soft green glow. */
.piece.arrive.m-grow { animation: grow calc(.8s * var(--pace, 1)) cubic-bezier(.3, 1.4, .5, 1) both; transform-origin: 50% 95%; }
@keyframes grow {
  from { transform: scale(0, .1); filter: brightness(1.8) drop-shadow(0 0 12px #4dff9b); }
  55% { transform: scale(.9, 1.15); filter: drop-shadow(0 0 10px #4dff9b); }
  78% { transform: scale(1.06, .95); }
  to { transform: none; filter: none; }
}
/* moss and tiny flowers on squares where Haru's pieces land (fades like the frost) */
.frost.bloom {
  background:
    radial-gradient(circle at 22% 30%, #fff 0 2.5%, #ffd1e8 3%, transparent 5%),
    radial-gradient(circle at 72% 24%, #fff 0 2%, #fff3a8 2.5%, transparent 4.5%),
    radial-gradient(circle at 80% 72%, #fff 0 2.5%, #ffd1e8 3%, transparent 5%),
    radial-gradient(circle at 30% 80%, #fff 0 2%, #fff3a8 2.5%, transparent 4.5%),
    radial-gradient(ellipse at 50% 55%, rgba(77, 255, 155, .35), rgba(31, 138, 85, .4) 55%, rgba(10, 40, 25, .25) 80%);
  box-shadow: inset 0 0 14px rgba(77, 255, 155, .45);
  animation: bloomIn .6s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes bloomIn { from { clip-path: circle(0% at 50% 60%); filter: brightness(1.8) } to { clip-path: circle(75% at 50% 60%); filter: none } }
.petals .bit { width: 8px; height: 6px; border-radius: 60% 10% 60% 10%; background: linear-gradient(135deg, #fff, #ffd1e8); animation: shard .9s cubic-bezier(.2, .7, .4, 1) both; }
.petals .bit.leaf { background: linear-gradient(135deg, #b8ffd2, #2fbf6a); }
.sprout i { position: absolute; bottom: 20%; width: 10%; height: 30%; border-radius: 100% 0 100% 0; background: linear-gradient(135deg, #8dffb9, #1f8a55); transform-origin: bottom center; animation: fold .6s ease-in both; }
.sprout i:nth-child(1) { left: 38%; rotate: -30deg; } .sprout i:nth-child(2) { left: 46%; } .sprout i:nth-child(3) { left: 54%; rotate: 30deg; }
@keyframes fold { from { opacity: 1; transform: scaleY(1) } to { opacity: 0; transform: scaleY(0) } }
/* Haru's capture: droops, browns, falls apart into petals */
.ghost.wilt .piece { animation: wilt 1.2s ease-in both; transform-origin: 50% 95%; }
@keyframes wilt {
  0% { filter: none }
  35% { transform: rotate(-10deg) scale(.97, .94); filter: sepia(.8) saturate(1.4) hue-rotate(50deg) brightness(.8); }
  70% { transform: rotate(-22deg) scale(.9, .75) translateY(8%); filter: sepia(1) brightness(.5); opacity: .8 }
  100% { transform: rotate(-30deg) scale(.8, .4) translateY(25%); filter: sepia(1) brightness(.3) blur(2px); opacity: 0 }
}
.ghost.wilt .bit { width: 9px; height: 7px; border-radius: 60% 10% 60% 10%; background: linear-gradient(135deg, #fff, #ffc4dd); animation: petalfall 1.2s ease-in var(--d) both; }
.ghost.wilt .bit:nth-child(3n) { background: linear-gradient(135deg, #d6e8a0, #7a8a3a); }
@keyframes petalfall {
  from { opacity: 0; transform: translate(-50%, -60%) rotate(0) scale(var(--s)) }
  15% { opacity: 1 }
  to { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)) scale(var(--s)) }
}

/* ---- Sena: glide ----
   A cold, frictionless glide: fast out, a long smooth stop, a blue sheen, no bounce. */
.piece.arrive.m-glide { animation: glide calc(.55s * var(--pace, 1)) cubic-bezier(.15, .85, .2, 1) both; }
@keyframes glide {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: brightness(1.3) drop-shadow(0 0 8px #4a7dff); }
  70% { filter: brightness(1.15) drop-shadow(0 0 6px #4a7dff); }
  to { transform: none; filter: none; }
}
.streak.glass {
  height: 4%;
  background: linear-gradient(90deg, transparent, rgba(160, 190, 255, .2) 30%, rgba(210, 225, 255, .9) 85%, #fff);
  filter: drop-shadow(0 0 5px #4a7dff); animation-duration: .7s;
}
/* a four-pointed glint flaring where the piece stops */
.glint::before, .glint::after {
  content: ''; position: absolute; left: 50%; top: 40%; width: 90%; height: 6%; translate: -50% -50%;
  background: linear-gradient(90deg, transparent, #dfe8ff 40%, #fff 50%, #dfe8ff 60%, transparent); filter: drop-shadow(0 0 6px #4a7dff);
  animation: glint .7s ease-out var(--delay) both;
}
.glint::after { rotate: 90deg; }
@keyframes glint { from { opacity: 0; transform: scaleX(.1) } 30% { opacity: 1; transform: scaleX(1) } to { opacity: 0; transform: scaleX(.3) } }
/* Sena's capture: turns to blue glass, cracks, bursts into shards */
.ghost.shatter .piece { animation: shatter .45s ease-in var(--delay) both; }
@keyframes shatter {
  0% { filter: none }
  50% { filter: brightness(1.6) saturate(0) sepia(.4) hue-rotate(185deg) saturate(3) drop-shadow(0 0 12px #4a7dff); transform: translateY(4%) scale(.98, .96) }
  70% { opacity: 1; transform: scale(1.05) }
  100% { opacity: 0; transform: scale(1.15); filter: brightness(2.5) saturate(0) }
}
.ghost.shatter .bit {
  width: 12px; height: 14px; background: linear-gradient(135deg, #ffffff, #9fb8ff 50%, #4a7dff); clip-path: polygon(50% 0, 100% 75%, 15% 100%);
  filter: drop-shadow(0 0 3px #4a7dff); animation: shard .75s cubic-bezier(.2, .7, .4, 1) calc(var(--delay) + 280ms) both;
}

/* ---- Jun: flip ----
   Tossed like a coin: up, spinning end over end, and down with a little bounce. */
.piece.arrive.m-flip { animation: flip calc(.62s * var(--pace, 1)) cubic-bezier(.35, .1, .35, 1) both; }
@keyframes flip {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) rotateY(0); }
  50% { transform: translate(calc(var(--fx) * 50%), calc(var(--fy) * 50% - 55%)) rotateY(360deg) scale(1.15); filter: drop-shadow(0 18px 10px rgba(0, 0, 0, .45)) drop-shadow(0 0 8px rgba(232, 232, 248, .7)); }
  82% { transform: translate(0, 0) rotateY(720deg) scale(1.08, .92); }
  92% { transform: translateY(-6%) rotateY(720deg); }
  to { transform: rotateY(720deg); filter: none; }
}
/* chips and dice scattering on landing */
.chips .bit {
  width: 9px; height: 9px; border-radius: 50%;
  background: radial-gradient(circle, #fff 0 25%, #c9c9d6 26% 40%, #fff 41% 55%, #8a8aa0 56%); box-shadow: 0 0 4px rgba(232, 232, 248, .7);
  animation: shard .75s cubic-bezier(.2, .7, .4, 1) var(--delay) both;
}
.chips .bit.die { width: 10px; height: 10px; border-radius: 2px; background: radial-gradient(circle at 30% 30%, #222 0 9%, transparent 11%), radial-gradient(circle at 70% 70%, #222 0 9%, transparent 11%), radial-gradient(circle at 50% 50%, #222 0 9%, transparent 11%), #f4f4f8; }
/* Jun's capture: flips over like a card, then spins away */
.ghost.cardflip .piece { animation: cardflip .75s cubic-bezier(.4, 0, .6, 1) var(--delay) both; }
@keyframes cardflip {
  0% { transform: none; opacity: 1 }
  35% { transform: rotateY(90deg) scale(1.05); filter: brightness(1.8); }
  36% { transform: rotateY(90deg); filter: brightness(1.8) grayscale(1); }
  100% { transform: translate(calc(var(--dir) * 260%), -220%) rotateY(90deg) rotateZ(calc(var(--dir) * 540deg)) scale(.4); opacity: 0 }
}
.ghost.cardflip .bit {
  width: 9px; height: 13px; border-radius: 1.5px; background: linear-gradient(135deg, #fff, #e8e8f8); border: 1px solid #8a8aa0;
  animation: shard .8s cubic-bezier(.2, .7, .4, 1) calc(var(--delay) + 200ms) both;
}

/* ---- Shin & Akane: mist ----
   The piece blurs and fades into silver-lavender mist (tinted with its owner's colour), the mist drifts across,
   and the piece condenses out of it on the new square. */
.piece.arrive.m-mist { animation: mist calc(.95s * var(--pace, 1)) cubic-bezier(.45, 0, .25, 1) both; }
@keyframes mist {
  0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: none; opacity: 1; }
  28% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) scale(1.18) translateY(-6%); filter: blur(5px) brightness(1.6); opacity: 0; }
  62% { transform: scale(1.18) translateY(-6%); filter: blur(5px) brightness(1.6); opacity: 0; }
  100% { transform: none; filter: none; opacity: 1; }
}
.streak.mist {
  height: 15%; clip-path: none; border-radius: 50%;
  background: radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--g, #e8e4ff) 45%, #e8e4ff 30%), transparent 70%),
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--g, #e8e4ff) 35%, rgba(232, 228, 255, .5)) 30% 70%, transparent);
  filter: blur(6px); animation: mistdrift 1s ease-in-out both;
}
@keyframes mistdrift { from { opacity: 0; clip-path: inset(0 0 0 100%) } 30% { opacity: .9 } 65% { opacity: .75; clip-path: inset(0 0 0 0) } to { opacity: 0; clip-path: inset(0 0 0 0) } }
.mistpuff i {
  position: absolute; left: 50%; top: 55%; width: 70%; aspect-ratio: 1.3; translate: -50% -50%; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--g, #e8e4ff) 50%, rgba(232, 228, 255, .7)), transparent 68%);
  filter: blur(4px); animation: mistpuff .9s ease-out var(--delay) both;
}
.mistpuff i:nth-child(2) { left: 32%; top: 45%; width: 50%; animation-delay: calc(var(--delay) + 80ms); }
.mistpuff i:nth-child(3) { left: 68%; top: 48%; width: 46%; animation-delay: calc(var(--delay) + 140ms); }
@keyframes mistpuff { from { opacity: 0; transform: scale(.4) } 35% { opacity: .9 } to { opacity: 0; transform: scale(1.5) translateY(-14%) } }
/* the capture: blurs, swells, and drifts apart into wisps */
.ghost.vanish .piece { animation: vanish 1.2s ease-out both; }
@keyframes vanish {
  0% { filter: none; opacity: 1 }
  35% { filter: brightness(1.5) drop-shadow(0 0 10px color-mix(in srgb, var(--g) 70%, #e8e4ff)); }
  100% { filter: blur(8px) brightness(1.8); transform: scale(1.35) translateY(-12%); opacity: 0 }
}
.ghost.vanish .bit { width: 16px; height: 12px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--g) 50%, rgba(232, 228, 255, .8)), transparent 70%); filter: blur(2px); animation: wisp 1.1s ease-out var(--d) both; }
@keyframes wisp { from { opacity: 0; transform: none } 30% { opacity: .9 } to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(var(--s)) } }

/* ---- Shion: ooze ----
   The piece melts down into a puddle, the puddle slides across, and it rises again on the new square. */
.piece.arrive.m-ooze { animation: ooze calc(.8s * var(--pace, 1)) cubic-bezier(.45, 0, .3, 1) both; transform-origin: 50% 95%; }
@keyframes ooze {
  0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: none; }
  22% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) scale(1.35, .08); filter: sepia(1) hue-rotate(40deg) saturate(3) drop-shadow(0 0 8px #c6ff3d); }
  60% { transform: translate(0, 0) scale(1.35, .08); filter: sepia(1) hue-rotate(40deg) saturate(3) drop-shadow(0 0 8px #c6ff3d); }
  82% { transform: scale(.9, 1.12); filter: drop-shadow(0 0 6px #c6ff3d); }
  100% { transform: none; filter: none; }
}
.puddle::before { content: ''; position: absolute; left: 12%; right: 12%; bottom: 8%; height: 24%; border-radius: 50%; background: radial-gradient(ellipse, rgba(240, 255, 200, .8), #c6ff3d 40%, rgba(79, 122, 0, .6) 70%, transparent 72%); filter: blur(.5px) drop-shadow(0 0 6px #c6ff3d); animation: puddle .9s ease-out var(--delay) both; }
@keyframes puddle { from { opacity: 0; transform: scale(.2) } 30% { opacity: 1; transform: scale(1.1) } to { opacity: 0; transform: scale(1.3) } }

/* ---- Kyo: drag ----
   A chain lashes out, the piece is hauled across hard, and slams down. */
.piece.arrive.m-drag { animation: drag calc(.62s * var(--pace, 1)) cubic-bezier(.7, 0, .3, 1) both; }
@keyframes drag {
  0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); }
  25% { transform: translate(calc(var(--fx) * 104%), calc(var(--fy) * 104%)) rotate(-6deg); }
  70% { transform: translate(0, -18%) rotate(4deg); filter: drop-shadow(0 0 8px #d1002c); }
  80% { transform: translateY(4%) scale(1.08, .9); }
  100% { transform: none; filter: none; }
}
/* Kyo's move: the painted iron chain (public/assets/fx/kyo/chain.webp) hauls the piece across */
.streak.chain {
  height: 6.5%; clip-path: none;
  background: url(/assets/fx/kyo/chain.webp) 0 50% / auto 100% repeat-x;
  filter: drop-shadow(0 0 4px #d1002c) drop-shadow(0 2px 3px rgba(0, 0, 0, .7)); animation: lash .6s ease-out both;
}
@keyframes lash { from { opacity: 0; clip-path: inset(0 100% 0 0) } 25% { opacity: 1; clip-path: inset(0 0 0 0) } 70% { opacity: 1 } to { opacity: 0; clip-path: inset(0 0 0 100%) } }
.slam::before { content: ''; position: absolute; inset: 0; border: 3px solid #d1002c; border-radius: 50%; box-shadow: 0 0 18px #d1002c, inset 0 0 14px #d1002c; animation: shockring .55s ease-out var(--delay) both; }
.slam i { position: absolute; inset: 15% 0 auto; height: 70%; background: radial-gradient(ellipse at 50% 100%, rgba(209, 0, 44, .55), transparent 65%); animation: tint .7s ease-out var(--delay) both; }
/* Kyo's capture: wrapped in chains, squeezed, burst into iron shards */
.ghost.crush .piece { animation: crush .7s cubic-bezier(.6, 0, .4, 1) var(--delay) both; }
@keyframes crush {
  0% { transform: none; filter: none; opacity: 1 }
  45% { transform: scale(.82, 1.05); filter: grayscale(1) brightness(.6) drop-shadow(0 0 10px #d1002c); }
  70% { transform: scale(.6, 1.1); opacity: 1 }
  100% { transform: scale(.3, .2); opacity: 0; filter: grayscale(1) brightness(.3) }
}
.ghost.crush::before {
  content: ''; position: absolute; left: -8%; right: -8%; top: 45%; height: 20%; z-index: 3;
  background: url(/assets/fx/kyo/chain.webp) 0 50% / auto 100% repeat-x;
  filter: drop-shadow(0 0 4px #d1002c) drop-shadow(0 2px 2px rgba(0, 0, 0, .7)); rotate: -10deg; animation: wrap .55s ease-out var(--delay) both;
}
@keyframes wrap { from { clip-path: inset(0 100% 0 0) } 60% { clip-path: inset(0 0 0 0); opacity: 1 } to { opacity: 0 } }
/* …then the chain itself snaps: a broken link bursts apart where the piece was */
.ghost.crush::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 85%; aspect-ratio: 337 / 223; translate: -50% -50%; z-index: 4;
  background: url(/assets/fx/kyo/broken.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px #d1002c);
  animation: unchain .7s cubic-bezier(.2, .8, .2, 1) calc(var(--delay) + 420ms) both;
}
.ghost.crush .bit { width: 9px; height: 9px; background: linear-gradient(135deg, #8a8288, #2a2428); clip-path: polygon(30% 0, 100% 20%, 80% 100%, 0 70%); filter: drop-shadow(0 0 2px #d1002c); animation: shard .7s cubic-bezier(.2, .7, .4, 1) calc(var(--delay) + 450ms) both; }

/* ================= painted effect art (public/assets/fx/<character>/), layered over the effects above ================= */
/* ---- Erika: rain ---- */
.piece.arrive.m-rain { animation: rainmove calc(.7s * var(--pace, 1)) cubic-bezier(.45, 0, .3, 1) both; }
@keyframes rainmove { 0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); opacity: 1 } 40% { opacity: .55; filter: blur(1px) brightness(1.2) } 100% { transform: none; opacity: 1; filter: none } }
.ripple { background: url(/assets/fx/erika/ripple.webp) 50% 80% / 95% auto no-repeat; animation: rippleout .9s ease-out var(--delay) both; }
@keyframes rippleout { from { opacity: 0; transform: scale(.4) } 25% { opacity: 1 } to { opacity: 0; transform: scale(1.4) } }
.splashfx { background: url(/assets/fx/erika/splash.webp) 50% 90% / 80% auto no-repeat; transform-origin: 50% 90%; animation: splashup .7s ease-out var(--delay) both; }
@keyframes splashup { from { opacity: 0; transform: scaleY(.2) } 35% { opacity: 1; transform: scaleY(1) } to { opacity: 0; transform: scaleY(1.1) translateY(-6%) } }
.frost.rainpool { background: url(/assets/fx/erika/puddle.webp) 50% 70% / 90% auto no-repeat; opacity: calc(.3 + var(--left) * .6); }
.ghost.drip .piece { animation: dripmelt 1.1s ease-in both; transform-origin: 50% 100%; }
@keyframes dripmelt { 0% { filter: none } 40% { filter: saturate(.4) brightness(1.3) blur(1px); transform: scaleY(.85) } 100% { filter: blur(3px); transform: scale(.4, .2); opacity: 0 } }
.ghost.drip::after { content: ''; position: absolute; left: 50%; top: 30%; width: 22%; aspect-ratio: 81 / 167; translate: -50% 0; background: url(/assets/fx/erika/drop.webp) center / contain no-repeat; animation: dropfall 1.1s cubic-bezier(.5, 0, .9, .5) .35s both; }
@keyframes dropfall { from { opacity: 0; transform: scale(.4) } 20% { opacity: 1; transform: none } to { opacity: 0; transform: translateY(160%) } }
.sq.flooded::after { content: ''; position: absolute; inset: 8%; z-index: 0; pointer-events: none; background: url(/assets/fx/erika/puddle.webp) center / contain no-repeat; opacity: .85; animation: puddleshine 2s ease-in-out infinite alternate; }
.sq.flooded::before { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; background: url(/assets/fx/erika/rain.webp) 0 0 / 100% auto repeat-y; opacity: .28; mix-blend-mode: screen; animation: rainscroll .6s linear infinite; }
@keyframes puddleshine { to { filter: brightness(1.25) } }
@keyframes rainscroll { to { background-position: 0 100% } }
.u-flood .raindim { inset: 0; background: rgba(10, 18, 32, .5); animation: tint 2s ease-out both; }
.u-flood .rainfall { inset: 0; background: url(/assets/fx/erika/rain.webp) 0 0 / 50% auto repeat; opacity: .45; mix-blend-mode: screen; animation: rainscroll .5s linear infinite, tint 2s ease-out both; }
.u-flood .cloudart { left: 50%; top: -4%; width: 90%; aspect-ratio: 388 / 180; translate: -50% 0; background: url(/assets/fx/erika/cloud.webp) center / contain no-repeat; animation: cloudin 2s ease-out both; }
@keyframes cloudin { from { opacity: 0; transform: translateY(-30%) } 25% { opacity: 1; transform: none } 80% { opacity: 1 } to { opacity: 0 } }
.u-flood .flash { inset: 0; background: rgba(220, 235, 255, .7); opacity: 0; animation: lflash .5s steps(2) .6s 1; }
@keyframes lflash { 0% { opacity: .8 } 50% { opacity: 0 } 70% { opacity: .5 } 100% { opacity: 0 } }
.u-flood .floodin { width: 13%; aspect-ratio: 294 / 130; translate: -50% -50%; background: url(/assets/fx/erika/puddle.webp) center / contain no-repeat; animation: floodin .8s ease-out var(--d) both; }
@keyframes floodin { from { opacity: 0; transform: scale(.2) } to { opacity: 1; transform: none } }

/* ---- Melati: songket gold ---- */
.piece.arrive.m-weave { animation: weavemove calc(.75s * var(--pace, 1)) cubic-bezier(.4, 0, .25, 1) both; }
@keyframes weavemove { from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: drop-shadow(0 0 8px #e3b23c) } 80% { filter: drop-shadow(0 0 8px #e3b23c) } to { transform: none; filter: none } }
.streak.thread { height: 9%; background: url(/assets/fx/melati/thread.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px #e3b23c); }
.jasmine { background: url(/assets/fx/melati/jasmine.webp) center / 110% auto no-repeat; animation: jasmine 1.1s ease-out var(--delay) both; }
@keyframes jasmine { from { opacity: 0; transform: scale(.2) rotate(-40deg) } 35% { opacity: 1; transform: scale(1) rotate(0) } to { opacity: 0; transform: scale(1.2) rotate(15deg) } }
.ghost.slash .piece { animation: slashed .9s ease-in both; }
@keyframes slashed { 0%, 35% { clip-path: none; transform: none } 40% { clip-path: polygon(0 0, 100% 0, 100% 40%, 0 60%); transform: translate(-4%, -6%) } 100% { clip-path: polygon(0 0, 100% 0, 100% 40%, 0 60%); transform: translate(-20%, -30%) rotate(-12deg); opacity: 0 } }
.ghost.slash::after { content: ''; position: absolute; left: 50%; top: 50%; width: 110%; aspect-ratio: 290 / 245; translate: -50% -50%; background: url(/assets/fx/melati/keris.webp) center / contain no-repeat; filter: drop-shadow(0 0 8px #e3b23c); animation: kerisflash .5s ease-out .15s both; }
@keyframes kerisflash { from { opacity: 0; transform: translate(-40%, -40%) rotate(-20deg) } 40% { opacity: 1 } to { opacity: 0; transform: translate(30%, 30%) rotate(5deg) } }
.sq.bonded::after { content: ''; position: absolute; right: 2%; top: 2%; width: 44%; aspect-ratio: 284 / 93; z-index: 4; pointer-events: none; background: url(/assets/fx/melati/knot.webp) center / contain no-repeat; filter: drop-shadow(0 0 4px #e3b23c); }
.bondline { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4; pointer-events: none; overflow: visible; }
.bondline line { stroke: #e3b23c; stroke-width: .7; stroke-dasharray: 2 1; filter: drop-shadow(0 0 1.5px #e3b23c); animation: threadshimmer 1.2s linear infinite; }
@keyframes threadshimmer { to { stroke-dashoffset: -6 } }
.u-bond .golddim, .u-snap .golddim { inset: 0; background: radial-gradient(circle, rgba(227, 178, 60, .18), rgba(40, 10, 14, .45) 70%); animation: tint 2s ease-out both; }
.ultfx .tie { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ultfx .tie line { stroke: #ffe39a; stroke-width: 1; filter: drop-shadow(0 0 2px #e3b23c); stroke-dasharray: 200; stroke-dashoffset: 200; animation: tiedraw .6s ease-out .2s forwards; }
@keyframes tiedraw { to { stroke-dashoffset: 0 } }
.u-snap .tie line { animation: none; stroke-dashoffset: 0; opacity: 0; }
.ultfx .knot { width: 16%; aspect-ratio: 284 / 93; translate: -50% -50%; z-index: 2; background: url(/assets/fx/melati/knot.webp) center / contain no-repeat; filter: drop-shadow(0 0 8px #e3b23c); animation: knotin .6s cubic-bezier(.3, 1.5, .5, 1) var(--d) both, fadeout .4s ease-in 1.5s forwards; }
.ultfx .knot.snapped { width: 30%; aspect-ratio: 554 / 115; background-image: url(/assets/fx/melati/knot-snapped.webp); animation: knotin .4s ease-out both, fadeout .4s ease-in .7s forwards; }
@keyframes knotin { from { opacity: 0; transform: scale(2) } to { opacity: 1; transform: none } }
.u-bond .loomart { left: 50%; bottom: -4%; width: 40%; aspect-ratio: 356 / 332; translate: -50% 0; background: url(/assets/fx/melati/loom.webp) center / contain no-repeat; opacity: .55; animation: cloudin 2s ease-out both; }

/* ---- Rai: lightning. The piece vanishes in a flash and strikes down onto its new square as a bolt ---- */
/* Rai's piece jumps square by square: --steps jumps over --steps × 110ms (paced), then a crackle as it lands */
.piece.arrive.m-bolt { --step: calc(110ms * var(--pace, 1)); animation: zapsteps calc(var(--steps) * var(--step)) steps(var(--steps), end) both, zapland calc(.45s * var(--pace, 1)) ease-out calc(var(--steps) * var(--step)) both; }
@keyframes zapsteps { from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: brightness(2.2) drop-shadow(0 0 10px #3d7bff) } to { transform: none; filter: brightness(2.2) drop-shadow(0 0 10px #3d7bff) } }
@keyframes zapknight {
  0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); animation-timing-function: steps(2, end); filter: brightness(2.2) drop-shadow(0 0 10px #3d7bff) }
  66.7% { transform: translate(calc(var(--kx) * 100%), calc(var(--ky) * 100%)); animation-timing-function: steps(1, end) }
  100% { transform: none; filter: brightness(2.2) drop-shadow(0 0 10px #3d7bff) }
}
.piece.arrive.m-bolt.knightpath { animation-name: zapknight, zapland; animation-timing-function: linear, ease-out; }
@keyframes zapland { from { filter: brightness(2.2) drop-shadow(0 0 12px #3d7bff) } 40% { transform: scaleY(1.12) translateY(-4%) } to { filter: none } }
/* the thin bolt from square to square, and a small crackle on each square it passes */
.streak.raiseg { height: 7%; clip-path: none; background: url(/assets/fx/rai/arc.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 5px #3d7bff); mix-blend-mode: screen; animation: raiseg .38s ease-out var(--delay, 0ms) both; }
@keyframes raiseg { from { opacity: 0; clip-path: inset(0 0 0 100%) } 30% { opacity: 1; clip-path: inset(0) } to { opacity: 0 } }
.zapdot { background: url(/assets/fx/rai/burst.webp) center / 55% auto no-repeat; mix-blend-mode: screen; animation: zapdot .32s ease-out var(--delay) both; }
@keyframes zapdot { from { opacity: 0; transform: scale(.4) } 40% { opacity: 1 } to { opacity: 0; transform: scale(1.1) } }
@keyframes boltland { 0%, 39% { filter: brightness(3) drop-shadow(0 0 14px #3d7bff) } 40% { transform: scaleY(1.25) translateY(-6%) } 60% { transform: none } 100% { filter: none } }

.boltdown { top: auto; overflow: visible; }
.boltdown::before { content: ''; position: absolute; left: 50%; bottom: 40%; width: 70%; height: 300%; translate: -50% 0; background: url(/assets/fx/rai/bolt.webp) center bottom / 100% 100% no-repeat; mix-blend-mode: screen; filter: drop-shadow(0 0 10px #3d7bff); animation: boltstrike .45s ease-out var(--delay) both; }
/* ---- Akane: the blink of an eye. The piece vanishes, a crimson eye glints, and it's simply there ---- */
.piece.arrive.m-blink { animation: blinkmove calc(.6s * var(--pace, 1)) ease-out both; }
@keyframes blinkmove { 0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); opacity: 1; filter: none } 30% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) scaleX(.05); opacity: 0 } 45% { transform: scaleX(.05); opacity: 0 } 70% { transform: scaleX(1.1); opacity: 1; filter: drop-shadow(0 0 10px #ff3b5c) } 100% { transform: none; filter: none } }
.blinkeye { left: -20%; right: -20%; width: auto; background: url(/assets/fx/akane/eye.webp) left center / 46% auto no-repeat, url(/assets/fx/akane/eye.webp) right center / 46% auto no-repeat; mix-blend-mode: screen; animation: blinkeye .5s ease-out var(--delay) both; }
@keyframes blinkeye { from { opacity: 0; transform: scaleY(0) } 40% { opacity: 1; transform: scaleY(1) } to { opacity: 0; transform: scaleY(0) } }
.ghost.seen .piece { animation: seen .9s ease-in both; }
@keyframes seen { 0%, 40% { filter: drop-shadow(0 0 10px #ff3b5c) } 100% { filter: brightness(2) blur(2px); opacity: 0; transform: scale(1.15) } }
.ghost.seen::after { content: ''; position: absolute; inset: 0; background: url(/assets/fx/akane/ring.webp) center / 90% auto no-repeat; filter: drop-shadow(0 0 8px #ff3b5c); animation: seenring .9s ease-out both; }
@keyframes seenring { 0% { opacity: 0; transform: scale(2) } 35% { opacity: 1; transform: none; background-image: url(/assets/fx/akane/ring.webp) } 60% { background-image: url(/assets/fx/akane/ring-broken.webp) } 100% { opacity: 0; transform: scale(1.3); background-image: url(/assets/fx/akane/ring-broken.webp) } }
/* ---- Yuki: the piece melts into falling snow, and drifts down onto its new square ---- */
.piece.arrive.m-snow { animation: snowmove calc(.85s * var(--pace, 1)) ease-out both; }
@keyframes snowmove { 0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); opacity: 1; filter: none } 30% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100% + 10%)); opacity: 0; filter: blur(3px) brightness(1.8) } 40% { transform: translateY(-70%); opacity: 0 } 100% { transform: none; opacity: 1; filter: none } }
.snowpuff { background: url(/assets/fx/yuki/flakes.webp) center / auto 110% no-repeat; filter: drop-shadow(0 0 6px #8ff0ff); animation: snowpuff .9s ease-out var(--delay) both; }
@keyframes snowpuff { from { opacity: 0; transform: translateY(-30%) } 30% { opacity: 1 } to { opacity: 0; transform: translateY(20%) } }
/* the targets you've picked for a rival's ultimate */
.sq.picked { box-shadow: inset 0 0 0 3px var(--cw, #fff), inset 0 0 24px var(--cw, #fff); }
/* Akane's path: your moves in crimson, their replies faded */
.calcarrows.path .carrow.mine { filter: hue-rotate(180deg) saturate(2.2) drop-shadow(0 0 8px #ff3b5c); opacity: 1; }
.calcarrows.path .carrow.theirs { filter: grayscale(1) brightness(.8); opacity: .5; animation: none; }
.calcarrows.path .cbadge.mine b { color: #ff3b5c; text-shadow: 0 0 6px #ff3b5c; }
.calcarrows.path .cbadge.mine { filter: hue-rotate(180deg) saturate(2); }
.calcarrows.path .cbadge.theirs { filter: grayscale(1); opacity: .6; }
.calcarrows.path .cbadge.theirs b { color: #ccc; text-shadow: none; }

/* ---- Rai (old dash streak, kept for the cut-in) ---- */
.streak.zap { height: 12%; background: url(/assets/fx/rai/streak.webp) right center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px #3d7bff); }
.zapburst { background: url(/assets/fx/rai/burst.webp) center / 120% auto no-repeat; mix-blend-mode: screen; animation: goldburst .55s ease-out var(--delay) both; }
.frost.scorch { background: url(/assets/fx/rai/scorch.webp) center / 95% auto no-repeat; opacity: calc(.3 + var(--left) * .65); }
.ghost.zapped .piece { animation: zapped .6s steps(3) both; }
@keyframes zapped { 0% { filter: brightness(3) drop-shadow(0 0 12px #3d7bff) } 50% { filter: invert(1) brightness(2) } 100% { filter: brightness(3); opacity: 0; transform: scale(1.2) } }
.ghost.zapped::after { content: ''; position: absolute; left: 50%; top: 50%; width: 130%; aspect-ratio: 243 / 238; translate: -50% -50%; background: url(/assets/fx/rai/burst.webp) center / contain no-repeat; mix-blend-mode: screen; animation: pixelburst .55s ease-out .1s both; }
.u-chain .stormdim { inset: 0; background: radial-gradient(circle, rgba(61, 123, 255, .15), rgba(4, 8, 24, .6) 70%); animation: tint 1.7s ease-out both; }
.u-chain .zbolt { top: 0 !important; width: 14%; translate: -50% 0; background: url(/assets/fx/rai/bolt.webp) center bottom / 100% 100% no-repeat; filter: drop-shadow(0 0 14px #3d7bff); mix-blend-mode: screen; animation: boltstrike .7s ease-out both; }
.u-chain .zring { width: 16%; aspect-ratio: 1; translate: -50% -50%; background: url(/assets/fx/rai/ring.webp) center / contain no-repeat; mix-blend-mode: screen; animation: knotin .4s ease-out var(--d) both, fadeout .4s ease-in 1.2s forwards; }
.u-chain .zarc { height: 7%; translate: 0 -50%; transform-origin: 0 50%; rotate: var(--angle); background: url(/assets/fx/rai/arc.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 8px #3d7bff); mix-blend-mode: screen; animation: zarc .5s steps(3) .35s both, fadeout .4s ease-in 1.2s forwards; }
@keyframes zarc { from { opacity: 0; clip-path: inset(0 100% 0 0) } to { opacity: 1; clip-path: inset(0) } }

/* ---- AI-0: glitch and delete ---- */
.piece.arrive.m-glitch { animation: glitchmove calc(.55s * var(--pace, 1)) steps(5) both; }
@keyframes glitchmove { 0% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); opacity: 1 } 30% { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)) skewX(20deg); opacity: .3 } 50% { transform: translate(calc(var(--fx) * 50%), calc(var(--fy) * 50%)); opacity: 0 } 70% { transform: skewX(-15deg); opacity: .6; filter: hue-rotate(60deg) } 100% { transform: none; opacity: 1; filter: none } }
.glitchfx { background: url(/assets/fx/ai/glitch.webp) center / 120% auto no-repeat; mix-blend-mode: screen; animation: glitchflick .45s steps(4) var(--delay) both; }
@keyframes glitchflick { 0% { opacity: 0 } 25% { opacity: 1; transform: translateX(-8%) } 50% { opacity: .4; transform: translateX(10%) } 75% { opacity: .9; transform: none } 100% { opacity: 0 } }
.ghost.delete .piece { animation: deleted .8s steps(6) both; }
@keyframes deleted { 0% { filter: none; clip-path: inset(0) } 50% { filter: hue-rotate(90deg) brightness(1.4); clip-path: inset(0 0 40% 0) } 100% { clip-path: inset(0 0 100% 0); opacity: 0 } }
.ghost.delete::after { content: ''; position: absolute; left: 50%; top: 50%; width: 120%; aspect-ratio: 312 / 281; translate: -50% -50%; background: url(/assets/fx/ai/pixels.webp) center / contain no-repeat; animation: pixelburst .8s ease-out .2s both; }
@keyframes pixelburst { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1 } to { opacity: 0; transform: scale(1.4) } }
.calcarrows { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.carrow { position: absolute; height: 7%; translate: 0 -50%; transform-origin: 0 50%; rotate: var(--angle); background: url(/assets/fx/ai/arrow.webp) right center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px #00e5c7) saturate(1.3); opacity: .9; animation: carrow 1.4s ease-in-out infinite alternate; }
@keyframes carrow { from { opacity: .55 } to { opacity: 1 } }
.cbadge { position: absolute; width: 8%; aspect-ratio: 235 / 120; translate: -50% -130%; background: url(/assets/fx/ai/badge.webp) center / contain no-repeat; display: grid; place-items: center; }
.cbadge b { font-family: var(--serif); font-weight: 900; font-size: clamp(10px, 1.6vh, 15px); color: #00e5c7; text-shadow: 0 0 6px #00e5c7; }
.u-calc .scan { inset: 0; background: url(/assets/fx/ai/target.webp) center / 100% 100% no-repeat; opacity: .5; animation: scan 1.8s ease-out both; }
@keyframes scan { from { opacity: 0; transform: scale(1.3) } 25% { opacity: .6; transform: none } 80% { opacity: .5 } to { opacity: 0 } }
.u-calc .loading { left: 50%; top: 50%; width: 34%; aspect-ratio: 1; translate: -50% -50%; background: url(/assets/fx/ai/ring.webp) center / contain no-repeat; filter: drop-shadow(0 0 12px #00e5c7); animation: spin 1s linear infinite, cloudin 1.9s ease-out both; }
@keyframes spin { to { rotate: 360deg } }
.u-calc .panelart { right: 2%; bottom: 3%; width: 42%; aspect-ratio: 298 / 162; background: url(/assets/fx/ai/panel.webp) center / contain no-repeat; animation: cloudin 1.9s ease-out .2s both; }
/* Haru: moss on his trail, a sprout where his piece rises, a wilting flower for his captures;
   Bloom: painted vines frame the board and a flower opens on the revived piece */
.frost.bloom { background: url(/assets/fx/haru/moss.webp) center / 100% 100% no-repeat; }
.sprout::after { content: ''; position: absolute; left: 50%; bottom: 6%; width: 46%; aspect-ratio: 124 / 153; translate: -50% 0; background: url(/assets/fx/haru/sprout.webp) center bottom / contain no-repeat; transform-origin: 50% 100%; animation: sproutup .7s ease-out both; }
@keyframes sproutup { from { opacity: 0; transform: scale(.2) } 40% { opacity: 1; transform: scale(1.05) } to { opacity: 0; transform: scale(.9) } }
.petals:not(.venom)::before { content: ''; position: absolute; left: 50%; top: 40%; width: 170%; aspect-ratio: 661 / 215; translate: -50% -50%; background: url(/assets/fx/haru/petals.webp) center / contain no-repeat; animation: petalpuff 1s ease-out both; }
@keyframes petalpuff { from { opacity: 0; transform: scale(.4) } 30% { opacity: 1 } to { opacity: 0; transform: scale(1.2) translateY(-15%) } }
.ghost.wilt::after { content: ''; position: absolute; left: 50%; bottom: 4%; width: 70%; aspect-ratio: 219 / 229; translate: -50% 0; background: url(/assets/fx/haru/wilt.webp) center bottom / contain no-repeat; transform-origin: 50% 100%; animation: wiltart 1.3s ease-in both; }
@keyframes wiltart { from { opacity: 0; transform: scaleY(.3) } 30% { opacity: 1; transform: none } 75% { opacity: 1; transform: rotate(-6deg) } to { opacity: 0; transform: rotate(-12deg) translateY(10%) } }
.u-revive .vineart { left: -4%; right: -4%; height: 13%; background: url(/assets/fx/haru/vine.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 8px #4dff9b); animation: vinegrow 2s ease-out both; }
.u-revive .vineart.top { top: -2%; } .u-revive .vineart.bottom { bottom: -2%; transform: scaleY(-1); }
@keyframes vinegrow { from { opacity: 0; clip-path: inset(0 100% 0 0) } 35% { opacity: 1; clip-path: inset(0 0 0 0) } 80% { opacity: 1 } to { opacity: 0 } }
.u-revive .bloomart { left: var(--x); top: var(--y); width: 22%; aspect-ratio: 343 / 347; translate: -50% -50%; background: url(/assets/fx/haru/flower.webp) center / contain no-repeat; filter: drop-shadow(0 0 14px #4dff9b); animation: bloomart 1.8s ease-out .3s both; }
@keyframes bloomart { from { opacity: 0; transform: scale(.1) rotate(-60deg) } 35% { opacity: 1; transform: scale(1.1) rotate(0) } 75% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.3) } }
.u-revive .flower i, .u-revive .flower b { display: none; }

/* Kaito: an amber dash streak, cracked ground and a golden burst where he lands, captures knocked out in a starburst;
   Crown Grab: a painted bolt strikes and a golden crown drops onto the pawn */
.streak.charge { height: 10%; background: url(/assets/fx/kaito/streak.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px #ffb020); }
.frost.crack { background: url(/assets/fx/kaito/cracks.webp) center / 110% auto no-repeat; }
.impact::after { content: ''; position: absolute; left: 50%; top: 50%; width: 120%; aspect-ratio: 332 / 258; translate: -50% -50%; background: url(/assets/fx/kaito/burst.webp) center / contain no-repeat; animation: goldburst .55s ease-out both; }
@keyframes goldburst { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.25) } }
.ghost.knockout::after { content: ''; position: absolute; left: 50%; top: 45%; width: 110%; aspect-ratio: 289 / 178; translate: -50% -50%; background: url(/assets/fx/kaito/sparkburst.webp) center / contain no-repeat; animation: goldburst .6s ease-out var(--delay) both; }
.u-promote .boltart { left: var(--x); top: 0; height: var(--y); aspect-ratio: 182 / 626; translate: -50% 0; background: url(/assets/fx/kaito/bolt.webp) center bottom / 100% 100% no-repeat; filter: drop-shadow(0 0 14px #ffb020); animation: boltstrike .7s ease-out both; }
@keyframes boltstrike { from { opacity: 0; clip-path: inset(0 0 100% 0) } 20% { opacity: 1; clip-path: inset(0 0 0 0) } 60% { opacity: 1 } to { opacity: 0 } }
.u-promote .ultfx .bolt, .u-promote .bolt { opacity: 0; } /* the painted bolt replaces the drawn one */
.u-promote .crowndrop { left: var(--x); top: var(--y); width: 15%; aspect-ratio: 275 / 315; translate: -50% -90%; z-index: 2; background: url(/assets/fx/kaito/crown.webp) center / contain no-repeat; filter: drop-shadow(0 0 12px #ffcf4a); animation: crowndrop 1.5s cubic-bezier(.3, 1.4, .5, 1) .45s both; }
@keyframes crowndrop { from { opacity: 0; transform: translateY(-120%) } 40% { opacity: 1; transform: none } 80% { opacity: 1 } to { opacity: 0; transform: scale(.8) } }
.u-promote .crownmark { display: none; }

/* Shion: a venom puddle as she oozes, her trail a little poison pool, captures dissolve in bubbles;
   Venom Kiss: green fog rolls in, venom drips from the top edge, and a kiss mark lands on each target */
.puddle::before { left: 0; right: 0; bottom: 4%; height: 46%; border-radius: 0; background: url(/assets/fx/shion/puddle.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px #c6ff3d); }
.frost.venom { background: url(/assets/fx/shion/puddle.webp) center / 80% auto no-repeat; }
.ghost.dissolve::after { content: ''; position: absolute; left: 50%; bottom: 10%; width: 60%; aspect-ratio: 253 / 402; translate: -50% 0; background: url(/assets/fx/shion/bubbles.webp) center bottom / contain no-repeat; animation: bubblerise 1.4s ease-out .2s both; }
@keyframes bubblerise { from { opacity: 0; transform: translateY(30%) scale(.6) } 30% { opacity: 1 } to { opacity: 0; transform: translateY(-40%) scale(1) } }
.u-poison .fogart, .u-wither .fogart { left: -15%; right: -15%; bottom: -4%; height: 45%; background: url(/assets/fx/shion/fog.webp) center bottom / 100% 100% no-repeat; opacity: .8; animation: fogroll 1.8s ease-out both; }
@keyframes fogroll { from { opacity: 0; transform: translateX(-15%) } 30% { opacity: .85 } to { opacity: 0; transform: translateX(10%) } }
.u-poison .dripsart { left: 20%; right: 20%; top: -2%; height: 26%; background: url(/assets/fx/shion/drips.webp) center top / 100% 100% no-repeat; transform-origin: 50% 0; animation: drips 1.7s ease-in both; }
@keyframes drips { from { opacity: 0; transform: scaleY(.2) } 30% { opacity: 1; transform: scaleY(1) } 80% { opacity: 1; transform: scaleY(1.15) } to { opacity: 0 } }
.u-poison .kiss { width: 11%; aspect-ratio: 213 / 150; translate: -50% -50%; z-index: 2; background: url(/assets/fx/shion/kiss.webp) center / contain no-repeat; filter: drop-shadow(0 0 8px #c6ff3d); animation: kiss .6s cubic-bezier(.3, 1.6, .5, 1) var(--d) both, fadeout .4s ease-in 1.4s forwards; }
@keyframes kiss { from { opacity: 0; transform: scale(2.2) rotate(-15deg) } to { opacity: 1; transform: rotate(-8deg) } }

/* ================= (Mio, Jun, Yuki, Sena, Noa, Shin, Akane below) ================= */
/* Mio: a wall of pink flame rises along the bottom, the target catches fire, embers drift up; burned pieces leave ash */
.u-burn .flamewall { left: -5%; right: -5%; bottom: -3%; height: 34%; background: url(/assets/fx/mio/flames.webp) 0 100% / auto 100% repeat-x; transform-origin: 50% 100%; filter: drop-shadow(0 0 10px #ff3d7a); animation: flamerise 1.6s ease-out both; }
@keyframes flamerise { from { opacity: 0; transform: scaleY(0) } 25% { opacity: 1; transform: scaleY(1.08) } 75% { opacity: 1; transform: scaleY(.95) } to { opacity: 0; transform: scaleY(.6) } }
.u-burn .tflame { left: var(--x); top: var(--y); width: 11%; aspect-ratio: 145 / 230; translate: -50% -70%; background: url(/assets/fx/mio/flame.webp) center / contain no-repeat; transform-origin: 50% 100%; filter: drop-shadow(0 0 12px #ff3d7a); animation: tflame 1.3s ease-out .25s both; }
@keyframes tflame { from { opacity: 0; transform: scale(.2) } 30% { opacity: 1; transform: scale(1.15) } 70% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(.7) translateY(-20%) } }
.u-burn .embers { inset: 10% 5% 20%; background: url(/assets/fx/mio/embers.webp) center / contain no-repeat; animation: driftup 1.7s ease-out .2s both; }
@keyframes driftup { from { opacity: 0; transform: translateY(15%) } 30% { opacity: 1 } to { opacity: 0; transform: translateY(-20%) } }
.ghost.burn::after { content: ''; position: absolute; left: 50%; bottom: 4%; width: 82%; aspect-ratio: 171 / 70; translate: -50% 0; background: url(/assets/fx/mio/ash.webp) center bottom / contain no-repeat; transform-origin: 50% 100%; animation: ashpile 1.5s ease-out both; }
@keyframes ashpile { from { opacity: 0; transform: scaleY(0) } 45% { opacity: 0 } 70% { opacity: 1; transform: scaleY(1) } to { opacity: 0 } }
/* Mio's capture: a real pink "poof" */
.ghost.poof::after { content: ''; position: absolute; left: 50%; top: 45%; width: 105%; aspect-ratio: 227 / 210; translate: -50% -50%; background: url(/assets/fx/mio/puff.webp) center / contain no-repeat; animation: puff .7s ease-out var(--delay) both; }
@keyframes puff { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.35) } }

/* Jun: a real die tumbles in before his roll lands; chips scatter, sparkle on a win, a cracked chip on a loss */
.u-gamble .tumble { left: 50%; top: 50%; width: 20%; aspect-ratio: 213 / 195; translate: -50% -50%; background: url(/assets/fx/jun/die-tumble.webp) center / contain no-repeat; animation: dieroll 1.05s cubic-bezier(.25, .6, .35, 1) both, diefade .1s linear 1.05s forwards; z-index: 1; }
.u-gamble .die { background: radial-gradient(circle at 30% 25%, #3a3a46, #0d0d12 70%); box-shadow: 0 16px 30px rgba(0, 0, 0, .55), inset 0 0 0 3px #c9a74a, inset 0 0 0 5px #0d0d12, 0 0 30px rgba(232, 232, 248, .4); opacity: 0; animation: dieroll 1.25s cubic-bezier(.25, .6, .35, 1) both, dieshow .1s linear 1.05s forwards, diefade .4s ease-in 1.9s forwards; }
@keyframes dieshow { to { opacity: 1 } }
.u-gamble .die i { background: radial-gradient(circle at 35% 35%, #fff, #b9b9c8 60%, #6a6a78); }
.u-gamble .rollfx { left: 50%; top: 50%; translate: -50% -50%; opacity: 0; animation: rollfx 1s ease-out 1.15s both; }
.u-gamble .rollfx.good { width: 62%; aspect-ratio: 336 / 296; background: url(/assets/fx/jun/sparkle.webp) center / contain no-repeat; }
.u-gamble .rollfx.bad { width: 22%; aspect-ratio: 162 / 210; translate: -50% 10%; background: url(/assets/fx/jun/chip-burnt.webp) center / contain no-repeat; }
@keyframes rollfx { from { opacity: 0; transform: scale(.5) } 30% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.15) } }
.chips::before { content: ''; position: absolute; left: 50%; bottom: -6%; width: 70%; aspect-ratio: 272 / 217; translate: -50% 0; background: url(/assets/fx/jun/chips.webp) center / contain no-repeat; animation: chipsland .9s ease-out var(--delay) both; }
@keyframes chipsland { from { opacity: 0; transform: translateY(-30%) scale(.6) } 25% { opacity: 1; transform: none } 70% { opacity: 1 } to { opacity: 0 } }
/* Jun's capture: the piece becomes a card that flips edge-on and spins away */
.ghost.cardflip::after { content: ''; position: absolute; left: 50%; top: 50%; width: 52%; aspect-ratio: 156 / 245; translate: -50% -50%; background: url(/assets/fx/jun/card.webp) center / contain no-repeat; animation: cardaway .8s cubic-bezier(.4, 0, .6, 1) calc(var(--delay) + 150ms) both; }
@keyframes cardaway { from { opacity: 0; transform: scale(.6) } 20% { opacity: 1; transform: none } 55% { transform: rotateY(90deg) } to { opacity: 0; transform: rotateY(180deg) translate(60%, -80%) rotate(25deg) scale(.7) } }

/* Yuki: frost tile on her trail, an ice splash on landing; captures freeze in a block and shatter;
   Blizzard: icicles grow in from every edge and a snow swirl blows across */
.frost.ice { background: url(/assets/fx/yuki/frost.webp) center / 100% 100% no-repeat; mix-blend-mode: screen; }
.icesplash { background: url(/assets/fx/yuki/splash.webp) 50% 100% / 110% auto no-repeat; animation: icesplash .75s ease-out both; }
@keyframes icesplash { from { opacity: 0; transform: scale(.5) translateY(20%) } 30% { opacity: 1; transform: scale(1.05) } to { opacity: 0; transform: scale(1.2) } }
.ghost.freeze::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 80%; aspect-ratio: 201 / 277; translate: -50% -50%;
  background: url(/assets/fx/yuki/block.webp) center / contain no-repeat; opacity: 0; animation: iceblock 1.3s ease-out var(--delay) both;
}
@keyframes iceblock {
  0% { opacity: 0; transform: scale(1.3); background-image: url(/assets/fx/yuki/block.webp) }
  18% { opacity: .85; transform: scale(1) }
  58% { opacity: .85; background-image: url(/assets/fx/yuki/block.webp) }
  60% { opacity: 1; transform: scale(1.25); background-image: url(/assets/fx/yuki/block-shatter.webp) }
  100% { opacity: 0; transform: scale(1.5); background-image: url(/assets/fx/yuki/block-shatter.webp) }
}
.u-freeze .icicles { background: url(/assets/fx/yuki/icicles.webp) 0 0 / auto 100% repeat-x; filter: drop-shadow(0 0 6px #8ff0ff); animation: icegrow 1.8s ease-out both; }
.u-freeze .icicles.top { left: 0; right: 0; top: 0; height: 12%; transform-origin: 50% 0; }
.u-freeze .icicles.bottom { left: 0; right: 0; bottom: 0; height: 12%; transform-origin: 50% 0; rotate: 180deg; }
.u-freeze .icicles.left { left: 0; top: 50%; width: 100%; height: 12%; transform-origin: 0 0; rotate: -90deg; translate: 0 50%; top: 100%; }
.u-freeze .icicles.right { right: 0; top: 0; width: 100%; height: 12%; transform-origin: 100% 0; rotate: 90deg; translate: 0 -100%; }
@keyframes icegrow { from { opacity: 0; clip-path: inset(0 0 100% 0) } 30% { opacity: 1; clip-path: inset(0 0 0 0) } 80% { opacity: 1 } to { opacity: 0 } }
.u-freeze .swirl { left: -40%; top: 25%; width: 140%; aspect-ratio: 574 / 179; background: url(/assets/fx/yuki/swirl.webp) center / contain no-repeat; opacity: .8; animation: swirl 1.8s ease-in-out both; }
@keyframes swirl { from { opacity: 0; transform: translateX(-20%) } 30% { opacity: .85 } to { opacity: 0; transform: translateX(35%) } }
.u-freeze .flake { background: url(/assets/fx/yuki/snowflake.webp) center / contain no-repeat; width: 4.5%; }

/* Sena: her painted crack bursts from the target, the crown cracks and falls; glide trail and glint; captures shatter into real glass */
.u-demote .crackimg { left: var(--x); top: var(--y); width: 60%; aspect-ratio: 308 / 303; translate: -50% -50%; background: url(/assets/fx/sena/crack.webp) center / contain no-repeat; mix-blend-mode: screen; animation: crackimg 1.6s ease-out both; }
@keyframes crackimg { from { opacity: 0; transform: scale(.2) } 15% { opacity: 1; transform: scale(1) } 75% { opacity: 1 } to { opacity: 0 } }
.u-demote .crownfall { left: var(--x); top: var(--y); width: 18%; aspect-ratio: 252 / 182; translate: -50% -120%; z-index: 2; background: url(/assets/fx/sena/crown.webp) center / contain no-repeat; filter: drop-shadow(0 0 10px #4a7dff); animation: crownfall 1.5s ease-in both; }
@keyframes crownfall {
  0% { opacity: 0; transform: translateY(-40%); background-image: url(/assets/fx/sena/crown.webp) }
  20% { opacity: 1; transform: none }
  45% { background-image: url(/assets/fx/sena/crown.webp) }
  46% { background-image: url(/assets/fx/sena/crown-broken.webp); transform: scale(1.1) }
  100% { opacity: 0; transform: translateY(90%) rotate(14deg); background-image: url(/assets/fx/sena/crown-broken.webp) }
}
.u-demote .ring { rotate: 0deg; border: 0; box-shadow: none; width: 30%; aspect-ratio: 334 / 117; background: url(/assets/fx/sena/ring.webp) center / contain no-repeat; translate: -50% -10%; }
.streak.glass { height: 5%; background: url(/assets/fx/sena/trail.webp) center / 100% 100% no-repeat; }
.glint::before { inset: 10% 15% 30%; width: auto; height: auto; translate: none; background: url(/assets/fx/sena/glint.webp) center / contain no-repeat; animation-name: glintimg; }
.glint::after { display: none; }
@keyframes glintimg { from { opacity: 0; transform: scale(.2) rotate(-30deg) } 35% { opacity: 1; transform: scale(1.1) rotate(0) } to { opacity: 0; transform: scale(.6) } }
.ghost.shatter::after { content: ''; position: absolute; left: 50%; top: 45%; width: 120%; aspect-ratio: 384 / 306; translate: -50% -50%; background: url(/assets/fx/sena/shards.webp) center / contain no-repeat; animation: glassburst .6s ease-out calc(var(--delay) + 250ms) both; }
@keyframes glassburst { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1 } to { opacity: 0; transform: scale(1.4) } }

/* Noa: painted strings (and a hook to yank captures); the control bar hangs over the piece she takes */
.strings i { width: 3px; background: url(/assets/fx/noa/string.webp) 50% 0 / 100% auto repeat-y; box-shadow: none; filter: drop-shadow(0 0 4px var(--g)); }
.strings .hook { position: absolute; left: 50%; bottom: 45%; width: 16%; aspect-ratio: 38 / 120; translate: -50% 0; background: url(/assets/fx/noa/hook.webp) 50% 100% / 100% auto no-repeat; filter: drop-shadow(0 0 4px var(--g)); animation: hookdrop 1.1s ease-in-out both; }
@keyframes hookdrop { from { opacity: 0; transform: translateY(-120%) } 30% { opacity: 1; transform: none } 55% { transform: none } to { opacity: 0; transform: translateY(-260%) } }
.u-steal .pstring { width: 4px; background: url(/assets/fx/noa/string.webp) 50% 0 / 100% auto repeat-y; }
.u-steal .pstring.main { width: 5px; }
.u-steal .control { left: var(--x); top: 0; width: 34%; aspect-ratio: 306 / 231; translate: -50% -20%; z-index: 2; background: url(/assets/fx/noa/control.webp) center / contain no-repeat; filter: drop-shadow(0 0 12px #b06bff); animation: control 1.6s ease-out both; }
@keyframes control { from { opacity: 0; transform: translateY(-40%) } 25% { opacity: 1; transform: none } 60% { transform: translateY(4%) rotate(-3deg) } 80% { opacity: 1 } to { opacity: 0; transform: translateY(-10%) } }

/* Shin & Akane: painted mist */
.streak.mist { height: 22%; border-radius: 0; background: url(/assets/fx/shin/trail.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 6px var(--g)); }
.streak.mist.akane { background-image: url(/assets/fx/akane/trail.webp); }
.mistpuff i { background: url(/assets/fx/shin/mist.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px var(--g)); }
.mistpuff.akane i { background-image: url(/assets/fx/akane/mist.webp); }
.ghost.vanish::after { content: ''; position: absolute; left: 50%; top: 20%; width: 90%; aspect-ratio: 290 / 237; translate: -50% -50%; background: url(/assets/fx/shin/wisps.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px var(--g)); animation: wisprise 1.3s ease-out .2s both; }
@keyframes wisprise { from { opacity: 0; transform: translateY(30%) } 35% { opacity: .9 } to { opacity: 0; transform: translateY(-25%) } }
/* Shin's Shadow Swap */
.u-swap .mistveil { inset: 0; background: radial-gradient(circle, rgba(232, 228, 255, .18), rgba(10, 8, 20, .45) 70%); animation: tint 1.4s ease-out both; }
.u-swap .swapsym { left: 50%; top: 50%; width: 44%; aspect-ratio: 247 / 260; translate: -50% -50%; background: url(/assets/fx/shin/swap.webp) center / contain no-repeat; filter: drop-shadow(0 0 14px #e8e4ff) brightness(1.4); animation: swapsym 1.3s ease-in-out both; }
@keyframes swapsym { from { opacity: 0; transform: scale(.5) rotate(-90deg) } 30% { opacity: .9; transform: scale(1) rotate(0) } 70% { opacity: .9; transform: rotate(180deg) } to { opacity: 0; transform: scale(1.2) rotate(270deg) } }
.u-swap .mirror { width: 9%; aspect-ratio: 227 / 288; translate: -50% -50%; z-index: 2; background: url(/assets/fx/shin/mirror.webp) center / contain no-repeat; filter: drop-shadow(0 0 10px #e8e4ff); animation: mirror .7s ease-out var(--d) both; }
@keyframes mirror { from { opacity: 0; transform: scale(.3) rotateY(90deg) } 40% { opacity: 1; transform: scale(1.1) rotateY(0) } to { opacity: 0; transform: scale(1.4) } }
/* Akane's Crimson Sight */
.u-sight .eyedim { inset: 0; background: radial-gradient(circle, rgba(255, 59, 92, .15), rgba(20, 0, 6, .55) 70%); animation: tint 1.8s ease-out both; }
.u-sight .eye { left: 50%; top: 42%; width: 86%; aspect-ratio: 800 / 244; translate: -50% -50%; background: url(/assets/fx/akane/eye.webp) left center / 46% auto no-repeat, url(/assets/fx/akane/eye.webp) right center / 46% auto no-repeat; filter: drop-shadow(0 0 20px #ff3b5c); animation: eyeopen 1.7s ease-out both; }
@keyframes eyeopen { from { opacity: 0; transform: scaleY(0) } 22% { opacity: 1; transform: scaleY(1.05) } 30% { transform: scaleY(1) } 75% { opacity: 1 } to { opacity: 0; transform: scale(1.15) } }
.u-sight .reticle { width: 15%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; border: 2px solid #ff3b5c; box-shadow: 0 0 12px #ff3b5c, inset 0 0 8px #ff3b5c; animation: lockon .6s cubic-bezier(.2, .8, .2, 1) var(--d) both, fadeout .4s ease-in 1.45s forwards; }
.u-sight .reticle b { position: absolute; inset: -18%; background:
    linear-gradient(#ff3b5c, #ff3b5c) 50% 0 / 2px 22% no-repeat, linear-gradient(#ff3b5c, #ff3b5c) 50% 100% / 2px 22% no-repeat,
    linear-gradient(#ff3b5c, #ff3b5c) 0 50% / 22% 2px no-repeat, linear-gradient(#ff3b5c, #ff3b5c) 100% 50% / 22% 2px no-repeat; }
/* her frozen pieces wear a ring of crimson glass instead of Kyo's chains; it shatters when the freeze ends */
.sq.sealed.sight::after { left: 4%; right: 4%; top: auto; bottom: 2%; height: 44%; translate: none; rotate: none; background: url(/assets/fx/akane/ring.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px #ff3b5c); }
.sq.sealed.sight::before { display: none; }
.unchain.sight i { width: 95%; aspect-ratio: 245 / 242; background-image: url(/assets/fx/akane/ring-broken.webp); filter: drop-shadow(0 0 6px #ff3b5c); }

/* ---- capture impact (see impact()) ---- */
.hit i { position: absolute; inset: 0; background: radial-gradient(circle, #fff, color-mix(in srgb, var(--g) 70%, #fff) 30%, transparent 68%); mix-blend-mode: screen; animation: impactflash .35s ease-out both; }
.hit.t0 i { opacity: .45; animation-duration: .25s; }
/* your piece was taken: a red flash, with a dark ring closing in for bigger losses */
.hit[class*='tloss'] i { background: radial-gradient(circle, rgba(255, 220, 225, .9), #ff2a4f 35%, transparent 70%); }
.hit.tloss3 i, .hit.tloss4 i { inset: -30%; }
.hit[class*='tloss'] b { display: block; border-color: #ff2a4f; box-shadow: 0 0 18px #ff2a4f, inset 0 0 12px #ff2a4f; animation-name: lossring; }
.hit.tloss1 b { display: none; }
@keyframes lossring { from { opacity: 0; transform: scale(2.6) } 30% { opacity: 1 } to { opacity: 0; transform: scale(.4) } }
.hit.t1 i { transform: scale(.8); }
.hit.t3 i, .hit.t4 i { inset: -20%; }
@keyframes impactflash { from { opacity: 1; transform: scale(.4) } to { opacity: 0; transform: scale(1.2) } }
.hit b { display: none; position: absolute; inset: 0; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--g) 60%, #fff); box-shadow: 0 0 16px var(--g), inset 0 0 10px var(--g); animation: impactring .6s cubic-bezier(.2, .8, .3, 1) both; }
.hit.t3 b, .hit.t4 b { display: block; }
.hit.t4 b { border-width: 4px; animation-duration: .8s; }
@keyframes impactring { from { opacity: 1; transform: scale(.3) } to { opacity: 0; transform: scale(2.6) } }
.hit.t4 b { --ring: 3.6; animation-name: impactring4; }
@keyframes impactring4 { from { opacity: 1; transform: scale(.3) } to { opacity: 0; transform: scale(3.6) } }
.burst { position: absolute; inset: 0; z-index: 6; pointer-events: none; background: radial-gradient(circle at var(--x) var(--y), rgba(255, 255, 255, .85), color-mix(in srgb, var(--g) 45%, transparent) 22%, transparent 60%); mix-blend-mode: screen; animation: burst 1s ease-out both; }
@keyframes burst { from { opacity: 0 } 12% { opacity: 1 } to { opacity: 0 } }

/* ---- effects layer ---- */
.fx { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.cell { position: absolute; width: 12.5%; height: 12.5%; display: flex; align-items: center; justify-content: center; font-size: min(7.2vh, 7.6vw); line-height: 1; }
.ghost .piece { position: absolute; inset: 0; }
.bit { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; opacity: 0; }

/* normal capture: knocked up, spins away, shatters */
.ghost.capture .piece { animation: knocked .55s cubic-bezier(.3, 0, .7, 1) var(--delay) both; }
@keyframes knocked { from { transform: none; opacity: 1 } to { transform: translate(18%, -70%) rotate(110deg) scale(.4); opacity: 0 } }
.ghost.capture .bit { background: var(--g); clip-path: polygon(50% 0, 100% 100%, 0 70%); animation: shard .8s cubic-bezier(.2, .7, .4, 1) calc(var(--delay) + 120ms) both; }
@keyframes shard {
  from { opacity: 1; transform: translate(-50%, -50%) rotate(0) scale(var(--s)) }
  to { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 60px)) rotate(var(--r)) scale(var(--s)) }
}

/* a puppeteer's capture: a tug down, then jerked up off the board */
.ghost.yank .piece { animation: yank .75s cubic-bezier(.55, -0.35, .75, .3) var(--delay) both; }
@keyframes yank {
  0% { transform: none; opacity: 1 }
  28% { transform: translateY(8%) rotate(-7deg) scale(1.02, .95); }
  100% { transform: translateY(-460%) rotate(28deg) scale(.7); opacity: 0 }
}

/* Mio's capture: the piece flares pink, swells a little and goes up in a puff of pink fire */
.ghost.poof .piece { animation: poof .55s ease-out var(--delay) both; }
@keyframes poof {
  0% { transform: none; filter: none; opacity: 1 }
  40% { transform: scale(1.12); filter: brightness(1.8) sepia(1) saturate(4) hue-rotate(290deg) drop-shadow(0 0 12px #ff3d7a); opacity: 1 }
  100% { transform: scale(1.3) translateY(-10%); filter: blur(4px) brightness(2) sepia(1) saturate(4) hue-rotate(290deg); opacity: 0 }
}
.ghost.poof::before { content: ''; position: absolute; inset: -10%; border-radius: 50%; background: radial-gradient(circle, rgba(255, 220, 235, .95), #ff3d7a 40%, transparent 70%); filter: blur(2px); animation: puff .5s ease-out var(--delay) both; }
@keyframes puff { from { opacity: 0; transform: scale(.4) } 30% { opacity: .9 } to { opacity: 0; transform: scale(1.5) } }
.ghost.poof .bit, .embers .bit {
  width: 6px; height: 8px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: radial-gradient(circle at 50% 70%, #fff3f8, #ff9cc4 40%, #ff3d7a 75%, transparent);
  animation: ember .9s ease-out var(--delay, 0ms) both;
}
@keyframes ember {
  from { opacity: 0; transform: translate(-50%, -50%) scale(var(--s)) }
  20% { opacity: 1 }
  to { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(calc(var(--s) * .3)) }
}

/* Mio's move: lifts lightly, floats along a smooth low arc with a soft pink glow, and settles */
.piece.arrive.skip { animation: floatArc calc(.55s * var(--pace, 1)) cubic-bezier(.45, .05, .3, 1) both; }
@keyframes floatArc {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: none; }
  50% { transform: translate(calc(var(--fx) * 50%), calc(var(--fy) * 50% - 24%)) scale(1.05); filter: drop-shadow(0 10px 8px rgba(0, 0, 0, .35)) drop-shadow(0 0 10px rgba(255, 61, 122, .7)); }
  88% { transform: translate(0, -2%) scale(1.01); filter: drop-shadow(0 0 6px rgba(255, 61, 122, .5)); }
  to { transform: none; filter: none; }
}
/* the soft pink afterglow left along the arc */
.echo.glow .piece {
  filter: brightness(1.6) sepia(1) saturate(4) hue-rotate(290deg) blur(2.5px) drop-shadow(0 0 8px #ff3d7a);
  animation: afterglow .8s ease-out var(--delay) both;
}
@keyframes afterglow { from { opacity: .45; transform: scale(1) } to { opacity: 0; transform: scale(.92) translateY(-4%) } }

/* Kaito's capture: a gold impact flash, then the piece is sent flying off the board */
.ghost.knockout::before {
  content: ''; position: absolute; inset: -30%; z-index: 2; border-radius: 50%;
  background: repeating-conic-gradient(from 10deg, #fff6c8 0 6deg, transparent 6deg 30deg), radial-gradient(circle, #fff 0 18%, #ffcf4a 30%, transparent 62%);
  -webkit-mask: radial-gradient(circle, #000 35%, transparent 70%); mask: radial-gradient(circle, #000 35%, transparent 70%);
  animation: kapow .35s ease-out var(--delay) both;
}
@keyframes kapow { from { opacity: 0; transform: scale(.3) rotate(0) } 35% { opacity: 1 } to { opacity: 0; transform: scale(1.4) rotate(20deg) } }
.ghost.knockout .piece { animation: knockout .8s cubic-bezier(.2, .6, .4, 1) var(--delay) both; }
@keyframes knockout {
  0% { transform: none; opacity: 1 }
  12% { transform: translateX(calc(var(--dir) * -6%)) scale(1.1, .9); }
  100% { transform: translate(calc(var(--dir) * 420%), -320%) rotate(calc(var(--dir) * 900deg)) scale(.5); opacity: 0 }
}

/* Kaito's charge: a straight dash with a little overshoot */
.piece.arrive.dash { animation: dash calc(.3s * var(--pace, 1)) cubic-bezier(.75, 0, .3, 1) both; }
@keyframes dash {
  from { transform: translate(calc(var(--fx) * 100%), calc(var(--fy) * 100%)); filter: blur(2px) drop-shadow(0 0 8px #ffb020); }
  80% { transform: translate(calc(var(--fx) * -6%), calc(var(--fy) * -6%)); filter: drop-shadow(0 0 8px #ffb020); }
  to { transform: none; filter: none; }
}
/* the amber speed streak left along the path */
.streak {
  position: absolute; height: 10%; translate: 0 -50%; transform-origin: 0 50%; rotate: var(--angle); pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255, 176, 32, .25) 30%, rgba(255, 210, 122, .85) 85%, #fff6c8);
  clip-path: polygon(0 45%, 100% 0, 100% 100%, 0 55%); filter: blur(.5px) drop-shadow(0 0 6px #ffb020);
  animation: streak .6s ease-out both;
}
@keyframes streak { from { opacity: 0; clip-path: polygon(0 45%, 0 0, 0 100%, 0 55%) } 30% { opacity: 1; clip-path: polygon(0 45%, 100% 0, 100% 100%, 0 55%) } to { opacity: 0 } }
/* the heavy landing: shockwave ring and sparks */
.impact::before { content: ''; position: absolute; inset: 10%; border-radius: 50%; border: 3px solid #ffb020; box-shadow: 0 0 16px #ff8a1a; animation: shockring .5s ease-out both; }
@keyframes shockring { from { opacity: 1; transform: scale(.4) } to { opacity: 0; transform: scale(1.8) } }
.impact .bit { width: 5px; height: 5px; border-radius: 50%; background: radial-gradient(circle, #fff6c8, #ffb020 60%, transparent); animation: shard .6s cubic-bezier(.2, .7, .4, 1) both; }

/* Ren's capture: the piece ages to sepia and crumbles from the top into falling red sand */
.ghost.sand .piece { animation: crumble 1.4s ease-in both; }
@keyframes crumble {
  0% { filter: none; clip-path: inset(0 0 0 0) }
  25% { filter: sepia(1) saturate(2) hue-rotate(-25deg) brightness(.9); clip-path: inset(0 0 0 0) }
  100% { filter: sepia(1) saturate(2) hue-rotate(-25deg) brightness(.6); clip-path: inset(100% 0 0 0) }
}
.ghost.sand::after {
  content: ''; position: absolute; left: 50%; bottom: 4%; width: 78%; aspect-ratio: 270 / 148; translate: -50% 0; z-index: 2;
  background: url(/assets/fx/ren/sand.webp) center bottom / contain no-repeat; transform-origin: 50% 100%;
  filter: drop-shadow(0 0 4px rgba(255, 74, 61, .5)); animation: sandpile 1.8s ease-out both;
}
@keyframes sandpile { from { opacity: 0; transform: scaleY(0) } 20% { opacity: 0 } 70% { opacity: 1; transform: scaleY(1) } to { opacity: 0; transform: scaleY(1) } }
.ghost.sand .bit { width: 4px; height: 4px; border-radius: 50%; background: radial-gradient(circle, #ff8a6a, #c4141c 70%); animation: sand 1s cubic-bezier(.5, 0, .9, .6) var(--d) both; }
@keyframes sand {
  from { opacity: 0; transform: translate(calc(-50% + var(--dx)), -120%) scale(var(--s)) }
  15% { opacity: 1 }
  to { opacity: 0; transform: translate(calc(-50% + var(--dx) * 1.4), 420%) scale(var(--s)) }
}

/* Ren's move: crimson afterimages fading along the path */
.echo { z-index: 1; }
.echo .piece { position: absolute; inset: 0; filter: sepia(1) saturate(5) hue-rotate(-40deg) brightness(.85) drop-shadow(0 0 6px var(--c)); animation: echo .8s ease-out var(--delay) both; }
@keyframes echo { from { opacity: .6 } to { opacity: 0; transform: scale(.96) } }
/* the clock that ticks once around the landing square */
.clock::before {
  content: ''; position: absolute; inset: -16%;
  background: url(/assets/fx/ren/ring.webp) center / contain no-repeat; /* painted art: public/assets/fx/ren/ */
  filter: drop-shadow(0 0 6px var(--c)); animation: clockring 1.1s ease-out both;
}
.clock .hand {
  position: absolute; left: 50%; top: 50%; height: 54%; aspect-ratio: 58 / 357; translate: -50% -83%; transform-origin: 50% 83%;
  background: url(/assets/fx/ren/hand-minute.webp) center / contain no-repeat; filter: drop-shadow(0 0 4px var(--c));
  animation: sweep 1s cubic-bezier(.4, 0, .2, 1) both;
}
@keyframes clockring { from { opacity: 0; transform: scale(1.3) } 25% { opacity: 1; transform: scale(1) } 80% { opacity: 1 } to { opacity: 0 } }
@keyframes sweep { from { transform: rotate(0); opacity: 1 } 85% { opacity: 1 } to { transform: rotate(360deg); opacity: 0 } }

/* Mio's burn: glows orange, chars, melts down while flames rise */
.ghost.burn .piece { animation: burn 1.3s ease-in both; }
@keyframes burn {
  0% { filter: none }
  25% { filter: brightness(1.6) sepia(1) saturate(4) hue-rotate(-20deg) drop-shadow(0 0 14px #ff6a1a); }
  70% { filter: brightness(.4) sepia(1) saturate(3) hue-rotate(-30deg) drop-shadow(0 0 10px #ff3a0a); transform: scale(1.05, .7) translateY(18%) }
  100% { filter: blur(3px) brightness(.15); transform: scale(1.2, .05) translateY(40%); opacity: 0 }
}
.ghost.burn .bit { width: 14px; height: 18px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: radial-gradient(circle at 50% 70%, #fff3b0, #ffb020 40%, #ff4a1a 75%, transparent); animation: flame 1s ease-out var(--d) both; }
@keyframes flame {
  from { opacity: 0; transform: translate(-50%, 10%) scale(var(--s)) }
  20% { opacity: 1 }
  to { opacity: 0; transform: translate(calc(-50% + var(--dx)), -170%) scale(calc(var(--s) * .3)) }
}

/* Yuki's freeze: frosts into ice, then shatters */
.ghost.freeze .piece { animation: freeze 1.2s ease-in both; }
@keyframes freeze {
  0% { filter: none }
  45% { filter: brightness(1.4) saturate(0) sepia(.3) hue-rotate(160deg) drop-shadow(0 0 12px #8ff0ff); }
  55% { transform: translateX(-3%); } 60% { transform: translateX(3%); } 65% { transform: translateX(-2%); opacity: 1 }
  70%, 100% { opacity: 0; transform: scale(1.1); }
}
.ghost.freeze .bit { background: linear-gradient(135deg, #ffffff, #8ff0ff); clip-path: polygon(50% 0, 100% 60%, 60% 100%, 0 40%); animation: shard .9s cubic-bezier(.2, .7, .4, 1) .8s both; }

/* pillar of light over a square (ultimate targets, promotion) */
.beam { align-items: flex-end; }
.beam::before { content: ''; position: absolute; left: 12%; right: 12%; bottom: 0; height: 420%; background: linear-gradient(to top, var(--g), color-mix(in srgb, var(--g) 40%, transparent) 45%, transparent); filter: blur(1px); mix-blend-mode: screen; animation: beam 1s ease-out var(--delay, 0ms) both; transform-origin: bottom; }
.beam::after { content: ''; position: absolute; inset: 8%; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--g) 80%, #fff), transparent 70%); mix-blend-mode: screen; animation: flash 1s ease-out var(--delay, 0ms) both; }
@keyframes beam { from { opacity: 0; transform: scaleY(.2) } 25% { opacity: .9; transform: scaleY(1) } to { opacity: 0; transform: scaleY(1.05) } }
@keyframes flash { from { opacity: 0; transform: scale(.4) } 30% { opacity: 1 } to { opacity: 0; transform: scale(1.4) } }

/* closing ring that marks an ultimate's target */
.target::before { content: ''; position: absolute; inset: -40%; border: 2px solid var(--g); border-radius: 50%; box-shadow: 0 0 18px var(--g); animation: lockon .8s cubic-bezier(.2, .8, .2, 1) both; }
@keyframes lockon { from { transform: scale(1.6) rotate(-90deg); opacity: 0 } 40% { opacity: 1 } to { transform: scale(.55) rotate(0); opacity: 0 } }

/* Noa's strings dropping from above */
.strings i { position: absolute; bottom: 55%; width: 1.5px; height: 500%; background: linear-gradient(to top, var(--g), transparent); box-shadow: 0 0 6px var(--g); transform-origin: bottom; animation: string 1.2s ease-out both; }
.strings i:nth-child(1) { left: 30%; transform: rotate(-8deg); } .strings i:nth-child(2) { left: 50%; } .strings i:nth-child(3) { left: 70%; transform: rotate(8deg); }
@keyframes string { from { opacity: 0; clip-path: inset(0 0 100% 0) } 30% { opacity: 1; clip-path: inset(0 0 0 0) } 75% { opacity: 1 } to { opacity: 0 } }

/* Ren's time stop: the board drains of colour while shockwaves roll out */
.board.timestop .sq { filter: grayscale(1) brightness(.75) contrast(1.1); transition: filter .2s; }
.shock { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden; }
.shock i { position: absolute; width: 20%; aspect-ratio: 1; border-radius: 50%; border: 2px solid var(--g); box-shadow: 0 0 24px var(--g), inset 0 0 24px var(--g); animation: shock 1.2s cubic-bezier(.2, .7, .3, 1) both; }
.shock i:nth-child(2) { animation-delay: .2s; } .shock i:nth-child(3) { animation-delay: .4s; }
@keyframes shock { from { transform: scale(.1); opacity: 1 } to { transform: scale(7); opacity: 0 } }

/* ---- ultimate takeovers ---- */
.ultfx { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
.ultfx i, .ultfx b, .ultfx span, .ultfx div { position: absolute; display: block; }
.ultfx .tint { inset: 0; animation: tint 1.4s ease-out both; }
@keyframes tint { from { opacity: 0 } 20% { opacity: 1 } to { opacity: 0 } }

/* Mio: a line of flames rises from the bottom edge and licks up the board */
.u-burn .tint { background: linear-gradient(to top, rgba(255, 74, 26, .45), rgba(255, 61, 122, .15) 50%, transparent); }
.u-burn .flame {
  bottom: -2%; width: 9%; height: var(--h); translate: -50% 0; transform-origin: 50% 100%;
  border-radius: 50% 50% 45% 45% / 70% 70% 30% 30%;
  background: radial-gradient(ellipse at 50% 85%, #fff3c4 0 12%, #ffb020 30%, #ff3d7a 60%, transparent 72%);
  filter: blur(1.5px); mix-blend-mode: screen; animation: boardflame 1.5s ease-out var(--d) both;
}
@keyframes boardflame { 0% { opacity: 0; transform: scaleY(0) } 25% { opacity: 1; transform: scaleY(1.1) skewX(-5deg) } 55% { transform: scaleY(.85) skewX(5deg) } 100% { opacity: 0; transform: scaleY(1.3) translateY(-20%) } }

/* Haru: vines grow round the frame, petals drift, a flower opens on the square */
.u-revive .vines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.u-revive .vines path { fill: none; stroke: #2fbf6a; stroke-width: 1.2; stroke-linecap: round; filter: drop-shadow(0 0 2px #4dff9b); stroke-dasharray: 160; stroke-dashoffset: 160; animation: vinegrow 1.1s ease-out forwards, fadeout .5s ease-in 1.4s forwards; }
@keyframes vinegrow { to { stroke-dashoffset: 0 } }
@keyframes fadeout { to { opacity: 0 } }
.u-revive .petal { top: -4%; width: 2.2%; height: 1.6%; border-radius: 60% 10% 60% 10%; background: linear-gradient(135deg, #fff, #ffd1e8); animation: boardpetal 1.6s linear var(--d) both; }
.u-revive .petal:nth-child(3n) { background: linear-gradient(135deg, #c8ffdc, #2fbf6a); }
@keyframes boardpetal { from { opacity: 0; transform: translate(0, 0) rotate(0) } 10% { opacity: 1 } to { opacity: 0; transform: translate(var(--dx), 900%) rotate(var(--r)) } }
.u-revive .flower { left: var(--x); top: var(--y); width: 20%; aspect-ratio: 1; translate: -50% -50%; animation: bloomspin 1.8s ease-out both; }
.u-revive .flower i { left: 50%; top: 50%; width: 30%; height: 50%; border-radius: 50% 50% 50% 50% / 70% 70% 30% 30%; transform-origin: 50% 100%; translate: -50% -100%; rotate: calc(var(--k) * 45deg); background: linear-gradient(to top, #ffd1e8, #fff); box-shadow: 0 0 8px rgba(255, 209, 232, .8); animation: petalopen .7s cubic-bezier(.3, 1.5, .5, 1) calc(var(--k) * 40ms) both; }
.u-revive .flower b { left: 50%; top: 50%; width: 22%; height: 22%; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, #fff3a8, #ffb020); box-shadow: 0 0 12px #ffcf4a; }
@keyframes petalopen { from { transform: scaleY(0) } }
@keyframes bloomspin { from { rotate: -40deg; opacity: 0 } 15% { opacity: 1 } 75% { opacity: 1 } to { rotate: 30deg; opacity: 0; scale: 1.2 } }

/* Kaito (and your Smite): lightning strikes the square; Kaito's crown drops onto it */
.u-promote .tint { background: radial-gradient(circle at var(--x) var(--y), rgba(255, 207, 74, .55), rgba(255, 176, 32, .15) 40%, transparent 70%); }
.u-smite .tint { background: radial-gradient(circle at var(--x) var(--y), rgba(255, 255, 255, .5), transparent 60%); }
.ultfx .bolt { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; animation: zap .9s ease-out both; }
.ultfx .bolt polyline { fill: none; stroke: #ffb020; stroke-width: 2.2; stroke-linejoin: round; filter: drop-shadow(0 0 4px #ffb020); }
.ultfx .bolt polyline.core { stroke: #fff; stroke-width: .8; }
.u-smite .bolt polyline { stroke: #c9d6ff; filter: drop-shadow(0 0 4px #fff); }
@keyframes zap { 0% { opacity: 0 } 8% { opacity: 1 } 18% { opacity: .2 } 28% { opacity: 1 } 70% { opacity: 1 } 100% { opacity: 0 } }
.ultfx .impact { left: var(--x); top: var(--y); width: 26%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; border: 3px solid #ffcf4a; box-shadow: 0 0 24px #ffb020, inset 0 0 18px #ffb020; animation: impactring .7s ease-out .15s both; }
.u-smite .impact { border-color: #fff; box-shadow: 0 0 24px #fff, inset 0 0 18px #c9d6ff; }
@keyframes impactring { from { opacity: 1; transform: scale(.2) } to { opacity: 0; transform: scale(1.6) } }
.u-promote .crownmark { position: absolute; left: var(--x); top: var(--y); width: 11%; translate: -50% -130%; filter: drop-shadow(0 0 8px #ffb020); animation: crowndrop 1.5s cubic-bezier(.3, 1.5, .5, 1) .35s both; }
.u-promote .crownmark path, .u-promote .crownmark circle { fill: #ffcf4a; stroke: #fff6c8; stroke-width: 3; }
@keyframes crowndrop { 0% { opacity: 0; transform: translateY(-200%) scale(1.5) } 35% { opacity: 1; transform: none } 80% { opacity: 1 } 100% { opacity: 0; transform: translateY(40%) scale(.6) } }

/* Jun: the board turns to green felt, a die tumbles in and lands on his roll */
.u-gamble .felt { inset: 0; background: radial-gradient(circle, rgba(20, 90, 50, .35), rgba(10, 40, 25, .25) 70%); animation: tint 2.2s ease-out both; }
.u-gamble .die {
  left: 50%; top: 50%; width: 18%; aspect-ratio: 1; border-radius: 16%; translate: -50% -50%;
  background: linear-gradient(135deg, #fff, #dcdce8); box-shadow: 0 16px 30px rgba(0, 0, 0, .55), inset 0 0 0 2px #fff, 0 0 30px rgba(232, 232, 248, .5);
  animation: dieroll 1.25s cubic-bezier(.25, .6, .35, 1) both, diefade .4s ease-in 1.9s forwards;
}
.u-gamble .die i { width: 17%; height: 17%; translate: -50% -50%; border-radius: 50%; background: #16161c; opacity: 0; animation: pipshow .1s linear 1.05s forwards; }
@keyframes dieroll {
  0% { transform: translate(-320%, -160%) rotate(0) scale(.6); filter: blur(3px) }
  45% { transform: translate(-60%, 40%) rotate(540deg) scale(1.1); filter: blur(2px) }
  70% { transform: translate(30%, -20%) rotate(820deg) scale(.95); filter: blur(1px) }
  88% { transform: translate(0, 6%) rotate(900deg) scale(1.05); filter: none }
  100% { transform: rotate(900deg); filter: none }
}
@keyframes pipshow { to { opacity: 1 } }
@keyframes diefade { to { opacity: 0; scale: 1.3 } }
.u-gamble .rollnum { left: 50%; top: 50%; translate: -50% 90%; font-family: var(--serif); font-weight: 900; font-size: 34px; color: #fff; text-shadow: 0 0 18px #e8e8f8; opacity: 0; animation: rollpop .9s cubic-bezier(.3, 1.6, .5, 1) 1.15s both; }
.u-gamble .rollnum.bad { color: #ff9a9a; text-shadow: 0 0 18px #ff4a3d; }
.u-gamble .rollnum.jackpot { color: #ffcf4a; text-shadow: 0 0 22px #ffb020; }
@keyframes rollpop { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1; transform: scale(1.25) } 80% { opacity: 1; transform: scale(1) } to { opacity: 0 } }

/* Yuki: frost creeps in from the edges, snow falls across the board */
.u-freeze .frostedge { inset: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(143, 240, 255, .25) 65%, rgba(235, 252, 255, .6)); box-shadow: inset 0 0 40px rgba(220, 248, 255, .8); animation: tint 1.9s ease-out both; }
.u-freeze .flake {
  top: -4%; width: 3%; aspect-ratio: 1;
  background: linear-gradient(90deg, transparent 44%, #fff 44% 56%, transparent 56%), linear-gradient(30deg, transparent 46%, #fff 46% 54%, transparent 54%), linear-gradient(150deg, transparent 46%, #fff 46% 54%, transparent 54%);
  filter: drop-shadow(0 0 3px #8ff0ff); animation: boardsnow 1.6s linear var(--d) both;
}
@keyframes boardsnow { from { opacity: 0; transform: translate(0, 0) rotate(0) scale(var(--s)) } 10% { opacity: 1 } to { opacity: 0; transform: translate(var(--dx), 3400%) rotate(200deg) scale(var(--s)) } }

/* Ren (and your Rewind): the painted art in public/assets/fx/ren/. A cracked hourglass flips as time stops,
   then a giant clock face hangs over the frozen board, gears turning behind it and its hands spinning
   (backwards for Rewind); as time starts again, its glass shatters. */
.ultfx .hourglass {
  left: 50%; top: 50%; height: 46%; aspect-ratio: 226 / 380; translate: -50% -50%; z-index: 2;
  background: url(/assets/fx/ren/hourglass.webp) center / contain no-repeat; filter: drop-shadow(0 0 18px var(--g));
  animation: hourglass .75s cubic-bezier(.5, 0, .3, 1) both;
}
@keyframes hourglass { from { opacity: 0; transform: scale(1.5) } 25% { opacity: 1; transform: scale(1) rotate(0) } 70% { opacity: 1; transform: rotate(180deg) } to { opacity: 0; transform: rotate(180deg) scale(.7) } }
.ultfx .bigclock {
  left: 50%; top: 50%; width: 86%; aspect-ratio: 1; translate: -50% -50%;
  background: url(/assets/fx/ren/clock.webp) center / contain no-repeat;
  filter: drop-shadow(0 0 24px var(--g)) drop-shadow(0 8px 18px rgba(0, 0, 0, .7)); animation: clockfade 1.6s ease-out .35s both;
}
.ultfx .bigclock .gears { left: 50%; top: 50%; width: 48%; aspect-ratio: 328 / 264; translate: -50% -50%; background: url(/assets/fx/ren/gears.webp) center / contain no-repeat; opacity: .5; animation: hands 3s linear infinite; }
.ultfx .bigclock .hand { left: 50%; top: 50%; background: center / contain no-repeat; filter: drop-shadow(0 0 6px var(--g)); }
.ultfx .bigclock .hr { height: 30%; aspect-ratio: 63 / 270; translate: -50% -89%; transform-origin: 50% 89%; background-image: url(/assets/fx/ren/hand-hour.webp); animation: hands 1.5s cubic-bezier(.3, 0, .2, 1) .35s both; }
.ultfx .bigclock .mn { height: 44%; aspect-ratio: 58 / 357; translate: -50% -83%; transform-origin: 50% 83%; background-image: url(/assets/fx/ren/hand-minute.webp); animation: hands .5s linear infinite; }
.u-rewind .bigclock .hand, .u-rewind .bigclock .gears { animation-direction: reverse; }
.ultfx .clockshards {
  left: 50%; top: 50%; width: 60%; aspect-ratio: 232 / 193; translate: -50% -50%; z-index: 3;
  background: url(/assets/fx/ren/shards.webp) center / contain no-repeat; filter: drop-shadow(0 0 10px var(--g));
  animation: clockshards .55s ease-out 1.3s both;
}
@keyframes clockshards { from { opacity: 0; transform: scale(.3) } 30% { opacity: 1 } to { opacity: 0; transform: scale(1.9) } }
@keyframes hands { to { rotate: 720deg } }
@keyframes clockfade { from { opacity: 0; transform: scale(1.3) } 20% { opacity: 1; transform: scale(1) } 75% { opacity: 1 } to { opacity: 0; transform: scale(.9) } }

/* Sena: the board chills blue, cracks race out from her target, a cold ring closes on it */
.u-demote .chill { inset: 0; background: radial-gradient(circle at var(--x) var(--y), rgba(74, 125, 255, .35), rgba(28, 59, 143, .25) 50%, transparent 80%); animation: tint 1.7s ease-out both; }
.u-demote .crack {
  left: var(--x); top: var(--y); width: var(--l); height: 2px; transform-origin: 0 50%; rotate: var(--a);
  background: linear-gradient(90deg, #fff, #9fb8ff 40%, transparent); filter: drop-shadow(0 0 4px #4a7dff);
  clip-path: inset(0 100% 0 0); animation: crackrun .35s ease-out var(--d) forwards, fadeout .5s ease-in 1.2s forwards;
}
@keyframes crackrun { to { clip-path: inset(0 0 0 0) } }
.u-demote .ring { left: var(--x); top: var(--y); width: 14%; aspect-ratio: 1; translate: -50% -50%; rotate: 45deg; border: 2px solid #dfe8ff; box-shadow: 0 0 16px #4a7dff, inset 0 0 12px #4a7dff; animation: diamond 1.1s cubic-bezier(.2, .8, .2, 1) .1s both; }
@keyframes diamond { from { opacity: 0; transform: scale(3) } 40% { opacity: 1; transform: scale(1) } 75% { opacity: 1 } to { opacity: 0; transform: scale(.6) } }

/* Noa: the board darkens and violet strings drop onto it from above */
.u-steal .dim { inset: 0; background: radial-gradient(circle at var(--x) var(--y), rgba(176, 107, 255, .2), rgba(10, 5, 20, .45) 60%); animation: tint 1.7s ease-out both; }
.u-steal .pstring { top: 0; width: 1.5px; translate: -50% 0; background: linear-gradient(to bottom, transparent, #b06bff 30%, #e6d2ff); box-shadow: 0 0 6px #b06bff; transform-origin: 50% 0; clip-path: inset(0 0 100% 0); animation: stringdrop .5s cubic-bezier(.2, .8, .2, 1) var(--d) forwards, stringsway 1s ease-in-out var(--d) infinite alternate, fadeout .4s ease-in 1.3s forwards; }
.u-steal .pstring.main { width: 2.5px; box-shadow: 0 0 12px #b06bff; }
@keyframes stringdrop { to { clip-path: inset(0 0 0 0) } }
@keyframes stringsway { from { rotate: -2deg } to { rotate: 2deg } }

/* Kyo: the board goes dark, iron chains shoot in from both edges and lock onto his targets */
.u-seal .dark { inset: 0; background: radial-gradient(circle, rgba(60, 0, 10, .35), rgba(5, 0, 2, .6)); animation: tint 1.8s ease-out both; }
/* painted art: public/assets/fx/kyo/ (chain.webp tiles seamlessly; lock, lock-snap, broken) */
.u-seal .chain {
  height: 6%; translate: 0 -50%; transform-origin: left center;
  background: url(/assets/fx/kyo/chain.webp) 0 50% / auto 100% repeat-x;
  filter: drop-shadow(0 0 5px #d1002c) drop-shadow(0 3px 4px rgba(0, 0, 0, .7)); clip-path: inset(0 100% 0 0);
  animation: chainshoot .45s cubic-bezier(.3, 0, .2, 1) var(--d) forwards, chaintaut .35s ease-out calc(var(--d) + .45s), fadeout .4s ease-in 1.5s forwards;
}
.u-seal .chain.l { left: 0; background-position: right 50%; } /* the links meet the lock evenly from both sides */
.u-seal .chain.r { right: 0; clip-path: inset(0 0 0 100%); animation-name: chainshootr, chaintaut, fadeout; }
@keyframes chainshoot { to { clip-path: inset(0 0 0 0) } }
@keyframes chainshootr { to { clip-path: inset(0 0 0 0) } }
/* the chain snaps taut as it hits: a quick shudder */
@keyframes chaintaut { 0% { transform: translateY(-10%) } 30% { transform: translateY(8%) } 60% { transform: translateY(-4%) } 100% { transform: none } }
.u-seal .lock {
  width: 9.5%; aspect-ratio: 255 / 355; translate: -50% -50%;
  background: url(/assets/fx/kyo/lock.webp) center / contain no-repeat;
  filter: drop-shadow(0 0 10px #d1002c) drop-shadow(0 4px 6px rgba(0, 0, 0, .8));
  animation: lockslam .5s cubic-bezier(.3, 1.6, .5, 1) var(--d) both, fadeout .4s ease-in 1.5s forwards;
}
/* the instant it clamps shut: the snapping lock, with sparks, flashes over it */
.u-seal .lock::after {
  content: ''; position: absolute; inset: -12% -22% -8% -8%; opacity: 0;
  background: url(/assets/fx/kyo/lock-snap.webp) center / contain no-repeat;
  animation: snapflash .4s ease-out calc(var(--d) + .2s);
}
@keyframes lockslam { from { opacity: 0; transform: scale(2.2) rotate(-12deg) } 70% { transform: scale(.94) } }
@keyframes snapflash { 0% { opacity: 1; transform: scale(1.15) } 100% { opacity: 0; transform: scale(1) } }

/* Shion: sickly green fog rolls over the board, bubbling */
.u-poison .toxic, .u-wither .toxic { inset: 0; background: radial-gradient(ellipse at 50% 100%, rgba(198, 255, 61, .35), rgba(79, 122, 0, .2) 50%, transparent 80%); animation: tint 1.7s ease-out both; }
.u-wither .toxic { animation-duration: 1.3s; }
.ultfx .cloud { width: 30%; aspect-ratio: 1.4; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, rgba(198, 255, 61, .45), rgba(120, 180, 20, .15) 55%, transparent 70%); filter: blur(4px); animation: fog 1.6s ease-out var(--d) both; }
@keyframes fog { from { opacity: 0; transform: scale(calc(var(--s) * .4)) } 35% { opacity: 1 } to { opacity: 0; transform: scale(calc(var(--s) * 1.3)) translateY(-10%) } }

/* chained pieces (Iron Dominion): a band of chain across the piece and a little padlock */
.sq.sealed::after {
  content: ''; position: absolute; left: -6%; right: -6%; top: 54%; height: 17%; translate: 0 -50%; z-index: 3; pointer-events: none; rotate: -10deg;
  background: url(/assets/fx/kyo/chain.webp) 0 50% / auto 100% repeat-x;
  filter: drop-shadow(0 0 4px #d1002c) drop-shadow(0 2px 2px rgba(0, 0, 0, .7));
}
.sq.sealed::before {
  content: ''; position: absolute; right: 4%; bottom: 4%; width: 30%; aspect-ratio: 255 / 355; z-index: 4; pointer-events: none;
  background: url(/assets/fx/kyo/lock.webp) center / contain no-repeat;
  filter: drop-shadow(0 0 5px #d1002c); animation: lockpulse 2.4s ease-in-out infinite;
}
@keyframes lockpulse { 50% { filter: drop-shadow(0 0 9px #ff2a4f) } }
/* the chain wears off: a broken link bursts apart */
.unchain i {
  position: absolute; left: 50%; top: 50%; width: 80%; aspect-ratio: 337 / 223; translate: -50% -50%;
  background: url(/assets/fx/kyo/broken.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px #d1002c);
  animation: unchain .85s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes unchain { from { opacity: 0; transform: scale(.6) rotate(-8deg) } 25% { opacity: 1; transform: scale(1.05) } to { opacity: 0; transform: scale(1.35) rotate(10deg) translateY(10%) } }
.sq.sealed .piece { filter: grayscale(.6) brightness(.75); }
/* poisoned pieces (Venom Kiss): a sickly green glow and rising bubbles */
.sq.poisoned::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 85%, rgba(198, 255, 61, .45), transparent 65%);
  box-shadow: inset 0 0 12px rgba(198, 255, 61, .5); animation: toxicpulse 1.2s ease-in-out infinite;
}
.sq.poisoned::after {
  content: ''; position: absolute; inset: 10% 20% 25%; z-index: 3; pointer-events: none;
  background: radial-gradient(circle at 30% 80%, rgba(220, 255, 140, .9) 0 4%, transparent 5%), radial-gradient(circle at 60% 60%, rgba(220, 255, 140, .8) 0 3%, transparent 4%), radial-gradient(circle at 45% 35%, rgba(220, 255, 140, .7) 0 3.5%, transparent 4.5%);
  animation: bubbleup 1.6s linear infinite;
}
.sq.poisoned .inner { filter: sepia(.6) hue-rotate(40deg) saturate(1.6) drop-shadow(0 0 6px #c6ff3d); }
@keyframes toxicpulse { 50% { opacity: .55 } }
@keyframes bubbleup { from { transform: translateY(20%); opacity: 0 } 30% { opacity: 1 } to { transform: translateY(-40%); opacity: 0 } }
/* Shion's withering: the piece turns green, sags, and dissolves into bubbling venom */
.ghost.dissolve .piece { animation: dissolve 1.3s ease-in both; transform-origin: 50% 95%; }
@keyframes dissolve {
  0% { filter: none }
  30% { filter: sepia(1) hue-rotate(40deg) saturate(3) brightness(1.1) drop-shadow(0 0 10px #c6ff3d); }
  100% { filter: sepia(1) hue-rotate(40deg) saturate(3) brightness(.5) blur(3px); transform: scale(1.2, .1) translateY(40%); opacity: 0 }
}
.ghost.dissolve .bit { width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #f0ffc8, #c6ff3d 50%, #4f7a00); animation: flame 1s ease-out var(--d) both; }
/* Shion's trail: little drips of venom on landing */
.petals.venom .bit { width: 6px; height: 8px; border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%; background: radial-gradient(circle at 40% 35%, #f0ffc8, #c6ff3d 55%, #4f7a00); }
.frost.venom {
  background: radial-gradient(ellipse at 40% 60%, rgba(198, 255, 61, .45), rgba(79, 122, 0, .35) 45%, transparent 70%), radial-gradient(circle at 70% 30%, rgba(198, 255, 61, .3), transparent 30%);
  box-shadow: inset 0 0 12px rgba(198, 255, 61, .35); animation: bloomIn .5s ease-out both;
}

/* your Shield: a shimmering dome rises over the piece */
.u-shield .dome { left: var(--x); top: var(--y); width: 22%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle at 40% 35%, rgba(255, 255, 255, .5), rgba(200, 225, 255, .15) 50%, transparent 70%); border: 2px solid rgba(220, 235, 255, .9); box-shadow: 0 0 24px rgba(200, 225, 255, .8); animation: domeup 1.3s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes domeup { from { opacity: 0; transform: scale(0) } 35% { opacity: 1; transform: scale(1.15) } 70% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(.9) } }

/* ---- spoken captions (styles) ---- */
.talk { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
.bubble span {
  position: absolute; bottom: 92%; left: 50%; translate: -50% 0; white-space: nowrap; max-width: 280px;
  padding: 6px 11px; font-family: var(--serif); font-weight: 700; font-size: 10.5px; line-height: 1.2; letter-spacing: .08em;
  background: rgba(10, 9, 14, .92); color: var(--text); border: 1px solid var(--edge, var(--line-strong)); backdrop-filter: blur(6px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, .5); animation: say 2.3s ease-out both;
}
/* blade notch pointing at the speaker */
.bubble span::after { content: ''; position: absolute; left: 50%; top: 100%; width: 4px; height: 9px; translate: -50% 1px; background: var(--edge, var(--line-strong)); clip-path: polygon(0 0, 100% 0, 50% 100%); }
/* White's pieces: ivory edge; Black's: the opponent's colour */
.bubble.w span { --edge: rgba(244, 242, 251, .8); }
.bubble.b span { --edge: color-mix(in srgb, var(--c) 80%, #fff); }
/* stay on the board at the edges */
.bubble.a-l span { left: 4%; translate: 0 0; }
.bubble.a-l span::after { left: 20%; }
.bubble.a-r span { left: auto; right: 4%; translate: 0 0; }
.bubble.a-r span::after { left: 80%; }
/* top rank: caption sits below the piece, notch pointing up */
.bubble.below span { bottom: auto; top: 94%; }
.bubble.below span::after { top: auto; bottom: 100%; translate: -50% -1px; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
/* louder moods: uppercase, coloured edge */
.bubble.t-panic span, .bubble.t-dying span { text-transform: uppercase; letter-spacing: .14em; }
.bubble.t-panic span { --edge: #ff5f8a; color: #ffd0dc; }
.bubble.t-dying span { --edge: var(--loss); }
.bubble.t-proud span, .bubble.t-cheer span { --edge: #ffcf4a; }
.bubble.t-sleepy span, .bubble.t-sad span { color: var(--muted); font-weight: 400; }
@keyframes say {
  0% { opacity: 0; transform: translateY(4px) }
  10%, 86% { opacity: 1; transform: none }
  100% { opacity: 0; transform: translateY(-4px) }
}

@media (prefers-reduced-motion: reduce) {
  .piece.arrive, .piece.arrive.lift, .piece.arrive.dash, .piece.arrive.skip, .piece.arrive.m-grow, .piece.arrive.m-glide, .piece.arrive.m-flip, .piece.arrive.m-ooze, .piece.arrive.m-drag, .piece.arrive.m-mist, .piece.crown, .piece.puppet, .piece.poke-own, .piece.poke-enemy, .fx, .sq.check, .sq.hint::before, .inner, .frost { animation: none !important; }
  .fx, .ultfx { display: none; }
  .sq.aimable::before, .sq.shielded::after { animation: none !important; }
}
/* a mirror match: the Alter's effects in black-and-white negative (its dying victims keep their own look; only the effect turns) */
.alterfx { filter: grayscale(1) invert(1) contrast(1.1); }
.ghost.byalter::before, .ghost.byalter::after, .ghost.byalter .bit { filter: grayscale(1) invert(1) contrast(1.1) !important; }
/* a move that stalemates the opponent, which WINS in this game: a gold dot marked WIN */
.sq.hint.stale::before { background: #ffcf4a !important; box-shadow: 0 0 12px #ffcf4a; }
.sq.hint.stale::after { content: 'WIN'; position: absolute; left: 0; right: 0; bottom: 4%; z-index: 4; text-align: center; font-family: var(--serif); font-weight: 900; font-size: clamp(7px, 1.1vh, 10px); letter-spacing: .12em; color: #ffcf4a; text-shadow: 0 0 4px #000; pointer-events: none; }
/* Rai's per-piece lightning: blue layer + white-hot core (screen-blended), along the path and on landing */
.streak.rai { clip-path: none; background-color: transparent; background-blend-mode: screen; background-size: 100% 100%; background-repeat: no-repeat; filter: drop-shadow(0 0 8px #3d7bff); animation: lash .6s ease-out both; }
.streak.rai.k { height: 26%; background-image: url(/assets/fx/rai/move/k-travel-core.webp), url(/assets/fx/rai/move/k-travel.webp); }
.streak.rai.q { height: 22%; background-image: url(/assets/fx/rai/move/q-travel-core.webp), url(/assets/fx/rai/move/q-travel.webp); }
.streak.rai.r { height: 9%; background-image: url(/assets/fx/rai/move/r-travel-core.webp), url(/assets/fx/rai/move/r-travel.webp); }
.streak.rai.b { height: 10%; background-image: url(/assets/fx/rai/move/b-travel-core.webp), url(/assets/fx/rai/move/b-travel.webp); }
.streak.rai.n { height: 30%; background-image: url(/assets/fx/rai/move/n-travel-core.webp), url(/assets/fx/rai/move/n-travel.webp); }
.streak.rai.p { height: 9%; background-image: url(/assets/fx/rai/move/p-travel-core.webp), url(/assets/fx/rai/move/p-travel.webp); }
.railand i, .railand b { position: absolute; inset: -25%; background: center / contain no-repeat; }
.railand i { filter: drop-shadow(0 0 8px #3d7bff); animation: railand .9s ease-out var(--delay) both; }
.railand b { mix-blend-mode: screen; animation: railcore .45s ease-out var(--delay) both; }
@keyframes railand { from { opacity: 0; transform: scale(.5) } 20% { opacity: 1; transform: scale(1.05) } 70% { opacity: 1 } to { opacity: 0; transform: scale(1.15) } }
@keyframes railcore { from { opacity: 0; transform: scale(.6) } 25% { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.25) } }
.railand.r i, .railand.r b { inset: -60% -10% 0; background-position: center bottom; }   /* the rook's lightning pillar strikes from above */
.railand.k i, .railand.k b, .railand.q i, .railand.q b { inset: -45%; }
.railand.k i { background-image: url(/assets/fx/rai/move/k-land.webp); } .railand.k b { background-image: url(/assets/fx/rai/move/k-land-core.webp); }
.railand.q i { background-image: url(/assets/fx/rai/move/q-land.webp); } .railand.q b { background-image: url(/assets/fx/rai/move/q-land-core.webp); }
.railand.r i { background-image: url(/assets/fx/rai/move/r-land.webp); } .railand.r b { background-image: url(/assets/fx/rai/move/r-land-core.webp); }
.railand.b i { background-image: url(/assets/fx/rai/move/b-land.webp); } .railand.b b { background-image: url(/assets/fx/rai/move/b-land-core.webp); }
.railand.n i { background-image: url(/assets/fx/rai/move/n-land.webp); } .railand.n b { background-image: url(/assets/fx/rai/move/n-land-core.webp); }
.railand.p i { background-image: url(/assets/fx/rai/move/p-land.webp); } .railand.p b { background-image: url(/assets/fx/rai/move/p-land-core.webp); }
</style>

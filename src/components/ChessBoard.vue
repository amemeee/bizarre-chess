<script setup>
/* 2D board with animation:
   - a new `lastMove` slides the piece across (knights hop) and shatters any captured piece
   - `ultEvent` ({ fx, glow, squares }) plays the ultimate's effect; pieces it then removes or changes
     get that ultimate's style (burn, freeze, crown, puppet strings, time stop)
   - each square's `mood` (from useGame) drives the piece's body language and aura, and short spoken captions */
import { ref, watch, onUnmounted } from 'vue'
import PieceArt from './PieceArt.vue'
import { lineFor, hoverLineFor } from '../data/pieceLines'
import * as sound from '../lib/sound'

const props = defineProps({
  squares: Array,
  interactive: { type: Boolean, default: true },
  lastMove: Object,
  ultEvent: Object,
  sets: { type: Object, default: () => ({}) }, // { w, b }: exclusive piece set per side (e.g. 'ice'), or none
  trails: { type: Object, default: () => ({}) }, // { w, b }: mark left where that side's pieces land ('ice'), or none
  motions: { type: Object, default: () => ({}) }, // { w, b }: 'puppet' = pieces sway, are carried by strings, yank captures away
})
defineEmits(['select'])

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
const timers = new Set()
const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }
onUnmounted(() => timers.forEach(clearTimeout))

/** CSS colour of the side that made a move (White is you in a duel, a character in spectate). */
const glowOf = color => (color === 'b' ? 'var(--c)' : props.interactive ? '#f4f2fb' : 'var(--cw, #f4f2fb)')

function addFx(e, life) {
  const id = ++seq
  fx.value = [...fx.value, { id, ...e }]
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
  if (!text) return
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
  for (const s of speakers.slice(0, count)) say(s.name, lineFor(s.mood, s.piece.type), s.piece.color, s.mood)
}

/** Mark a square's piece as animating; the mark clears itself so hover/selection lifts work again afterwards. */
function mark(store, sq, value, life) {
  const n = ++seq
  store.value = { ...store.value, [sq]: { ...value, n } }
  later(life, () => { if (store.value[sq]?.n === n) { const { [sq]: _, ...rest } = store.value; store.value = rest } })
}
function arrive(from, to, hop, lift = false, dash = false, skip = false) {
  mark(arrivals, to, { fx: fileOf(from) - fileOf(to), fy: rankOf(to) - rankOf(from), hop: hop && !dash && !skip, lift, dash, skip }, 750)
}
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
    addFx({ kind: 'strings', glow, pos: at(sq) }, 1300)
    addFx(base, 1000 + delay)
  } else if (kind === 'capture') {
    addFx({ ...base, bits: particles(12, () => ({ dx: rand(-140, 140), dy: rand(-160, 40), r: rand(-360, 360), s: rand(0.5, 1.1) })) }, 1100 + delay)
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
    say(s.name, hoverLineFor(s.mood, s.piece.type, own), s.piece.color, s.mood === 'panic' ? 'panic' : 'hover', true)
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
  frost.value = { ...frost.value, [sq]: { born: ply, n: ++seq, kind } }
  if (kind === 'crack') {
    // a heavy landing: a shockwave and a spray of sparks
    addFx({ kind: 'impact', pos: at(sq), bits: particles(12, () => ({ dx: rand(-70, 70), dy: rand(-80, -10), s: rand(0.5, 1) })) }, 900)
  } else {
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
    kind: 'streak',
    pos: { left: (f0 + 0.5) * 12.5 + '%', top: (8 - r0 + 0.5) * 12.5 + '%' },
    len: Math.hypot(dx, dy) * 12.5 + '%', angle: Math.atan2(dy, dx) + 'rad',
  }, 700)
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
  if (inCheck && !wasCheck) sound.check()
  wasCheck = inCheck
}

function onSquares(squares) {
  checkSound(squares)
  const now = new Map()
  for (const s of squares) if (s.piece) now.set(s.name, s.piece.color + s.piece.type)
  const lm = props.lastMove
  if (lm !== lastSeen) {
    lastSeen = lm
    if (!lm) { frost.value = {}; ply = 0 } // new game / undo: the board thaws
    if (lm && prev.size) {
      ply++
      melt()
      if (props.trails?.[lm.color]) { leaveTrail(lm.to, props.trails[lm.color]); sound.trail(props.trails[lm.color]) }
      sound.move(props.motions?.[lm.color])
      const puppet = props.motions?.[lm.color] === 'puppet'
      // a puppeteer's pieces are lifted by strings and carried across
      const skip = props.motions?.[lm.color] === 'skip'
      arrive(lm.from, lm.to, lm.piece === 'n', puppet, props.motions?.[lm.color] === 'charge', skip)
      if (skip) emberTrail(lm)
      if (puppet) addFx({ kind: 'strings', glow: glowOf(lm.color), pos: at(lm.to) }, 1300)
      const time = props.motions?.[lm.color] === 'time'
      if (time) timeTrail(lm)
      const charge = props.motions?.[lm.color] === 'charge'
      if (charge) chargeStreak(lm)
      if (lm.captured) {
        const capSq = lm.flags?.includes('e') ? lm.to[0] + lm.from[1] : lm.to
        const victim = lm.color === 'w' ? 'b' : 'w'
        const capKind = puppet ? 'yank' : time ? 'sand' : charge ? 'knockout' : skip ? 'poof' : 'capture'
        ghost(capSq, victim + lm.captured, capKind, glowOf(lm.color), puppet ? 60 : charge ? 120 : 180)
        sound.capture(capKind)
        say(capSq, lineFor('dying', lm.captured), victim, 'dying')
      }
      const rank = lm.from[1]
      if (lm.flags?.includes('k')) arrive('h' + rank, 'f' + rank, false, puppet)
      if (lm.flags?.includes('q')) arrive('a' + rank, 'd' + rank, false, puppet)
      if (lm.promotion) { morph(lm.to, 'crown'); addFx({ kind: 'beam', glow: '#ffcf4a', pos: at(lm.to), delay: 250 }, 1400) }
    }
    prev = now
    chatter(squares)
    return
  }
  // same move as before, but the board changed: an ultimate removed or transformed pieces
  const style = recent && Date.now() - recent.t < 5000 ? recent : null
  for (const [sq, code] of prev) {
    const cur = now.get(sq)
    if (!cur) {
      const kind = style?.fx === 'burn' ? 'burn' : style?.fx === 'freeze' ? 'freeze' : 'capture'
      ghost(sq, code, kind, style?.glow ?? 'var(--c)')
      sound.capture(kind)
      say(sq, lineFor('dying', code[1]), code[0], 'dying')
    } else if (cur !== code) {
      const kind = style?.fx === 'steal' ? 'puppet' : 'crown'
      morph(sq, kind)
      if (kind === 'puppet') addFx({ kind: 'strings', glow: style.glow, pos: at(sq) }, 1300)
      else addFx({ kind: 'beam', glow: '#ffcf4a', pos: at(sq) }, 1400)
    }
  }
  prev = now
  chatter(squares)
}

/** An ultimate just resolved: mark its targets and, for Time Skip, stop time on the whole board. */
function onUlt(ev) {
  if (!ev) return
  recent = { ...ev, t: Date.now() }
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

    <div class="board" :class="{ timestop: timeStop }">
      <div
        v-for="(s, i) in squares" :key="s.name" class="sq"
        :class="[s.light ? 'l' : 'd', { sel: s.selected, last: s.last, hint: s.hint, cap: s.capture, check: s.check, boom: s.boom, own: interactive && s.piece?.color === 'w', aimable: s.aimable, shielded: s.shielded }]"
        @click="$emit('select', s.name)" @pointerenter="hoverIn(s)" @pointerleave="hoverOut"
      >
        <i v-if="frost[s.name]" :key="frost[s.name].n" class="frost" :class="frost[s.name].kind" :style="{ '--left': frostLeft(s.name) }" />
        <span
          v-if="s.piece" :key="`${s.piece.color}${s.piece.type}-${arrivals[s.name]?.n ?? 0}-${morphs[s.name]?.n ?? 0}`"
          class="piece" :class="{
            arrive: arrivals[s.name], hop: arrivals[s.name]?.hop, lift: arrivals[s.name]?.lift, dash: arrivals[s.name]?.dash, skip: arrivals[s.name]?.skip,
            crown: morphs[s.name]?.kind === 'crown', puppet: morphs[s.name]?.kind === 'puppet',
            'poke-own': pokes[s.name]?.kind === 'own', 'poke-enemy': pokes[s.name]?.kind === 'enemy',
          }"
          :style="arrivals[s.name] ? { '--fx': arrivals[s.name].fx, '--fy': arrivals[s.name].fy } : null"
        >
          <span class="inner" :class="'m-' + (s.mood || 'idle')"><PieceArt
            :type="s.piece.type" :color="s.piece.color" :set="sets[s.piece.color]"
            :sway="motions[s.piece.color] === 'puppet'" :sway-delay="(i * 0.61) % 3.8"
          /></span>
        </span>
      </div>

      <!-- effects layer -->
      <div class="fx" aria-hidden="true">
        <template v-for="f in fx" :key="f.id">
          <!-- a piece leaving the board -->
          <div v-if="f.ghost" class="cell ghost" :class="f.kind" :style="{ ...f.pos, '--g': f.glow, '--delay': f.delay + 'ms', '--dir': f.dir ?? 1 }">
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
          <div v-else-if="f.kind === 'streak'" class="streak" :style="{ ...f.pos, width: f.len, '--angle': f.angle }" />
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
          <div v-else-if="f.kind === 'strings'" class="cell strings" :style="{ ...f.pos, '--g': f.glow }"><i /><i /><i /></div>
          <!-- Ren's time-stop shockwaves -->
          <div v-else-if="f.kind === 'shock'" class="shock" :style="{ '--g': f.glow }"><i /><i /><i /></div>
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
.piece.arrive { z-index: 4; animation: slide .34s cubic-bezier(.3, .7, .25, 1) both; }
.piece.arrive.hop { animation: hop .42s cubic-bezier(.3, .7, .25, 1) both; }
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
.piece.arrive.lift { animation: lift .65s cubic-bezier(.45, 0, .25, 1) both; }
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
.piece.arrive.skip { animation: floatArc .55s cubic-bezier(.45, .05, .3, 1) both; }
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
.piece.arrive.dash { animation: dash .3s cubic-bezier(.75, 0, .3, 1) both; }
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
  content: ''; position: absolute; inset: -14%; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, #ffd27a 0 1.2deg, transparent 1.2deg 30deg);
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 63%, #000 70%, transparent 71%); mask: radial-gradient(circle, transparent 62%, #000 63%, #000 70%, transparent 71%);
  filter: drop-shadow(0 0 4px var(--c)); animation: clockring 1.1s ease-out both;
}
.clock::after { content: ''; position: absolute; inset: -6%; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--c) 70%, #ffd27a); box-shadow: 0 0 14px var(--c); animation: clockring 1.1s ease-out both; }
.clock .hand { position: absolute; left: 50%; bottom: 50%; width: 2px; height: 58%; margin-left: -1px; background: linear-gradient(to top, #ffd27a, #fff); transform-origin: 50% 100%; box-shadow: 0 0 6px #ffd27a; animation: sweep 1s cubic-bezier(.4, 0, .2, 1) both; }
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
  .piece.arrive, .piece.arrive.lift, .piece.arrive.dash, .piece.arrive.skip, .piece.crown, .piece.puppet, .piece.poke-own, .piece.poke-enemy, .fx, .sq.check, .sq.hint::before, .inner, .frost { animation: none !important; }
  .fx { display: none; }
  .sq.aimable::before, .sq.shielded::after { animation: none !important; }
}
</style>

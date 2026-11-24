<script setup>
/* The piece collection: every set in the game, who owns it, their ultimate, and how their pieces move.
   A small demo board on the right replays the selected piece making a move and a capture in that owner's style,
   on a loop; ▶ buttons play an ultimate (its cut-in, then its effect on the demo board).
   You come first: your set evolves through the story (bone → dark → awakened), so your entry has a stage switcher.
   The bone stage is also the set you play in Free Battle. */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Chess } from 'chess.js'
import { CHARS } from '../data/characters'
import { CHAPTERS, SETS } from '../data/story'
import { usePlayer, PLAYER_GLOW } from '../composables/usePlayer'
import { PLAYER_ULTS, SHARED_ULTS } from '../composables/useGame'
import { HEROES } from '../composables/usePlayer'
import PieceArt from './PieceArt.vue'
import ChessBoard from './ChessBoard.vue'
import CutIn from './CutIn.vue'
import * as sound from '../lib/sound'

const emit = defineEmits(['back'])

import { SET_NAMES, MOVESETS } from '../data/sets'
const speed = r => (r == null || r === 1 ? 'Normal meter' : r < 1 ? 'Slow meter' : 'Fast meter')

const { ready: hasHero, hero, look } = usePlayer()
// your ultimates: your hero's signature (or both heroes', before you've chosen), then the shared four
const myUlts = computed(() => [
  ...Object.keys(PLAYER_ULTS).filter(k => PLAYER_ULTS[k].hero && (!look.value || PLAYER_ULTS[k].hero === look.value)),
  ...SHARED_ULTS,
])
// your stages, with the story chapters each is played in (e.g. "Chapters 1–3" · Mio, Haru, Kaito)
const STAGES = Object.keys(SETS).map((key, n) => {
  const chs = CHAPTERS.map((ch, i) => ({ i, ch })).filter(x => x.ch.set === key)
  const span = chs.length ? `Chapter${chs.length > 1 ? 's' : ''} ${chs[0].i + 1}${chs.length > 1 ? '–' + (chs[chs.length - 1].i + 1) : ''}` : ''
  return { key, n: n + 1, label: SETS[key].name, lore: SETS[key].text, chapters: span, rivals: chs.map(x => CHARS[x.ch.id].name).join(', ') }
})
// a character whose set evolves (Rai): their stages, like yours
const evolveStages = c => c.evolve?.map((st, i) => ({
  key: st.set, n: i + 1, label: st.name, lore: st.text, set: st.set, moves: c.id, motion: c.motion,
  chapters: st.games ? `After ${st.games} games` : 'From the start', rivals: '', evolve: true,
})) ?? null
const OWNERS = [
  { id: 'you', name: 'You', glow: PLAYER_GLOW, color: 'w', img: null, level: 'Player', stages: STAGES,
    desc: 'Your own pieces. They start as plain bone and change as you climb the tournament.' },
  ...Object.values(CHARS).map(c => ({ locked: !!c.locked, stages: evolveStages(c), id: c.id, name: c.name, glow: c.glow, color: 'b', set: c.pieces ?? null, img: c.img, level: c.level, desc: c.desc, ult: c.ult, motion: c.motion, trail: c.trail })),
]
const TYPES = [['k', 'King'], ['q', 'Queen'], ['r', 'Rook'], ['b', 'Bishop'], ['n', 'Knight'], ['p', 'Pawn']]

const sel = ref('you')
const stage = ref('bone')
const owner = computed(() => OWNERS.find(o => o.id === sel.value))
const curStage = computed(() => owner.value.stages?.find(s => s.key === stage.value) ?? null)
// the owner as currently shown: you take the set and name of the chosen stage (and your character's name)
const own = computed(() => (curStage.value
  ? { ...owner.value, name: owner.value.id === 'you' && hasHero.value ? hero.value.name : owner.value.name, set: curStage.value.set ?? curStage.value.key, setName: SET_NAMES[curStage.value.key], moves: curStage.value.moves ?? curStage.value.key, motion: curStage.value.motion ?? (curStage.value.key === 'awakened' ? 'mist' : null) }
  : { ...owner.value, setName: SET_NAMES[owner.value.id], moves: owner.value.id }))
const piece = ref('k')
watch(sel, () => { piece.value = 'k'; stage.value = owner.value.stages?.[0].key ?? 'bone' })
const alter = ref(false) // a rival's Alter: their set in negative

// is the exclusive set's art there yet? (until then the default obsidian set stands in)
const ready = ref({})
onMounted(() => {
  for (const o of OWNERS) {
    if (!o.set) continue
    const img = new Image()
    img.onload = () => { ready.value = { ...ready.value, [o.id]: true } }
    img.onerror = () => { ready.value = { ...ready.value, [o.id]: false } }
    img.src = `/assets/pieces/${o.set}/K.webp`
  }
})
const comingSoon = computed(() => own.value.set && ready.value[own.value.id] === false)

/* ---- demo board: the selected piece makes a quiet move, then a capture, then it all resets ----
   Written from White's side ({ square: piece }, then [from, to] moves); a rival plays Black, so it's mirrored. */
const DEMO = {
  k: { pieces: { e2: 'wk', d4: 'br', a8: 'bk' }, moves: [['e2', 'e3'], ['e3', 'd4']], target: 'd4' },
  q: { pieces: { d1: 'wq', g6: 'bn', h1: 'wk', a8: 'bk' }, moves: [['d1', 'd3'], ['d3', 'g6']], target: 'g6' },
  r: { pieces: { b1: 'wr', f4: 'bn', h1: 'wk', a8: 'bk' }, moves: [['b1', 'b4'], ['b4', 'f4']], target: 'f4' },
  b: { pieces: { c1: 'wb', b6: 'bn', h1: 'wk', a8: 'bk' }, moves: [['c1', 'e3'], ['e3', 'b6']], target: 'b6' },
  n: { pieces: { f3: 'wn', f7: 'bp', e1: 'wk', e8: 'bk' }, moves: [['f3', 'e5'], ['e5', 'f7']], target: 'f7' },
  p: { pieces: { e2: 'wp', d5: 'bn', h1: 'wk', a8: 'bk' }, moves: [['e2', 'e4'], ['e4', 'd5']], target: 'd5' },
}
const flipSq = sq => sq[0] + (9 - Number(sq[1]))
const flipCode = c => (c[0] === 'w' ? 'b' : 'w') + c[1]
function demoFor(type, color) {
  const d = DEMO[type]
  if (color === 'w') return d
  return {
    pieces: Object.fromEntries(Object.entries(d.pieces).map(([sq, c]) => [flipSq(sq), flipCode(c)])),
    moves: d.moves.map(m => m.map(flipSq)), target: flipSq(d.target),
  }
}
function setup(d, color) {
  const g = new Chess()
  g.clear()
  for (const [sq, c] of Object.entries(d.pieces)) g.put({ color: c[0], type: c[1] }, sq)
  const parts = g.fen().split(' '); parts[1] = color; parts[2] = '-'; parts[3] = '-'
  g.load(parts.join(' '))
  return g
}
const board = ref([])
const last = ref(null)
let game = null, step = 0, timer = null
const toSquares = g => g.board().flatMap((row, r) => row.map((p, f) => ({ name: 'abcdefgh'[f] + (8 - r), light: (r + f) % 2 === 0, piece: p })))
const demo = computed(() => demoFor(piece.value, own.value.color))
function demoStep() {
  const d = demo.value
  if (step === 0 || !game) { game = setup(d, own.value.color); last.value = null }
  else {
    // keep it this side's turn, so both moves are theirs
    const parts = game.fen().split(' '); parts[1] = own.value.color; parts[3] = '-'
    game.load(parts.join(' '))
    const [from, to] = d.moves[step - 1]
    try { last.value = game.move({ from, to, promotion: 'q' }) } catch { step = 0; return restartDemo() }
  }
  board.value = toSquares(game)
  step = (step + 1) % (d.moves.length + 1)
  timer = setTimeout(demoStep, step === 0 ? 2600 : step === 1 ? 900 : 1500)
}
function restartDemo() { clearTimeout(timer); step = 0; game = null; demoStep() }
watch([sel, stage, piece], restartDemo)

/* ---- ultimate preview: the cut-in, then its effect on the demo board (the pieces stay put) ---- */
const cutChar = ref(null)
const ultEvent = ref(null)
let ultTimer = null
function playUlt(kind = null) {
  clearTimeout(timer); clearTimeout(ultTimer)
  step = 0; game = null; demoStep(); clearTimeout(timer) // a fresh position, held still
  const o = owner.value
  const ult = kind ? PLAYER_ULTS[kind] : o.ult
  // a signature shows its own hero, even before you've picked one
  const h = kind && PLAYER_ULTS[kind].hero ? HEROES[PLAYER_ULTS[kind].hero] : hasHero.value ? HEROES[look.value] : null
  cutChar.value = kind
    ? { id: 'you', name: h?.name ?? own.value.name, glow: o.glow, img: h?.img ?? null, art: 'color', focus: '50% 30%', emoji: { ult: '♛' }, ult }
    : { ...CHARS[o.id] }
  sound.ultimate(kind ? 'you' : o.id)
  ultTimer = setTimeout(() => {
    cutChar.value = null
    // the target: the piece the demo would capture (Shield protects your own piece instead)
    const mine = demo.value.moves[0][0]
    const sq = kind === 'shield' ? mine : demo.value.target
    const fx = ult.boardFx ?? ult.fx
    const squares = kind === 'swap' ? [mine] : ['skip', 'rewind', 'double'].includes(fx) ? [] : [sq]
    ultEvent.value = { fx, glow: ult.glow ?? o.glow, squares, roll: 1 + Math.floor(Math.random() * 6), n: (ultEvent.value?.n ?? 0) + 1 }
    ultTimer = setTimeout(restartDemo, 2400) // let the effect finish, then go back to the moves
  }, kind ? 1800 : 2400)
}
onUnmounted(() => clearTimeout(ultTimer))
onMounted(restartDemo)
onUnmounted(() => clearTimeout(timer))
const boardSets = computed(() => ({ [own.value.color]: own.value.set }))
const boardMotions = computed(() => ({ [own.value.color]: own.value.motion }))
const boardTrails = computed(() => ({ [own.value.color]: own.value.trail }))

const key = e => {
  if (e.key === 'Escape') return emit('back')
  const i = OWNERS.findIndex(o => o.id === sel.value)
  if (e.key === 'ArrowDown') sel.value = OWNERS[(i + 1) % OWNERS.length].id
  if (e.key === 'ArrowUp') sel.value = OWNERS[(i + OWNERS.length - 1) % OWNERS.length].id
  const st = owner.value.stages
  if (st && ['1', '2', '3'].includes(e.key)) stage.value = st[Number(e.key) - 1].key
  const j = TYPES.findIndex(t => t[0] === piece.value)
  if (e.key === 'ArrowRight') piece.value = TYPES[(j + 1) % TYPES.length][0]
  if (e.key === 'ArrowLeft') piece.value = TYPES[(j + TYPES.length - 1) % TYPES.length][0]
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section class="show" :class="{ alter: alter && owner.id !== 'you' }" :style="{ '--c': own.glow, '--g': own.glow }">
    <div class="top">
      <button class="back" @click="emit('back')">← Back</button>
      <div>
        <p class="eyebrow">Collection</p>
        <h2>Chess Pieces</h2>
      </div>
    </div>

    <!-- owners -->
    <nav class="owners" aria-label="Piece sets">
      <button v-for="o in OWNERS" :key="o.id" class="owner" :class="{ on: sel === o.id }" :style="{ '--og': o.glow }" @click="sel = o.id">
        <span class="face">
          <img v-if="o.img" :src="o.img" alt="" draggable="false">
          <img v-else-if="o.stages && hasHero" :src="hero.img" alt="" draggable="false">
          <span v-else class="mine"><PieceArt type="k" color="w" /></span>
        </span>
        <span class="who"><b>{{ o.stages && hasHero ? hero.name : o.name }}<i v-if="o.locked" class="lk">🔒</i></b><small>{{ o.stages ? o.stages.map(s => s.label).join(' → ') : SET_NAMES[o.id] }}</small></span>
      </button>
    </nav>

    <!-- the set -->
    <div class="stage">
      <div class="title">
        <span class="caption">{{ curStage ? `${owner.id === 'you' ? 'Your' : own.name + '\'s'} set · stage ${curStage.n} of ${owner.stages.length}` : `${own.name}'s set` }}</span>
        <h3>{{ own.setName }}</h3>
        <div v-if="owner.id !== 'you'" class="altsw" role="tablist" aria-label="Version">
          <button role="tab" :aria-selected="!alter" :class="{ on: !alter }" @click="alter = false">Normal</button>
          <button role="tab" :aria-selected="alter" :class="{ on: alter }" @click="alter = true">Alter</button>
        </div>
        <span v-if="comingSoon" class="soon">Exclusive art coming soon. Showing the default set</span>
        <span v-else-if="curStage?.key === 'awakened'" class="soon">Art coming soon. Showing the dark set for now</span>
      </div>
      <!-- your evolution: pick a stage -->
      <div v-if="owner.stages" class="stages" role="tablist" aria-label="Your set through the story">
        <template v-for="(s, i) in owner.stages" :key="s.key">
          <i v-if="i" class="arrow" aria-hidden="true">→</i>
          <button role="tab" :aria-selected="stage === s.key" class="stagebtn" :class="{ on: stage === s.key }" @click="stage = s.key">
            <span class="mini"><PieceArt type="k" color="w" :set="s.key" /></span>
            <span class="st"><b>{{ s.n }} · {{ s.label }}</b><small>{{ s.chapters }}</small></span>
          </button>
        </template>
      </div>
      <p v-if="curStage" class="lore">{{ curStage.lore }} <span v-if="curStage.evolve">{{ curStage.chapters }}.<template v-if="curStage.n > 1"> (Art coming soon: shows the Spark set for now.)</template></span><span v-else>Story: {{ curStage.chapters }} ({{ curStage.rivals }}).<template v-if="curStage.key === 'bone'"> Also your set in Free Battle.</template></span></p>
      <!-- the piece on its pedestal, and beside it the demo board playing that piece's move and capture -->
      <div class="showrow">
        <Transition name="pop" mode="out-in">
          <div :key="own.id + piece" class="hero">
            <i class="pedestal" />
            <span class="big"><PieceArt :type="piece" :color="own.color" :set="own.set" /></span>
            <span class="pname">{{ TYPES.find(t => t[0] === piece)[1] }}</span>
          </div>
        </Transition>
        <div class="demo">
          <span class="demolabel">{{ TYPES.find(t => t[0] === piece)[1] }} · move, then capture</span>
          <ChessBoard
            :squares="board" :last-move="last" :interactive="false" quiet :ult-event="ultEvent"
            :sets="boardSets" :motions="boardMotions" :trails="boardTrails"
          />
        </div>
      </div>
      <div class="row">
        <button
          v-for="([t, label], i) in TYPES" :key="own.id + t" class="thumb" :class="{ on: piece === t }" :style="{ '--n': i }"
          :title="label" @click="piece = t" @pointerenter="piece = t"
        ><PieceArt :type="t" :color="own.color" :set="own.set" /><small>{{ label }}</small></button>
      </div>
    </div>

    <!-- owner, ultimate, moveset -->
    <aside class="info">
      <div class="who-card">
        <img v-if="own.img" :src="own.img" alt="" class="portrait" draggable="false">
        <img v-else-if="owner.stages && hasHero" :src="hero.img" alt="" class="portrait" draggable="false" @error="e => (e.target.style.display = 'none')">
        <div>
          <span class="caption">{{ own.level }}</span>
          <h4>{{ own.name }}</h4>
          <p class="desc">{{ own.desc }}</p>
        </div>
      </div>

      <div class="block">
        <span class="label">{{ own.id === 'you' ? 'Ultimates' : 'Ultimate' }}</span>
        <template v-if="own.ult">
          <p class="ult"><b>{{ own.ult.name }}</b><em>{{ speed(own.ult.charge) }}</em>
            <button class="play" :disabled="!!cutChar" :title="`Play ${own.ult.name}`" @click="playUlt()">▶ Play</button></p>
          <p class="text">{{ own.ult.text }}</p>
        </template>
        <ul v-else class="ults">
          <li v-for="k in myUlts" :key="k" :class="{ sig: !!PLAYER_ULTS[k].hero }">
            <b>{{ PLAYER_ULTS[k].hero ? '★ ' : '' }}{{ PLAYER_ULTS[k].name }}<small v-if="PLAYER_ULTS[k].hero" class="whose">{{ HEROES[PLAYER_ULTS[k].hero].name }}</small><button class="play" :disabled="!!cutChar" :title="`Play ${PLAYER_ULTS[k].name}`" @click="playUlt(k)">▶ Play</button></b>{{ PLAYER_ULTS[k].text }}
          </li>
        </ul>
      </div>

      <div class="block">
        <span class="label">Moveset</span>
        <dl class="moves">
          <dt>Move</dt><dd>{{ MOVESETS[own.moves].move }}</dd>
          <dt>Capture</dt><dd>{{ MOVESETS[own.moves].capture }}</dd>
          <template v-if="MOVESETS[own.moves].mark"><dt>Mark</dt><dd>{{ MOVESETS[own.moves].mark }}</dd></template>
        </dl>
      </div>

    </aside>
    <CutIn v-if="cutChar" :char="cutChar" :style="{ '--c': cutChar.glow }" />
  </section>
</template>

<style scoped>
/* Normal / Alter switch: the Alter (who you meet in a mirror match) is shown as a photographic negative */
.altsw { display: inline-flex; border: 1px solid var(--line); }
.altsw button { border: 0; padding: 5px 12px; font-size: 10.5px; letter-spacing: .2em; color: var(--muted); background: none; }
.altsw button.on { background: #f4f2fb; color: #07070b; }
.altsw button:not(.on):hover:not(:disabled) { background: rgba(255, 255, 255, .06); color: #fff; }
.title .altsw { align-self: flex-start; margin-top: 4px; }
.show.alter .portrait { scale: -1 1; }
.show.alter .big, .show.alter .thumb :deep(.art), .show.alter .demo :deep(.art.b), .show.alter .portrait { filter: grayscale(1) invert(1) contrast(1.1); }
.show {
  --cw: var(--g); /* your pieces (White) glow in the selected owner's colour */
  display: grid; grid-template-columns: 210px minmax(0, 1fr) minmax(300px, 360px); grid-template-rows: auto minmax(0, 1fr); gap: 14px 24px; min-height: 0;
  background: radial-gradient(ellipse 50% 60% at 45% 55%, color-mix(in srgb, var(--g) 14%, transparent), transparent 70%); transition: background .5s;
}
.top { grid-column: 1 / -1; display: flex; align-items: center; gap: 20px; }
.back { background: none; border: 0; padding: 4px 0; color: var(--muted); font-size: 12px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
.top h2 { font-size: clamp(20px, 3.4vh, 30px); letter-spacing: .06em; }

/* owners */
.owners { display: flex; flex-direction: column; gap: 3px; min-height: 0; overflow-y: auto; }
.owner {
  display: flex; align-items: center; gap: 10px; padding: 4px 10px 4px 6px; border: 0; border-left: 2px solid transparent; text-align: left;
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; background: none; color: var(--soft); transition: background .2s, border-color .2s;
}
.owner:hover:not(:disabled) { background: rgba(255, 255, 255, .04); color: var(--text); }
.owner.on { border-left-color: var(--og); background: linear-gradient(90deg, color-mix(in srgb, var(--og) 18%, transparent), transparent); color: var(--text); }
.face { flex: none; width: 34px; height: 34px; overflow: hidden; background: #0d0c14; }
.face img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; filter: grayscale(.5) brightness(.8); transition: filter .3s; }
.owner.on .face img, .owner:hover .face img { filter: none; }
.mine { display: block; width: 100%; height: 100%; padding: 3px; }
/* your evolution: three stage buttons joined by arrows */
.stages { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.stages .arrow { font-style: normal; color: var(--g); opacity: .6; }
.stagebtn {
  display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 6px; border: 1px solid var(--line); background: rgba(255, 255, 255, .02);
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; color: var(--muted);
}
.stagebtn:hover:not(:disabled) { color: var(--text); border-color: var(--line-strong); background: rgba(255, 255, 255, .05); }
.stagebtn.on { color: var(--text); border-color: var(--g); background: color-mix(in srgb, var(--g) 14%, transparent); box-shadow: 0 0 20px -8px var(--g); }
.stagebtn .mini { display: block; width: 34px; height: 34px; }
.st { display: flex; flex-direction: column; gap: 1px; text-align: left; }
.st b { font-family: var(--serif); font-weight: 900; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
.st small { font-size: 10.5px; color: var(--muted); }
.stagebtn.on .st small { color: var(--g); }
.lore { margin-top: 8px; max-width: 60ch; font-size: 12.5px; line-height: 1.5; color: var(--soft); font-style: italic; }
.lore span { font-style: normal; color: var(--muted); }
.who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.who b { font-family: var(--serif); font-weight: 900; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; }
.who small { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk { font-style: normal; font-size: 10px; margin-left: 6px; opacity: .7; }
.owner.on .who small { color: var(--og); }

/* the set */
.stage { position: relative; display: flex; flex-direction: column; min-height: 0; }
.title { display: flex; flex-direction: column; gap: 4px; }
.title h3 { font-family: var(--serif); font-weight: 900; font-size: clamp(26px, 5vh, 48px); letter-spacing: .06em; text-transform: uppercase; line-height: 1; text-shadow: 0 0 30px color-mix(in srgb, var(--g) 45%, transparent); }
.soon { font-size: 11.5px; color: var(--muted); font-style: italic; }
.showrow { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: 20px; }
.hero { flex: 1; min-width: 0; min-height: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 8px; }
.big { position: relative; z-index: 1; display: block; height: min(42vh, 86%); max-width: 100%; aspect-ratio: 1; filter: drop-shadow(0 20px 30px rgba(0, 0, 0, .6)); animation: float 4s ease-in-out infinite; }
@keyframes float { 50% { transform: translateY(-2%) } }
.pedestal { position: absolute; bottom: 30px; left: 50%; width: min(40vh, 70%); aspect-ratio: 4 / 1; translate: -50% 0; border-radius: 50%; background: radial-gradient(ellipse, color-mix(in srgb, var(--g) 45%, transparent), transparent 70%); filter: blur(6px); }
.pname { position: relative; z-index: 1; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .4em; text-transform: uppercase; color: var(--g); }
.pop-enter-active, .pop-leave-active { transition: opacity .2s, transform .2s; }
.pop-enter-from { opacity: 0; transform: translateY(12px) scale(.96); }
.pop-leave-to { opacity: 0; transform: translateY(-8px); }
.row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.thumb {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 8px; border: 1px solid var(--line); background: rgba(255, 255, 255, .02);
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; animation: thumbin .4s both; animation-delay: calc(var(--n) * .05s);
}
@keyframes thumbin { from { opacity: 0; transform: translateY(10px) } }
.thumb :deep(.art), .thumb :deep(svg) { height: clamp(48px, 9vh, 84px); width: auto; aspect-ratio: 1; }
.thumb small { font-family: var(--serif); font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); }
.thumb:hover:not(:disabled), .thumb.on { background: color-mix(in srgb, var(--g) 10%, transparent); border-color: color-mix(in srgb, var(--g) 70%, transparent); color: var(--text); }
.thumb.on small { color: var(--g); }

/* info */
.info { display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow-y: auto; padding-right: 4px; }
.who-card { display: flex; gap: 14px; align-items: center; }
.portrait { flex: none; width: 76px; height: 76px; object-fit: cover; object-position: 50% 30%; box-shadow: 0 0 0 1px var(--line-strong), 0 0 24px -6px var(--g); }
.who-card h4 { font-family: var(--serif); font-weight: 900; font-size: 24px; letter-spacing: .08em; text-transform: uppercase; line-height: 1.1; }
.desc { font-size: 12.5px; line-height: 1.45; color: var(--soft); }
.block { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid var(--line); }
.label { font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); }
.ult { display: flex; align-items: baseline; gap: 10px; }
.ult b { font-family: var(--serif); font-weight: 900; font-size: 16px; letter-spacing: .14em; text-transform: uppercase; color: var(--g); }
.ult em { font-style: normal; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.text { font-size: 12.5px; line-height: 1.5; color: var(--soft); }
.ults { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.ults li { font-size: 12px; line-height: 1.4; color: var(--soft); }
.ults b { display: block; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--text); }
.moves { display: grid; grid-template-columns: 64px 1fr; gap: 6px 10px; margin: 0; }
.moves dt { font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--g); padding-top: 2px; }
.moves dd { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--soft); }
.play {
  margin-left: auto; padding: 3px 9px; font-family: var(--serif); font-weight: 700; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
  border: 1px solid color-mix(in srgb, var(--g) 60%, transparent); color: var(--g); background: color-mix(in srgb, var(--g) 8%, transparent);
}
.play:hover:not(:disabled) { color: #07070b; background: var(--g); border-color: var(--g); }
.ults b { display: flex !important; align-items: center; gap: 8px; }
.ults .play { padding: 2px 8px; font-size: 9px; }
.ults li.sig b { color: #e8e4ff; }
.whose { font-family: var(--serif); font-size: 9px; letter-spacing: .16em; color: var(--muted); font-weight: 700; }
.demolabel { display: block; margin-bottom: 6px; text-align: center; font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
.demo { flex: none; width: min(38vh, 340px); align-self: center; padding: 10px 10px 4px; }
.demo :deep(.board) { box-shadow: 0 20px 50px -24px #000, 0 0 50px -20px color-mix(in srgb, var(--c) 55%, transparent); }
.demo :deep(.files), .demo :deep(.ranks) { display: none; }
.demo :deep(.sq) { font-size: 28px; }

@media (max-width: 960px) {
  .show { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto; overflow-y: auto; }
  .owners { flex-direction: row; overflow-x: auto; overflow-y: hidden; }
  .owner { flex: none; border-left: 0; border-bottom: 2px solid transparent; }
  .owner.on { border-bottom-color: var(--og); }
  .who small { display: none; }
  .stage { min-height: auto; }
  .showrow { flex-direction: column; align-items: center; }
  .hero { flex: none; height: 280px; width: 100%; }
  .demo { width: min(90vw, 320px); }
  .big { height: 220px; }
  .info { overflow: visible; }
}
@media (prefers-reduced-motion: reduce) { .big, .thumb { animation: none; } }
</style>

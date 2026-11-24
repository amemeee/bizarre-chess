<script setup>
/* Spectate: pick two rivals and watch them play each other.
   A versus screen: White on the left, Black on the right, split down a diagonal in their own colours,
   a big VS between them, and the roster along the bottom. Click a side to choose who fills it next. */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ROSTER, CHARS, LEVELS } from '../data/characters'

const props = defineProps({ pair: { type: Array, default: null } }) // [white, black] from last time
const emit = defineEmits(['watch', 'back', 'duel'])
const ids = Object.keys(CHARS) // locked characters (coming soon) can already be watched here
const roster = [...ids, 'random']
const pick = () => ids[Math.floor(Math.random() * ids.length)]

const w = ref(props.pair?.[0] && (CHARS[props.pair[0]] || props.pair[0] === 'random') ? props.pair[0] : 'kaito')
const b = ref(props.pair?.[1] && (CHARS[props.pair[1]] || props.pair[1] === 'random') ? props.pair[1] : 'ren')
const slot = ref('w') // the side the next roster click fills
const RANDOM = { id: 'random', name: 'Random', glow: '#f4f2fb', level: '???', ult: { name: 'Unknown' }, img: null }
const info = id => (id === 'random' ? RANDOM : CHARS[id])
// the same rival on both sides: Black is their Alter (a negative), as in the match itself
const mirror = computed(() => w.value === b.value && w.value !== 'random')
const W = computed(() => info(w.value))
const B = computed(() => (mirror.value ? { ...info(b.value), name: 'Alter ' + info(b.value).name, alter: true } : info(b.value)))
const pips = c => Math.max(0, LEVELS.findIndex(l => l.name === c.level))

function choose(id) {
  if (slot.value === 'w') { w.value = id; slot.value = 'b' } else { b.value = id; slot.value = 'w' }
}
function swap() { [w.value, b.value] = [b.value, w.value] }
function randomize() { w.value = pick(); do { b.value = pick() } while (b.value === w.value) }
const resolve = id => (id === 'random' ? pick() : id)
const watch = () => emit('watch', resolve(w.value), resolve(b.value))

const key = e => {
  if (e.target.closest?.('button') && e.key === 'Enter') return
  if (e.key === 'Escape') emit('back')
  else if (e.key === 'Enter') watch()
  else if (e.key === 'Tab') { e.preventDefault(); slot.value = slot.value === 'w' ? 'b' : 'w' }
  else if (e.key === 's' || e.key === 'S') swap()
  else if (e.key === 'r' || e.key === 'R') randomize()
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const cur = slot.value === 'w' ? w : b
    const i = roster.indexOf(cur.value), d = e.key === 'ArrowRight' ? 1 : -1
    cur.value = roster[(i + d + roster.length) % roster.length]
  }
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section class="spec" :style="{ '--wg': W.glow, '--bg2': B.glow }">
    <div class="top">
      <button class="back" @click="emit('back')">← Back</button>
      <div class="title"><p class="eyebrow">Spectate</p><h2>Pick the matchup</h2></div>
      <div class="modes" role="tablist" aria-label="Game mode">
        <button role="tab" :aria-selected="false" @click="emit('duel')">Duel</button>
        <button role="tab" aria-selected="true" class="on">Spectate</button>
      </div>
    </div>

    <!-- the face-off -->
    <div class="arena">
      <button
        v-for="(side, k) in { w: W, b: B }" :key="k + side.id" class="fighter" :class="[k, { active: slot === k }]"
        :style="{ '--g': side.glow }" @click="slot = k"
      >
        <span class="wash" />
        <img v-if="side.img" :src="side.img" alt="" draggable="false" class="portrait" :class="{ alter: side.alter }">
        <span v-else class="mystery">?</span>
        <span class="meta">
          <i class="color">{{ k === 'w' ? 'White' : 'Black' }}</i>
          <b class="name">{{ side.name }}</b>
          <span class="level">
            <small>{{ side.level }}</small>
            <span class="pips"><i v-for="n in 5" :key="n" :class="{ on: side.id !== 'random' && n <= pips(side) }" /></span>
          </span>
          <span class="ult"><em>Ultimate</em>{{ side.ult.name }}</span>
        </span>
        <span class="choosing">{{ slot === k ? 'Choosing' : 'Click to change' }}</span>
      </button>

      <div class="versus">
        <span class="vs">VS</span>
        <span v-if="mirror" class="mirrortag">Mirror match</span>
        <button class="watch" @click="watch"><b class="edge l" /><span>Watch</span><b class="edge r" /></button>
        <div class="tools">
          <button class="ghost small" title="Swap sides (S)" @click="swap">⇄ Swap</button>
          <button class="ghost small" title="Random matchup (R)" @click="randomize">Random</button>
        </div>
      </div>
    </div>

    <!-- the roster -->
    <div class="roster">
      <button
        v-for="(id, i) in roster" :key="id" class="pick" :class="{ inw: w === id, inb: b === id }"
        :style="{ '--g': info(id).glow, '--n': i }" :title="info(id).name" @click="choose(id)"
      >
        <img v-if="info(id).img" :src="info(id).img" alt="" draggable="false">
        <span v-else class="q">?</span>
        <span class="tags"><b v-if="w === id" class="tw">W</b><b v-if="b === id" class="tb">B</b></span>
        <span class="nm">{{ info(id).name }}</span>
      </button>
    </div>
    <small class="hint">Click a side, then a rival · ←/→ browse · Tab switches side · S swap · R random · Enter watch</small>
  </section>
</template>

<style scoped>
.spec { display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: 14px; min-height: 0; }
.top { display: flex; align-items: center; gap: 20px; }
.back { background: none; border: 0; padding: 4px 0; color: var(--muted); font-size: 12px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
.title h2 { font-size: clamp(18px, 3vh, 26px); letter-spacing: .06em; }
.modes { margin-left: auto; display: inline-flex; border: 1px solid var(--line); }
.modes button { border: 0; padding: 6px 12px; font-size: 10.5px; letter-spacing: .2em; color: #8a8a98; }
.modes button.on { background: #f4f2fb; color: #07070b; }
.modes button:not(.on):hover:not(:disabled) { background: rgba(255, 255, 255, .06); color: #fff; }

/* ---- the face-off: two halves meeting on a diagonal ---- */
.arena { position: relative; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; isolation: isolate; }
.fighter {
  position: relative; overflow: hidden; padding: 0; border: 0; border-radius: 0; text-align: left; text-transform: none; letter-spacing: 0;
  font-family: inherit; font-weight: 400; background: #0b0a11; color: var(--text); transition: filter .3s;
}
.fighter:hover:not(:disabled) { background: #0b0a11; color: var(--text); }
.fighter.w { clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%); margin-right: -6%; }
.fighter.b { clip-path: polygon(12% 0, 100% 0, 100% 100%, 0 100%); margin-left: -6%; }
.fighter:not(.active) { filter: brightness(.72) saturate(.85); }
.fighter:not(.active):hover { filter: brightness(.9); }
/* colour wash from the outer edge */
.wash { position: absolute; inset: 0; z-index: 0; transition: background .5s; }
.w .wash { background: linear-gradient(100deg, color-mix(in srgb, var(--g) 45%, #07070b), #07070b 70%); }
.b .wash { background: linear-gradient(260deg, color-mix(in srgb, var(--g) 45%, #07070b), #07070b 70%); }
.portrait { position: absolute; z-index: 1; top: 0; height: 100%; aspect-ratio: 1; object-fit: cover; object-position: 50% 30%; animation: enter .5s cubic-bezier(.2, .8, .2, 1) both; }
.w .portrait { left: 0; -webkit-mask-image: linear-gradient(90deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); mask-image: linear-gradient(90deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); -webkit-mask-composite: source-in; mask-composite: intersect; }
.b .portrait { right: 0; -webkit-mask-image: linear-gradient(270deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); mask-image: linear-gradient(270deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); -webkit-mask-composite: source-in; mask-composite: intersect; }
.w .portrait { --from: -40px; } .b .portrait { --from: 40px; }
@keyframes enter { from { opacity: 0; transform: translateX(var(--from)) } }
.mystery { position: absolute; z-index: 1; top: 50%; translate: 0 -50%; font-family: var(--serif); font-weight: 900; font-size: min(40vh, 18vw); line-height: 1; color: rgba(244, 242, 251, .18); }
.w .mystery { left: 12%; } .b .mystery { right: 12%; }

.meta { position: absolute; z-index: 2; bottom: 8%; display: flex; flex-direction: column; gap: 6px; text-shadow: 0 0 8px #07070b, 0 0 16px #07070b; }
.w .meta { left: 5%; align-items: flex-start; }
.b .meta { right: 5%; align-items: flex-end; text-align: right; }
.color { font-style: normal; font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; padding: 3px 10px; }
.w .color { background: #f4f2fb; color: #07070b; }
.b .color { background: #07070b; color: #f4f2fb; border: 1px solid #f4f2fb; }
.name { font-family: var(--serif); font-weight: 900; font-size: clamp(44px, 10vh, 96px); line-height: .95; letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 0 40px color-mix(in srgb, var(--g) 60%, transparent), 0 4px 20px rgba(0, 0, 0, .6); }
.level { display: flex; align-items: center; gap: 10px; }
.b .level { flex-direction: row-reverse; }
.level small { font-size: 10.5px; letter-spacing: .24em; text-transform: uppercase; color: #c9c7d6; }
.pips { display: inline-flex; gap: 4px; }
.pips i { width: 14px; height: 4px; transform: skewX(-20deg); background: rgba(244, 242, 251, .18); }
.pips i.on { background: var(--g); box-shadow: 0 0 8px var(--g); }
.ult { font-family: var(--serif); font-weight: 700; font-size: 13px; letter-spacing: .16em; text-transform: uppercase; color: var(--g); }
.ult em { font-style: normal; color: #8a8a98; font-size: 10px; letter-spacing: .24em; margin-right: 8px; }
.choosing { position: absolute; z-index: 2; top: 14px; padding: 4px 10px; background: rgba(7, 7, 11, .75); font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .26em; text-transform: uppercase; color: #8a8a98; }
.w .choosing { left: 5%; } .b .choosing { right: 5%; }
.fighter.active .choosing { color: var(--g); animation: blink 1.4s ease-in-out infinite; }
@keyframes blink { 50% { opacity: .45 } }
/* a bright line along the outer edge of the side being chosen */
.fighter::after { content: ''; position: absolute; z-index: 3; top: 0; bottom: 0; width: 3px; background: var(--g); box-shadow: 0 0 18px var(--g); opacity: 0; transition: opacity .3s; }
.fighter.w::after { left: 0; } .fighter.b::after { right: 0; }
.fighter.active::after { opacity: 1; }

/* the VS in the middle, on the diagonal */
.versus { position: absolute; z-index: 5; left: 50%; top: 50%; translate: -50% -50%; display: flex; flex-direction: column; align-items: center; gap: 14px; pointer-events: none; }
.versus > * { pointer-events: auto; }
.vs {
  font-family: var(--serif); font-weight: 900; font-size: clamp(70px, 16vh, 150px); line-height: .9; letter-spacing: -.02em; font-style: italic;
  background: linear-gradient(100deg, var(--wg) 0 48%, var(--bg2) 52% 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 24px rgba(0, 0, 0, .9)) drop-shadow(0 0 2px #fff); animation: vsin .6s cubic-bezier(.2, 1.4, .4, 1) both;
}
@keyframes vsin { from { opacity: 0; transform: scale(1.8) } }
.watch {
  display: inline-flex; align-items: center; gap: 16px; padding: 8px 4px 8px calc(4px + .45em); border: 0; border-radius: 0; background: rgba(7, 7, 11, .7); backdrop-filter: blur(6px);
  color: #f4f2fb; font-family: var(--serif); font-weight: 900; font-size: clamp(18px, 2.8vh, 24px); letter-spacing: .45em; text-transform: uppercase; transition: text-shadow .3s;
}
.watch:hover:not(:disabled) { background: rgba(7, 7, 11, .85); color: #fff; text-shadow: 0 0 20px #fff; }
.edge { display: block; width: clamp(30px, 4vw, 60px); height: 3px; clip-path: polygon(0 50%, 100% 0, 100% 100%); background: linear-gradient(90deg, transparent, var(--wg)); }
.edge.r { clip-path: polygon(100% 50%, 0 0, 0 100%); background: linear-gradient(270deg, transparent, var(--bg2)); }
.tools { display: flex; gap: 8px; }
.small { padding: 5px 11px; font-size: 10px; background: rgba(7, 7, 11, .7); }

/* ---- the roster ---- */
.roster { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 8px; }
.pick {
  position: relative; aspect-ratio: 1 / 1.05; overflow: hidden; padding: 0; border: 0; border-radius: 0; background: #0d0c14;
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; animation: rin .4s both; animation-delay: calc(var(--n) * .04s);
}
@keyframes rin { from { opacity: 0; transform: translateY(12px) } }
/* the flip mirrors the fade too, so a flipped Black portrait uses White's fade to still melt toward the centre */
.b .portrait.alter { -webkit-mask-image: linear-gradient(90deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); mask-image: linear-gradient(90deg, #000 55%, transparent 92%), linear-gradient(0deg, transparent, #000 22%); }
.portrait.alter { scale: -1 1; filter: grayscale(1) invert(1) contrast(1.1) !important; }
.mirrortag { padding: 2px 8px; font-family: var(--serif); font-weight: 700; font-size: 9.5px; letter-spacing: .24em; text-transform: uppercase; color: #07070b; background: linear-gradient(90deg, #cfe0ff, #fff, #cfe0ff); box-shadow: 0 0 12px rgba(207, 224, 255, .6); white-space: nowrap; }
.pick img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; filter: grayscale(.6) brightness(.6); transition: filter .25s, transform .4s; }
.pick:hover img { filter: none; transform: scale(1.06); }
.pick.inw img, .pick.inb img { filter: none; }
.pick .q { display: grid; place-items: center; height: 100%; font-family: var(--serif); font-weight: 900; font-size: 34px; color: rgba(244, 242, 251, .5); }
.pick::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--g); opacity: .5; }
.pick.inw, .pick.inb { box-shadow: 0 0 0 2px var(--g), 0 0 20px -6px var(--g); }
.nm { position: absolute; left: 0; right: 0; bottom: 3px; padding: 14px 6px 4px; background: linear-gradient(transparent, rgba(7, 7, 11, .9)); font-family: var(--serif); font-weight: 900; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--text); }
.tags { position: absolute; top: 4px; left: 4px; display: flex; gap: 3px; }
.tags b { width: 18px; height: 18px; display: grid; place-items: center; font-family: var(--serif); font-weight: 900; font-size: 10px; }
.tw { background: #f4f2fb; color: #07070b; }
.tb { background: #07070b; color: #f4f2fb; border: 1px solid #f4f2fb; }
.hint { font-size: 10px; text-transform: uppercase; letter-spacing: .2em; color: #55556a; text-align: center; }

@media (max-width: 760px) {
  .arena { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .fighter.w, .fighter.b { clip-path: none; margin: 0; }
  .versus { flex-direction: row; gap: 10px; }
  .vs { font-size: 56px; }
  .tools, .hint { display: none; }
  .name { font-size: 40px; }
  .ult { display: none; }
  .roster { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
  .spec { overflow-x: hidden; overflow-y: auto; }
  .top { flex-wrap: wrap; gap: 10px; }
  .title h2 { font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) { .spec * { animation: none !important; } }
</style>

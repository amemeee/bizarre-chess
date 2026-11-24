<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { CHARS, LEVELS, ROSTER } from '../data/characters'
import { useStats } from '../composables/useStats'
import { HEROES, usePlayer } from '../composables/usePlayer'

const props = defineProps({
  initial: { type: String, default: 'ren' },
  initialMode: { type: String, default: 'duel' }, // open in 'duel' or 'watch' (Spectate)
})
const emit = defineEmits(['pick', 'watch', 'spectate', 'back'])
const { byCharacter } = useStats()
const ids = Object.keys(CHARS)
const sel = ref(CHARS[props.initial] ? props.initial : 'ren')

/* "Random" is a sixth, pseudo opponent: the real one is drawn when you press Fight. */
const RANDOM = {
  id: 'random', name: 'Random', glow: '#f4f2fb', level: '???',
  desc: 'Leave it to fate. Any of the five could be waiting for you.',
  ult: { name: 'Unknown', text: 'Their ultimate is revealed in battle.' },
  emoji: { idle: '?' },
}
const order = [...ids, 'random'] // keyboard / card order
const isRandom = computed(() => sel.value === 'random')
const cur = computed(() => (isRandom.value ? RANDOM : CHARS[sel.value]))
const rec = computed(() => byCharacter.value[sel.value])
const index = computed(() => (isRandom.value ? '??' : String(ids.indexOf(sel.value) + 1).padStart(2, '0')))
// idle videos: fall back to the still portrait if a clip is missing or can't play
const videoFailed = ref({})
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const showVideo = computed(() => !isRandom.value && !!cur.value.idle && !videoFailed.value[cur.value.id] && !reduceMotion)

const resolve = id => (id === 'random' ? ROSTER[Math.floor(Math.random() * ROSTER.length)] : id)
// a locked character (coming soon): shown and previewable, but can't be fought yet
const isLocked = computed(() => !isRandom.value && !!CHARS[sel.value]?.locked)

/* Duel: you vs the selected rival. Spectate: two rivals fight each other (computer vs computer). */
const mode = ref('duel')
const pair = ref({ w: ids[(ids.indexOf(sel.value) + 1) % ids.length], b: sel.value })
const slot = ref('w') // which side the next card click fills in spectate mode
const nameOf = id => (id === 'random' ? 'Random' : CHARS[id].name)
function choose(id) {
  sel.value = id
  if (mode.value !== 'watch') return
  pair.value = { ...pair.value, [slot.value]: id }
  slot.value = slot.value === 'w' ? 'b' : 'w' // click, click: White then Black
}
function editSlot(s) { slot.value = s; sel.value = pair.value[s] }
function setMode(m) { mode.value = m; if (m === 'watch') { slot.value = 'w'; sel.value = pair.value.b } }
if (props.initialMode === 'watch') setMode('watch')
/* Free Battle: who you play as. Shin, Akane, or any rival. Remembered in this browser; by default your story hero. */
const AKEY = 'bizarre-chess:play-as'
const AS = [...Object.values(HEROES).map(h => ({ id: h.key, name: h.name, img: h.img, glow: '#e8e4ff', note: `${h.label} · player ultimates` })),
  ...ids.filter(id => !CHARS[id].hero && !CHARS[id].locked).map(id => ({ id, name: CHARS[id].name, img: CHARS[id].img, glow: CHARS[id].glow, note: CHARS[id].ult.name }))]
const playAs = ref(usePlayer().look.value ?? 'm')
try { const v = localStorage.getItem(AKEY); if (AS.some(a => a.id === v)) playAs.value = v } catch { /* no storage */ }
const asCur = computed(() => AS.find(a => a.id === playAs.value))
// playing as the rival you picked (or Shin vs Shin, Akane vs Akane): a mirror match
const isMirror = computed(() => !isRandom.value && (playAs.value === sel.value || ({ m: 'shin', f: 'akane' })[playAs.value] === sel.value))
function stepAs(d) {
  const i = AS.findIndex(a => a.id === playAs.value)
  playAs.value = AS[(i + d + AS.length) % AS.length].id
  try { localStorage.setItem(AKEY, playAs.value) } catch { /* no storage */ }
}

const fight = () => (isLocked.value ? null : mode.value === 'watch'
  ? emit('watch', resolve(pair.value.w), resolve(pair.value.b))
  : emit('pick', resolve(sel.value), pref.value, playAs.value))

// while Random is selected, flick through every portrait like a slot machine
const shuffleId = ref(ids[0])
let shuffleTimer = null
watch(isRandom, on => {
  clearInterval(shuffleTimer)
  if (on) shuffleTimer = setInterval(() => { shuffleId.value = ids[(ids.indexOf(shuffleId.value) + 1) % ids.length] }, 140)
}, { immediate: true })
onUnmounted(() => clearInterval(shuffleTimer))
// a rival's own difficulty as 1-5 pips on the cards (Easy .. Expert)
const lvlIndex = name => LEVELS.findIndex(l => l.name === name)
const pips = c => Math.max(1, lvlIndex(c.level))

/* Free Battle difficulty: null = each rival plays at their own level, or a LEVELS name for every rival.
   Remembered in this browser. */
const DKEY = 'bizarre-chess:difficulty'
const pref = ref(null)
try { const v = localStorage.getItem(DKEY); if (lvlIndex(v) >= 0) pref.value = v } catch { /* no storage */ }
function setPref(name) {
  pref.value = name
  try { name ? localStorage.setItem(DKEY, name) : localStorage.removeItem(DKEY) } catch { /* no storage */ }
}
// the level you'll actually face: your pick, else the rival's own (unknown for Random)
const ownIdx = computed(() => (isRandom.value ? -1 : lvlIndex(cur.value.level)))
const effIdx = computed(() => (pref.value ? lvlIndex(pref.value) : ownIdx.value))
const effName = computed(() => (effIdx.value >= 0 ? LEVELS[effIdx.value].name : '???'))
function stepPref(d) {
  const base = effIdx.value >= 0 ? effIdx.value : 2
  setPref(LEVELS[Math.min(LEVELS.length - 1, Math.max(0, base + d))].name)
}

// the cards fade in once; after that they stay put (leaving the selected card used to replay its fade-in)
const settled = ref(false)
onMounted(() => setTimeout(() => { settled.value = true }, 1800))

// mouse parallax
const wrap = ref(null)
function move(e) {
  const r = wrap.value.getBoundingClientRect()
  wrap.value.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3))
  wrap.value.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3))
}

// keyboard: arrows to browse, Enter to fight, Esc to go back
function key(e) {
  const i = order.indexOf(sel.value)
  const go = id => { sel.value = id; if (mode.value === 'watch') pair.value = { ...pair.value, [slot.value]: id } }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(order[(i + 1) % order.length])
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(order[(i + order.length - 1) % order.length])
  else if (e.key === 'Tab' && mode.value === 'watch' && !e.target.closest?.('button')) { e.preventDefault(); editSlot(slot.value === 'w' ? 'b' : 'w') }
  else if (mode.value === 'duel' && (e.key === '-' || e.key === '_')) stepPref(-1)
  else if (mode.value === 'duel' && (e.key === '=' || e.key === '+')) stepPref(1)
  else if (e.key === 'Escape') emit('back')
  else if (e.key === 'Enter' && !e.target.closest?.('button')) fight()
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section ref="wrap" class="wrap" :style="{ '--g': cur.glow }" @pointermove="move">
    <!-- LEFT: selected character -->
    <div class="stage">
      <Transition name="word" mode="out-in">
        <div :key="cur.id + 'w'" class="bigword" aria-hidden="true">{{ cur.name }}</div>
      </Transition>

      <Transition name="swap" mode="out-in">
        <div :key="cur.id" class="hero" :class="{ locked: isLocked }">
          <div class="aura" />
          <div v-if="isRandom" class="mystery">
            <img :src="CHARS[shuffleId].img" alt="" draggable="false">
            <span class="q">?</span>
          </div>
          <video
            v-else-if="showVideo" :src="cur.idle" :poster="cur.img" :aria-label="cur.name"
            autoplay muted loop playsinline disablepictureinpicture
            @error="videoFailed = { ...videoFailed, [cur.id]: true }"
          />
          <img v-else-if="cur.img" :src="cur.img" :alt="cur.name" draggable="false">
          <div v-else class="noimg"><span>{{ cur.emoji.idle }}</span><em>Portrait coming soon</em></div>
        </div>
      </Transition>

      <div class="label" :class="{ locked: isLocked }" :key="cur.id">
        <div v-if="cur.villain" class="idx"><em class="vtag">Antagonist</em></div>
        <h2>{{ cur.name }}</h2>
        <p class="desc">{{ cur.desc }}</p>
        <p class="ult"><b>{{ cur.ult.name }}</b>{{ cur.ult.text }}</p>
        <div v-if="mode === 'watch'" class="matchup">
          <button class="chip" :class="{ on: slot === 'w' }" @click="editSlot('w')"><i>White</i>{{ nameOf(pair.w) }}</button>
          <span class="vs">vs</span>
          <button class="chip" :class="{ on: slot === 'b' }" @click="editSlot('b')"><i>Black</i>{{ nameOf(pair.b) }}</button>
        </div>
        <!-- Free Battle: who you play as, ‹ portrait NAME › -->
        <div v-if="mode === 'duel'" class="playas" :style="{ '--ag': asCur.glow }">
          <span class="dlabel">You play as<em v-if="isMirror" class="mirrortag">Mirror match</em></span>
          <div class="stepper">
            <button class="arrow" aria-label="Previous character" @click="stepAs(-1)">‹</button>
            <div class="asval">
              <img :src="asCur.img" alt="" draggable="false">
              <span><b>{{ asCur.name }}</b><small>{{ asCur.note }}</small></span>
            </div>
            <button class="arrow" aria-label="Next character" @click="stepAs(1)">›</button>
          </div>
        </div>
        <!-- Free Battle difficulty: a big ‹ LEVEL › switch right above Fight -->
        <div v-if="mode === 'duel'" class="difficulty">
          <span class="dlabel">Difficulty</span>
          <div class="stepper">
            <button class="arrow" aria-label="Easier" :disabled="effIdx === 0" @click="stepPref(-1)">‹</button>
            <div class="dval">
              <b>{{ effName }}</b>
              <span class="bar"><i v-for="(l, n) in LEVELS" :key="l.name" :class="{ on: n <= effIdx }" /></span>
            </div>
            <button class="arrow" aria-label="Harder" :disabled="effIdx === LEVELS.length - 1" @click="stepPref(1)">›</button>
          </div>
          <button v-if="pref" class="auto" @click="setPref(null)">Use {{ isRandom ? "the rival's" : cur.name + "'s" }} own level</button>
          <span v-else class="note">{{ isRandom ? "The rival's own level" : `${cur.name}'s own level` }}</span>
        </div>
        <div class="row">
          <span v-if="isLocked" class="lockedmsg"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" /><rect x="5" y="10" width="14" height="11" rx="2" /></svg>Locked · Coming soon</span>
          <button v-else class="fight" @click="fight"><b class="edge l" /><span>{{ mode === 'watch' ? 'Watch' : 'Fight' }}</span><b class="edge r" /></button>
          <span v-if="rec && !isRandom" class="rec">{{ rec.win }}W · {{ rec.loss }}L · {{ rec.draw }}D</span>
        </div>
      </div>
    </div>

    <!-- RIGHT: portrait cards -->
    <div class="side">
      <div class="top">
        <button class="back" @click="emit('back')">← Back</button>
        <p class="eyebrow">{{ mode === 'watch' ? `Pick ${slot === 'w' ? 'White' : 'Black'}` : 'Choose your opponent' }}</p>
        <div class="modes" role="tablist" aria-label="Game mode">
          <button role="tab" :aria-selected="mode === 'duel'" :class="{ on: mode === 'duel' }" @click="setMode('duel')">Duel</button>
          <button role="tab" :aria-selected="mode === 'watch'" :class="{ on: mode === 'watch' }" @click="emit('spectate')">Spectate</button>
        </div>
      </div>
      <div class="cards">
        <button
          v-for="c in CHARS" :key="c.id" class="card" :class="{ on: sel === c.id, locked: c.locked, settled }"
          :style="{ '--focus': c.focus, '--n': ids.indexOf(c.id), '--cg': c.glow }"
          @click="choose(c.id)" @dblclick="mode === 'duel' && !c.locked && emit('pick', c.id, pref, playAs)"
        >
          <span v-if="mode === 'watch' && (pair.w === c.id || pair.b === c.id)" class="badges">
            <b v-if="pair.w === c.id" class="w">W</b><b v-if="pair.b === c.id" class="b">B</b>
          </span>
          <span class="thumb">
            <!-- the same portrait as the big preview on the left -->
            <img v-if="c.img" :src="c.img" alt="" draggable="false">
            <span v-else>{{ c.emoji.idle }}</span>
          </span>
          <span v-if="c.villain" class="villain">Antagonist</span>
          <span v-if="c.locked" class="lockbadge" aria-label="Locked"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" /><rect x="5" y="10" width="14" height="11" rx="2" /></svg></span>
          <span class="meta">
            <b>{{ c.name }}</b>
            <em>{{ c.ult.name }}</em>
          </span>
        </button>
        <button
          class="card random" :class="{ on: isRandom }" :style="{ '--n': ids.length, '--cg': RANDOM.glow }"
          @click="choose('random')" @dblclick="mode === 'duel' && fight()"
        >
          <span v-if="mode === 'watch' && (pair.w === 'random' || pair.b === 'random')" class="badges">
            <b v-if="pair.w === 'random'" class="w">W</b><b v-if="pair.b === 'random'" class="b">B</b>
          </span>
          <span class="thumb rnd">
            <span class="faces"><img v-for="id in ROSTER" :key="id" :src="CHARS[id].img" alt="" draggable="false"></span>
            <span class="q">?</span>
          </span>
          <span class="meta">
            <b>Random</b>
            <em>Any rival</em>
          </span>
        </button>
      </div>
      <small class="hint">{{ mode === 'watch' ? 'Pick White, then Black · Tab switches · Enter watches' : 'Arrows browse · − / + difficulty · Enter fights · Esc back' }}</small>
    </div>
  </section>
</template>

<style scoped>
.wrap { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 28px; }

/* ---- left ---- */
.stage { position: relative; overflow: hidden; min-height: 0; isolation: isolate; }
.stage::before { content: ''; position: absolute; inset: -10%; z-index: 0; pointer-events: none; background: radial-gradient(ellipse 60% 55% at 30% 60%, color-mix(in srgb, var(--g) 16%, transparent), transparent 70%); transition: background .5s; }

.bigword {
  position: absolute; left: 0; top: 50%; z-index: 0; white-space: nowrap; pointer-events: none;
  font-family: 'Cinzel', serif; font-weight: 900; font-size: min(40vh, 24vw); line-height: .8; letter-spacing: .02em;
  color: transparent; -webkit-text-stroke: 1px rgba(244, 242, 251, .12);
  translate: calc(var(--mx, 0) * -22px) calc(-50% + var(--my, 0) * -10px);
}

.hero { position: absolute; inset: 0; z-index: 2; translate: calc(var(--mx, 0) * 14px) calc(var(--my, 0) * 8px); }
.aura { position: absolute; left: -4%; bottom: -10%; height: 100%; aspect-ratio: 1; background: radial-gradient(circle, color-mix(in srgb, var(--g) 22%, transparent), transparent 62%); }
.hero img, .hero video {
  position: absolute; left: 0; bottom: 0; height: 100%; aspect-ratio: 1; object-fit: cover; display: block; user-select: none;
  /* fade into the dark on every side: softly at the top and left, longer at the right (under the label) and bottom */
  --fade-x: linear-gradient(90deg, transparent, #000 7%, #000 58%, transparent 92%);
  --fade-y: linear-gradient(0deg, transparent, #000 18%, #000 86%, transparent);
  -webkit-mask-image: var(--fade-x), var(--fade-y); -webkit-mask-composite: source-in;
  mask-image: var(--fade-x), var(--fade-y); mask-composite: intersect;
}
.mystery { position: absolute; left: 0; bottom: 0; height: 100%; aspect-ratio: 1; display: grid; place-items: center; }
.mystery img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) brightness(.45) blur(2px); opacity: .7;
  -webkit-mask-image: radial-gradient(circle at 50% 45%, #000 35%, transparent 70%); mask-image: radial-gradient(circle at 50% 45%, #000 35%, transparent 70%);
}
.q { position: relative; font-family: 'Cinzel', serif; font-weight: 900; line-height: 1; color: #f4f2fb; text-shadow: 0 0 40px rgba(244, 242, 251, .45); }
.mystery .q { font-size: min(46vh, 28vw); animation: qpulse 1.6s ease-in-out infinite; }
@keyframes qpulse { 50% { opacity: .7; transform: scale(.97) } }
.pips.unknown i { animation: pipscan 1.2s infinite; animation-delay: calc(var(--d, 0) * 1s); }
.pips.unknown i:nth-child(2) { --d: .1 } .pips.unknown i:nth-child(3) { --d: .2 } .pips.unknown i:nth-child(4) { --d: .3 } .pips.unknown i:nth-child(5) { --d: .4 }
@keyframes pipscan { 0%, 100% { background: rgba(244, 242, 251, .14) } 30% { background: #f4f2fb } }

/* random card: the five faces in thin strips behind a big ? */
.thumb.rnd { background: #0d0c14; }
.faces { position: absolute; inset: 0; display: flex; }
.faces img { flex: 1; min-width: 0; height: 100%; object-fit: cover; object-position: 50% 25%; filter: grayscale(1) brightness(.5); transform: none !important; }
.card.random:hover .faces img, .card.random.on .faces img { filter: grayscale(.2) brightness(.55); }
.thumb.rnd .q { font-size: clamp(56px, 12vh, 110px); }
.card.random.on .thumb.rnd .q { animation: qpulse 1.6s ease-in-out infinite; }

.noimg { position: absolute; left: 8%; bottom: 24%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.noimg span { font-size: 130px; filter: grayscale(.4) drop-shadow(0 0 30px var(--g)); }
.noimg em { font-size: 11px; font-style: normal; text-transform: uppercase; letter-spacing: .22em; opacity: .55; }

.label { position: absolute; z-index: 4; right: 0; bottom: 0; width: 44%; display: flex; flex-direction: column; gap: 8px; text-align: right; align-items: flex-end; animation: labelin .6s both; }
@keyframes labelin { from { opacity: 0; transform: translateX(24px) } }
/* a pool of shadow behind the text so it reads over bright artwork */
.label::before { content: ''; position: absolute; z-index: -1; inset: -14% -6% -6% -34%; pointer-events: none; background: radial-gradient(ellipse 70% 62% at 66% 58%, rgba(7, 7, 11, .86), rgba(7, 7, 11, .5) 55%, transparent 78%); }
.desc, .ult, .note { text-shadow: 0 1px 10px rgba(7, 7, 11, .9); }
.idx { font-family: 'Cinzel', serif; font-weight: 700; font-size: 18px; letter-spacing: .12em; color: var(--g); }
.idx span { font-size: 12px; color: #fff; opacity: .45; margin-left: 8px; }
.label small { font-size: 10.5px; letter-spacing: .26em; text-transform: uppercase; color: #8a8a98; }
.diff { display: flex; align-items: center; gap: 12px; }
.pips { display: inline-flex; gap: 4px; }
.pips i { width: 14px; height: 4px; background: rgba(244, 242, 251, .14); transform: skewX(-20deg); }
.pips i.on { background: var(--g); box-shadow: 0 0 8px color-mix(in srgb, var(--g) 70%, transparent); }
/* difficulty switch: ‹ LEVEL › with a 7-step bar */
.difficulty { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; margin-top: 6px; }
.dlabel { font-family: 'Cinzel', serif; font-weight: 700; font-size: 10.5px; letter-spacing: .26em; text-transform: uppercase; color: #c9c7d6; }
.stepper { display: flex; align-items: stretch; border: 1px solid rgba(244, 242, 251, .28); background: rgba(7, 7, 11, .72); backdrop-filter: blur(6px); }
.arrow { width: 46px; padding: 0; border: 0; border-radius: 0; font-family: 'Cinzel', serif; font-size: 26px; line-height: 1; color: #f4f2fb; background: none; }
.arrow:hover:not(:disabled) { background: color-mix(in srgb, var(--g) 30%, transparent); color: #fff; }
.arrow:disabled { opacity: .2; }
.dval { min-width: 150px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 10px; border-left: 1px solid rgba(244, 242, 251, .14); border-right: 1px solid rgba(244, 242, 251, .14); }
.dval b { font-family: 'Cinzel', serif; font-weight: 900; font-size: 18px; letter-spacing: .2em; text-transform: uppercase; color: var(--g); text-shadow: 0 0 14px color-mix(in srgb, var(--g) 50%, transparent); }
.bar { display: flex; gap: 3px; }
.bar i { width: 14px; height: 4px; transform: skewX(-20deg); background: rgba(244, 242, 251, .16); }
.bar i.on { background: var(--g); }
.note { font-size: 11px; color: #8a8a98; text-shadow: 0 0 6px #07070b; }
.auto { padding: 3px 10px; border: 1px solid var(--line); font-size: 10px; letter-spacing: .12em; text-transform: none; color: #c9c7d6; background: rgba(7, 7, 11, .6); }
.auto:hover:not(:disabled) { background: rgba(255, 255, 255, .08); color: #fff; }
/* "You play as": a ‹ portrait NAME › switch, in that character's colour */
.playas { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; margin-top: 6px; }
.mirrortag { margin-left: 10px; padding: 2px 8px; font-style: normal; font-size: 9.5px; letter-spacing: .24em; color: #07070b; background: linear-gradient(90deg, #cfe0ff, #fff, #cfe0ff); box-shadow: 0 0 12px rgba(207, 224, 255, .6); }
.asval { min-width: 190px; display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; border-left: 1px solid rgba(244, 242, 251, .14); border-right: 1px solid rgba(244, 242, 251, .14); }
.asval img { width: 38px; height: 38px; object-fit: cover; object-position: 50% 25%; box-shadow: 0 0 0 1px var(--ag); }
.asval span { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; }
.asval b { font-family: 'Cinzel', serif; font-weight: 900; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: var(--ag); }
.asval small { font-size: 10px; letter-spacing: .06em; color: #8a8a98; text-transform: none; }
.pips.sm { margin: 3px 0 1px; } .pips.sm i { width: 9px; height: 3px; }
.pips.sm i.on { background: var(--cg); box-shadow: none; }
.label h2 {
  position: relative; font-family: 'Cinzel', serif; font-weight: 900; text-transform: uppercase; line-height: 1; letter-spacing: .04em;
  font-size: clamp(36px, 8.5vh, 76px); color: #f4f2fb; text-shadow: 0 0 40px color-mix(in srgb, var(--g) 45%, transparent);
}
.desc { font-size: 14px; line-height: 1.5; color: #c9c7d6; max-width: 34ch; }
.ult { font-size: 12.5px; line-height: 1.5; color: #9d9bb0; max-width: 38ch; padding-top: 10px; border-top: 1px solid rgba(244, 242, 251, .16); }
.ult b { display: block; font-family: 'Cinzel', serif; font-weight: 700; font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: var(--g); margin-bottom: 2px; }
.row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: flex-end; margin-top: 6px; }
.rec { font-family: 'Cinzel', serif; font-weight: 700; letter-spacing: .14em; font-size: 12px; color: #8a8a98; }

/* matches the title screen's Play button */
.fight {
  display: inline-flex; align-items: center; gap: 18px; padding: 8px 4px 8px calc(4px + .45em); border: 0; border-radius: 0; background: none; color: #f4f2fb;
  font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(20px, 3.2vh, 28px); letter-spacing: .45em; text-transform: uppercase; transition: text-shadow .3s;
}
.fight:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 22px color-mix(in srgb, var(--g) 90%, transparent); }
.edge { display: block; width: clamp(36px, 5vw, 80px); height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(0 50%, 100% 0, 100% 100%); transition: width .35s; }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(100% 50%, 0 0, 0 100%); }
.fight:hover .edge { width: clamp(56px, 8vw, 130px); }

.swap-enter-active, .swap-leave-active, .word-enter-active, .word-leave-active { transition: opacity .22s, transform .22s; }
.swap-enter-from { opacity: 0; transform: translateX(-32px); }
.swap-leave-to { opacity: 0; transform: translateX(24px); }
.word-enter-from { opacity: 0; transform: translateX(-4%); }
.word-leave-to { opacity: 0; transform: translateX(4%); }

/* ---- right ---- */
.side { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.top { display: flex; align-items: center; gap: 16px; }
.back { background: none; border: 0; padding: 4px 0; color: #8a8a98; font-family: 'Cinzel', serif; font-weight: 700; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; }
.back:hover:not(:disabled) { background: none; color: #fff; }
.modes { margin-left: auto; display: inline-flex; border: 1px solid var(--line); }
.modes button { border: 0; padding: 6px 12px; font-size: 10.5px; letter-spacing: .2em; color: #8a8a98; }
.modes button.on { background: #f4f2fb; color: #07070b; }
.modes button:not(.on):hover:not(:disabled) { background: rgba(255, 255, 255, .06); color: #fff; }
.matchup { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.chip { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 6px 12px; border: 1px solid var(--line); font-size: 14px; letter-spacing: .12em; color: #f4f2fb; }
.chip i { font-style: normal; font-size: 9.5px; letter-spacing: .24em; color: #8a8a98; }
.chip.on { border-color: #f4f2fb; box-shadow: 0 0 20px -6px var(--g); }
.chip:hover:not(:disabled) { background: rgba(255, 255, 255, .06); color: #fff; }
.vs { font-family: 'Cinzel', serif; font-weight: 900; font-size: 13px; letter-spacing: .2em; color: #8a8a98; }
.badges { position: absolute; z-index: 4; top: 8px; left: 8px; display: flex; gap: 4px; }
.badges b { width: 22px; height: 22px; display: grid; place-items: center; font-family: 'Cinzel', serif; font-weight: 900; font-size: 11px; }
.badges .w { background: #f4f2fb; color: #07070b; }
.badges .b { background: #07070b; color: #f4f2fb; border: 1px solid #f4f2fb; }
.eyebrow { font-family: 'Cinzel', serif; font-weight: 700; font-size: 13px; letter-spacing: .3em; text-transform: uppercase; color: #f4f2fb; }
/* ten rivals + Random: a 4-column grid */
.cards { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 12px; padding: 8px 0; }
.card {
  position: relative; display: block; padding: 0; text-align: left; color: #f4f2fb; isolation: isolate; border-radius: 0; overflow: hidden; min-height: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, .04), rgba(255, 255, 255, .01)); border: 0;
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400;
  transition: transform .3s, border-color .3s, background .3s; animation: cardin .6s both; animation-delay: calc(var(--n) * .09s + .1s);
}
@keyframes cardin { from { opacity: 0; transform: translateY(24px) } }
.card:hover:not(:disabled) { background: linear-gradient(180deg, rgba(255, 255, 255, .07), rgba(255, 255, 255, .02)); }
.card.on { transform: translateY(-6px); animation-name: none; box-shadow: 0 18px 40px -14px color-mix(in srgb, var(--cg) 80%, transparent); }
/* a hairline frame in the rival's colour, with an inner glow, marks the selected card */
.card::before { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; border: 1px solid rgba(244, 242, 251, .06); transition: border-color .3s, box-shadow .3s; }
.card:hover::before { border-color: rgba(244, 242, 251, .22); }
.card.on::before { border-color: var(--cg); box-shadow: inset 0 0 28px -8px var(--cg); }
.thumb { position: absolute; inset: 0; display: grid; place-items: center; font-size: 48px; filter: grayscale(.45) brightness(.7); transition: filter .35s; }
.card.on .thumb, .card:hover .thumb, .card:focus-visible .thumb { filter: none; }
.thumb img { width: 100%; height: 100%; object-fit: cover; object-position: var(--focus); transform: scale(1.15); transform-origin: var(--focus); transition: transform .5s cubic-bezier(.2, .8, .2, 1); }
.card:hover .thumb img, .card.on .thumb img { transform: scale(1.25); }
/* full-pose art: whole figure, anchored at the top so the head is never cut */
.thumb img.full { object-position: 50% 0%; transform: none; transform-origin: 50% 20%; }
.card:hover .thumb img.full, .card.on .thumb img.full { transform: scale(1.06); }
.card:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--cg); }
.meta { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; padding: 40px 10px 10px; background: linear-gradient(transparent, rgba(7, 7, 11, .7) 35%, rgba(7, 7, 11, .96)); }
/* character-colour bar along the bottom; full width when selected */
.meta::after { content: ''; position: absolute; left: 0; bottom: 0; height: 3px; width: 28%; background: var(--cg); transition: width .35s cubic-bezier(.2, .8, .2, 1); }
.card.on .meta::after, .card:hover .meta::after { width: 100%; }
.villain { position: absolute; z-index: 4; top: 8px; right: 8px; padding: 2px 7px; font-family: 'Cinzel', serif; font-weight: 700; font-size: 8.5px; letter-spacing: .2em; text-transform: uppercase; background: #d1002c; color: #fff; box-shadow: 0 0 12px rgba(209, 0, 44, .6); }
.vtag { font-style: normal; margin-left: 12px; padding: 2px 8px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; background: #d1002c; color: #fff; vertical-align: 3px; }
.meta .no { font-style: normal; font-family: 'Cinzel', serif; font-weight: 700; font-size: 11px; letter-spacing: .2em; color: #8a8a98; }
.meta b { font-family: 'Cinzel', serif; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; font-size: clamp(12px, 1.9vh, 16px); line-height: 1; white-space: nowrap; }
.meta small { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #8a8a98; }
.meta em { font-style: normal; font-size: 11px; color: #9d9bb0; }
/* locked characters (coming soon): dimmed, with a padlock */
.card.settled { animation: none; }
.card.locked .thumb { filter: grayscale(.9) brightness(.35) !important; }
.lockbadge { position: absolute; z-index: 4; top: 38%; left: 50%; translate: -50% -50%; width: 30px; height: 30px; color: rgba(244, 242, 251, .75); }
.lockbadge svg, .lockedmsg svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.hero.locked img, .hero.locked video { filter: grayscale(.85) brightness(.5); }
.lockedmsg { display: inline-flex; align-items: center; gap: 10px; padding: 10px 4px; font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(16px, 2.6vh, 22px); letter-spacing: .3em; text-transform: uppercase; color: #8a8a98; }
.lockedmsg svg { width: 22px; height: 22px; }
.label.locked .difficulty, .label.locked .playas { opacity: .35; pointer-events: none; }
.hint { font-size: 10px; text-transform: uppercase; letter-spacing: .22em; color: #6c6c82; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .wrap *, .wrap *::before, .wrap *::after { animation: none !important; transition: none !important; }
}

@media (max-width: 760px) {
  .wrap { grid-template-columns: 1fr; grid-template-rows: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
  .label { width: 58%; }
  .desc, .hint, .label .ult { display: none; }
  .diff { flex-direction: row-reverse; gap: 8px; }
  .dval { min-width: 110px; padding: 6px 8px; } .dval b { font-size: 14px; } .arrow { width: 38px; }
  .label h2 { font-size: 44px; }
  .cards { grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 6px; }
  .meta { padding: 20px 6px 8px; } .meta em, .meta small, .meta .no, .meta .pips { display: none; } .meta b { font-size: 12px; }
  .villain { font-size: 7px; padding: 1px 4px; top: 4px; right: 4px; }
  .card.on { transform: none; }
}
</style>

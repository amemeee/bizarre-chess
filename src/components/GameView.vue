<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import PieceArt from './PieceArt.vue'
import ChessBoard from './ChessBoard.vue'
import CharacterPanel from './CharacterPanel.vue'
import CutIn from './CutIn.vue'
import CapturedTray from './CapturedTray.vue'
import PlayerUlt from './PlayerUlt.vue'
import * as sound from '../lib/sound'
import { useGame } from '../composables/useGame'
import { CHARS } from '../data/characters'

defineProps({ story: { type: Boolean, default: false } }) // a story chapter's duel: the end screen leads on to its scene
const emit = defineEmits(['menu', 'rematch', 'story-result', 'story-retry'])
const g = useGame()

// Exit: leaves straight away once the game is over; mid-game the first click asks, a second click within 3s leaves
const confirming = ref(false)
let confirmTimer = null
function exit() {
  if (g.over.value || confirming.value) { clearTimeout(confirmTimer); emit('menu'); return }
  confirming.value = true
  confirmTimer = setTimeout(() => { confirming.value = false }, 3000)
}
onUnmounted(() => clearTimeout(confirmTimer))

// sounds: an ultimate's opening sting (by who fired it), your meter filling up, and the end of the game
watch(() => g.cutin.value, on => { if (on) sound.ultimate(g.cutinChar.value?.id) })
watch(() => g.playerReady.value, (ready, was) => { if (ready && !was) sound.ready() })
watch(() => g.over.value, o => {
  if (!o) return
  if (o.result === 'draw') sound.draw()
  else if (o.result === 'win' || (watching.value && o.result)) sound.win()
  else sound.lose()
})
const watching = computed(() => g.mode.value === 'watch')
// a character with an exclusive piece set (Yuki's ice) uses it for their side; you always play the default set
// a character's landing trail (Yuki's frost), per side
const trails = computed(() => ({
  w: watching.value ? g.white.char.value?.trail ?? null : g.you.value.kind === 'rival' ? CHARS[g.you.value.id].trail ?? null : null,
  b: g.char.value?.trail ?? null,
}))
// how a character's pieces move (Noa's puppets), per side
const motions = computed(() => ({
  w: watching.value ? g.white.char.value?.motion ?? null
    : g.you.value.kind === 'rival' ? CHARS[g.you.value.id].motion ?? null
      // as Shin or Akane: mist in Free Battle, and in the story once your pieces have awakened
      : g.you.value.look && (!g.playerSet.value || g.playerSet.value === 'awakened') ? 'mist' : null,
  b: g.char.value?.motion ?? null,
}))
// captured pieces and material lead
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const worth = list => list.reduce((sum, t) => sum + (VALUE[t] ?? 0), 0)
const whiteLead = computed(() => worth(g.lost.value.b) - worth(g.lost.value.w))
const topLabel = computed(() => `${g.char.value.name} took`)
const bottomLabel = computed(() => (watching.value ? `${g.white.char.value.name} took` : 'You took'))
// whose pieces are on each side, so they speak in that owner's voice
const owners = computed(() => ({
  w: watching.value ? g.white.char.value?.id ?? null : g.you.value.kind === 'rival' ? g.you.value.id : 'you',
  b: g.char.value?.id ?? null,
}))
/* ---- a taken piece flies from its square into the tray of the side that took it ----
   The tray keeps that slot empty while it flies, then the piece pops in. Your own losses fly quicker and flatter. */
const held = ref({ w: [], b: [] }) // by colour of the captured pieces: types in flight
const flyers = ref([])
const trayTop = ref(null), trayBottom = ref(null)
let flyId = 0
const flyTimers = new Set()
const after = (ms, fn) => { const t = setTimeout(() => { flyTimers.delete(t); fn() }, ms); flyTimers.add(t) }
onUnmounted(() => flyTimers.forEach(clearTimeout))
function release(color, type) {
  const list = [...held.value[color]], i = list.indexOf(type)
  if (i >= 0) { list.splice(i, 1); held.value = { ...held.value, [color]: list } }
}
async function onCaptured(e) {
  // White's pieces are shown in the top tray, Black's in the bottom one
  const tray = e.color === 'w' ? trayTop.value : trayBottom.value
  held.value = { ...held.value, [e.color]: [...held.value[e.color], e.type] }
  await nextTick()
  const slot = [...(tray?.$el?.querySelectorAll(`.pc.held[data-t="${e.type}"]`) ?? [])].pop()
  const to = (slot ?? tray?.$el)?.getBoundingClientRect()
  if (!to) return release(e.color, e.type)
  const id = ++flyId
  const s = e.rect.size * 0.8
  after(e.delay, () => {
    flyers.value = [...flyers.value, {
      id, type: e.type, color: e.color, set: e.set, yours: e.yours,
      x0: e.rect.left + (e.rect.size - s) / 2, y0: e.rect.top + (e.rect.size - s) / 2, size: s,
      x1: to.left + to.width / 2 - s / 2, y1: to.top + to.height / 2 - s / 2, end: Math.max(to.width, 22) / s,
    }]
  })
  after(e.delay + (e.yours ? 420 : 680), () => { flyers.value = flyers.value.filter(f => f.id !== id); release(e.color, e.type) })
}
/* ---- losing one of your pieces: red vignette at the screen edges (stronger for bigger pieces);
   a rook or queen also gets a banner, and a queen a crack across the screen ---- */
const PIECE_NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }
const lossFx = ref(null)
let lossN = 0
function onLost(e) {
  const n = ++lossN
  lossFx.value = { n, tier: e.tier, text: e.tier >= 4 ? `Your ${PIECE_NAME[e.type].toLowerCase()} has fallen` : e.tier >= 3 ? `${PIECE_NAME[e.type]} lost` : '' }
  after(e.tier >= 4 ? 2200 : 1300, () => { if (lossFx.value?.n === n) lossFx.value = null })
}
// play the flight once its element exists (Web Animations: an arc up and over, shrinking into the slot)
function launch(el, f) {
  if (!el || el.dataset.go) return
  el.dataset.go = '1'
  const dx = f.x1 - f.x0, dy = f.y1 - f.y0, lift = f.yours ? 20 : 90
  el.animate([
    { transform: 'translate(0, 0) scale(.7) rotate(0deg)', opacity: 0, offset: 0 },
    { transform: `translate(0, -${f.size * 0.25}px) scale(1.15) rotate(0deg)`, opacity: 1, offset: 0.15 },
    { transform: `translate(${dx * 0.5}px, ${Math.min(0, dy) * 0.5 - lift}px) scale(.9) rotate(${dx > 0 ? 12 : -12}deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${f.end}) rotate(0deg)`, opacity: 1, offset: 1 },
  ], { duration: f.yours ? 420 : 680, easing: 'cubic-bezier(.45, 0, .3, 1)', fill: 'forwards' })
}
const pieceSets = computed(() => ({
  w: watching.value ? g.white.char.value?.pieces ?? null : g.playerSet.value,
  b: g.char.value?.pieces ?? null,
}))
</script>

<template>
  <div class="game" :class="{ watching, mirror: g.mirror.value }">
    <!-- a mirror match: a character against themselves -->
    <div v-if="g.mirror.value" :key="'mirror-' + g.char.value.id" class="mirrorbanner" aria-hidden="true">
      <span><i>Mirror match</i><b>{{ CHARS[g.char.value.id].name }} vs {{ g.char.value.name }}</b></span>
    </div>
    <button v-if="!watching" class="exit" :class="{ confirming }" @click="exit">
      <span aria-hidden="true">←</span>{{ confirming ? 'Leave match? Click again' : 'Exit' }}
    </button>
    <!-- spectate: White's character on the left -->
    <CharacterPanel
      v-if="watching" class="pw" side="White" :controls="false" :active="!g.over.value && g.turn.value === 'w'"
      :style="{ '--c': g.white.char.value.glow }"
      :char="g.white.char.value" :face="g.white.face.value" :bubble="g.white.bubble.value" :charge="g.white.charge.value"
      :status="g.statusOf('w')" :losing="-whiteLead >= 5 && !g.over.value"
    />

    <div class="stage">
     <div class="boardcol">
      <!-- pieces taken by the top side (Black) -->
      <CapturedTray ref="trayTop" :pieces="g.lost.value.w" color="w" :set="pieceSets.w" :lead="-whiteLead" :label="topLabel" :held="held.w" />
      <div class="boardwrap">
        <ChessBoard
          :squares="g.squares.value" :interactive="!watching" :sets="pieceSets" :trails="trails" :motions="motions" :owners="owners" :alter="g.mirror.value ? 'b' : null" :last-move="g.lastMove.value" :ult-event="g.ultEvent.value" :calc-moves="g.calcMoves.value" :path-moves="g.pathMoves.value"
          @select="g.select" @captured="onCaptured" @lost="onLost"
        />
        <Transition name="fade">
          <div v-if="g.over.value" class="over" :class="g.over.value.result">
            <span class="caption">{{ g.over.value.resigned ? 'Resigned' : g.over.value.why ?? (g.over.value.result === 'draw' ? 'Draw' : 'Checkmate') }}</span>
            <h1>{{ g.over.value.title }}</h1>
            <p>{{ g.over.value.msg }}</p>
            <p v-if="g.over.value.explain" class="explain">{{ g.over.value.explain }}</p>
            <div v-if="story" class="btns">
              <button class="blade" @click="$emit('story-result', g.over.value.result)"><b class="edge l" /><span>Continue</span><b class="edge r" /></button>
              <button v-if="g.over.value.result !== 'win'" class="ghost" @click="$emit('story-retry')">Try again</button>
            </div>
            <div v-else class="btns">
              <button class="blade" @click="$emit('rematch')"><b class="edge l" /><span>Rematch</span><b class="edge r" /></button>
              <button class="ghost" @click="$emit('menu')">{{ watching ? 'Change matchup' : 'Change opponent' }}</button>
            </div>
          </div>
        </Transition>
      </div>
      <!-- pieces taken by the bottom side (White: you, or White's character) -->
      <CapturedTray ref="trayBottom" :pieces="g.lost.value.b" color="b" :set="pieceSets.b" :lead="whiteLead" :label="bottomLabel" :held="held.b" />
     </div>

      <!-- spectate controls -->
      <div v-if="watching" class="controls">
        <span class="caption live"><i :class="{ off: g.paused.value || g.over.value }" />{{ g.over.value ? 'Finished' : g.paused.value ? 'Paused' : 'Live' }}</span>
        <button class="ghost" :disabled="!!g.over.value" @click="g.togglePause">{{ g.paused.value ? 'Resume' : 'Pause' }}</button>
        <button class="ghost" @click="g.cycleSpeed">Speed {{ g.speed.value }}×</button>
        <button class="ghost" @click="$emit('menu')">Exit</button>
      </div>
    </div>

    <div class="right">
      <!-- the opponent in a duel / Black's character in spectate -->
      <CharacterPanel
        :side="watching ? 'Black' : ''" :controls="!watching" :active="watching && !g.over.value && g.turn.value === 'b'"
        :char="g.char.value" :face="g.face.value" :bubble="g.bubble.value" :charge="g.charge.value"
        :status="watching ? g.statusOf('b') : g.status.value" :losing="whiteLead >= 5 && !g.over.value" :can-undo="g.canUndo.value" @undo="g.undo" :can-surrender="!g.over.value" @surrender="g.surrender"
      />
      <!-- your ultimate (duels only) -->
      <PlayerUlt
        v-if="!watching" :charge="g.playerCharge.value" :ready="g.playerReady.value" :aim="g.aim.value" :swap-from="g.swapFrom.value" :aim-hint="g.aimHint.value" :you="g.you.value"
        :comeback="g.comeback.value" :can-use="g.canUse" @use="k => { sound.ui(); g.playerUltimate(k) }" @cancel="g.cancelAim"
      />
    </div>
    <!-- you lost a piece: the edges of the screen bleed red; a banner for a rook or queen -->
    <div v-if="lossFx" :key="lossFx.n" class="lossfx" :class="'t' + lossFx.tier" aria-hidden="true">
      <i class="vignette" />
      <i v-if="lossFx.tier >= 4" class="crack" />
      <span v-if="lossFx.text" class="banner"><b>{{ lossFx.text }}</b></span>
    </div>
    <!-- taken pieces in flight to their tray -->
    <div class="flyers" :class="{ mirror: g.mirror.value }" aria-hidden="true">
      <span
        v-for="f in flyers" :key="f.id" :ref="el => launch(el, f)" class="flyer" :class="{ yours: f.yours }"
        :style="{ left: f.x0 + 'px', top: f.y0 + 'px', width: f.size + 'px', height: f.size + 'px' }"
      ><PieceArt :type="f.type" :color="f.color" :set="f.set" /></span>
    </div>
    <CutIn v-if="g.cutin.value" :char="g.cutinChar.value" :style="{ '--c': g.cutinChar.value.glow }" />
  </div>
</template>

<style scoped>
.game { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: minmax(0, 1fr); gap: 32px; padding: 0 8px 8px; }
.game.watching { grid-template-columns: 300px minmax(0, 1fr) 300px; gap: 24px; }
.right { align-self: center; min-height: 0; max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
/* the character panel fills its column (it used to centre itself and shrink to its portrait) */
.right > :deep(aside), .game > :deep(aside) { align-self: stretch; max-height: none; overflow: visible; }
/* duel: a wider, shorter portrait and tighter spacing so the panel and your ultimate fit on a laptop screen */
.game:not(.watching) .right :deep(.portrait) { aspect-ratio: 16 / 9; }
.game:not(.watching) .right :deep(aside) { gap: 12px; }
.game.watching > :deep(aside) { align-self: center; }
.stage { min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.boardcol { display: flex; flex-direction: column; height: 100%; min-height: 0; max-width: 100%; }
.watching .boardcol { height: calc(100% - 52px); }
/* the board takes what's left after the two captured-piece trays */
.boardwrap { position: relative; height: calc(100% - 60px); max-width: 100%; aspect-ratio: 1; padding: 22px; }

/* sits in the header row's empty left corner, level with the Sound button */
.exit {
  position: absolute; z-index: 11; top: -40px; left: 8px; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px;
  border: 1px solid var(--line); background: rgba(7, 7, 11, .6); color: var(--soft);
  font-family: 'Cinzel', serif; font-weight: 700; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; transition: color .2s, border-color .2s, background .2s;
}
.exit:hover:not(:disabled) { color: #fff; border-color: var(--line-strong); background: rgba(255, 255, 255, .06); }
.exit.confirming, .exit.confirming:hover:not(:disabled) { color: #fff; border-color: var(--loss); background: color-mix(in srgb, var(--loss) 22%, transparent); }
/* losing a piece */
.lossfx { position: fixed; inset: 0; z-index: 45; pointer-events: none; }
.lossfx .vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(150, 0, 20, .35) 85%, rgba(90, 0, 10, .6)); animation: bleed .9s ease-out both; }
.lossfx.t1 .vignette { opacity: .45; animation-duration: .6s; }
.lossfx.t2 .vignette { opacity: .7; }
.lossfx.t3 .vignette { background: radial-gradient(ellipse at center, transparent 45%, rgba(160, 0, 24, .45) 80%, rgba(90, 0, 10, .75)); animation-duration: 1.2s; }
.lossfx.t4 .vignette { background: radial-gradient(ellipse at center, rgba(60, 0, 10, .25) 20%, rgba(170, 0, 26, .55) 70%, rgba(70, 0, 8, .9)); animation: bleed 2s ease-out both, throb .55s ease-in-out .9s 2 alternate; }
@keyframes bleed { from { opacity: 0 } 15% { opacity: 1 } to { opacity: 0 } }
@keyframes throb { to { filter: brightness(1.35) } }
.lossfx .crack { position: absolute; left: 50%; top: 46%; width: min(70vh, 60vw); aspect-ratio: 308 / 303; translate: -50% -50%; background: url(/assets/fx/sena/crack.webp) center / contain no-repeat; filter: hue-rotate(140deg) saturate(2) drop-shadow(0 0 10px #ff2a4f); mix-blend-mode: screen; animation: screencrack 2s ease-out both; }
@keyframes screencrack { from { opacity: 0; transform: scale(.2) } 8% { opacity: .95; transform: scale(1) } 70% { opacity: .8 } to { opacity: 0 } }
.lossfx .banner { position: absolute; left: 0; right: 0; top: 50%; translate: 0 -50%; display: flex; justify-content: center; padding: 18px 0; background: linear-gradient(90deg, transparent, rgba(40, 0, 6, .85) 20% 80%, transparent); animation: banner 1.3s cubic-bezier(.2, .8, .2, 1) .15s both; }
.lossfx.t4 .banner { animation-duration: 2s; }
.lossfx .banner b { font-family: var(--serif); font-weight: 900; font-size: clamp(22px, 4.5vh, 40px); letter-spacing: .3em; text-transform: uppercase; color: #ffd6dc; text-shadow: 0 0 24px #ff2a4f; }
.lossfx.t4 .banner b { font-size: clamp(28px, 6vh, 56px); }
@keyframes banner { from { opacity: 0; transform: scaleY(0) } 15% { opacity: 1; transform: scaleY(1) } 70% { opacity: 1; letter-spacing: .3em } to { opacity: 0; letter-spacing: .5em } }
/* mirror match: White's pieces become a pale, silvered reflection of the original, so the two sides read apart */
/* mirror match: the Alter (Black) is a photographic negative: its pieces on the board, in the trays and in flight */
.game.mirror :deep(.board .art.b), .game.mirror :deep(.tray .art.b), .flyers.mirror :deep(.art.b) { filter: grayscale(1) invert(1) contrast(1.1); }
.mirrorbanner { position: fixed; inset: 0; z-index: 44; pointer-events: none; display: grid; place-items: center; animation: mirrorfade 2.6s ease-out both; }
.mirrorbanner span { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 22px 12vw; background: linear-gradient(90deg, transparent, rgba(7, 7, 11, .88) 20% 80%, transparent); }
.mirrorbanner i { font-style: normal; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .5em; text-transform: uppercase; color: var(--c); }
.mirrorbanner b { font-family: var(--serif); font-weight: 900; font-size: clamp(28px, 6vh, 54px); letter-spacing: .14em; text-transform: uppercase; color: #fff; text-shadow: 0 0 24px var(--c); }
/* the name mirrored underneath, like a reflection in still water */
.mirrorbanner b { -webkit-box-reflect: below -6px linear-gradient(transparent 40%, rgba(255, 255, 255, .35)); }
@keyframes mirrorfade { from { opacity: 0; transform: scaleX(.6) } 15% { opacity: 1; transform: none } 75% { opacity: 1 } to { opacity: 0 } }
.flyers { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
.flyer { position: fixed; display: block; opacity: 0; filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .6)) drop-shadow(0 0 10px color-mix(in srgb, var(--c) 50%, transparent)); }
.flyer.yours { filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .6)) grayscale(.4); }
.controls { flex: none; height: 44px; display: flex; align-items: center; gap: 10px; }
.controls button { padding: 8px 14px; font-size: 11px; min-width: 96px; }
.live { display: inline-flex; align-items: center; gap: 8px; margin-right: 8px; color: var(--soft); }
.live i { width: 7px; height: 7px; border-radius: 50%; background: var(--loss); box-shadow: 0 0 10px var(--loss); animation: blink 1s infinite; }
.live i.off { background: var(--muted); box-shadow: none; animation: none; }
@keyframes blink { 50% { opacity: .25 } }

.over {
  position: absolute; inset: 22px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 24px;
  background: radial-gradient(circle, rgba(7, 7, 11, .82), rgba(7, 7, 11, .94)); backdrop-filter: blur(6px);
}
.over h1 { font-size: clamp(40px, 8vh, 80px); letter-spacing: .08em; text-shadow: 0 0 40px color-mix(in srgb, var(--c) 60%, transparent); }
.over.win h1, .over.black h1 { color: var(--text); }
.over.white h1 { color: var(--text); text-shadow: 0 0 40px color-mix(in srgb, var(--cw, #fff) 60%, transparent); }
.over.loss h1 { color: var(--loss); text-shadow: 0 0 40px rgba(255, 95, 138, .5); }
.over p { color: var(--soft); max-width: 34ch; font-size: 14px; line-height: 1.5; }
.over .explain { font-size: 12.5px; color: #ffcf4a; max-width: 40ch; }
.btns { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 14px; }

/* same blade button as Play / Fight */
.blade { display: inline-flex; align-items: center; gap: 16px; border: 0; padding: 8px 4px 8px calc(4px + .4em); font-weight: 900; font-size: 20px; letter-spacing: .4em; }
.blade:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 22px var(--c); }
.edge { display: block; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(0 50%, 100% 0, 100% 100%); transition: width .35s; }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(100% 50%, 0 0, 0 100%); }
.blade:hover .edge { width: 80px; }

.fade-enter-active, .fade-leave-active { transition: opacity .5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 1100px) {
  .game.watching { grid-template-columns: 240px minmax(0, 1fr) 240px; gap: 16px; }
}
@media (max-width: 900px) {
  .exit { position: static; justify-self: start; }
  .game, .game.watching { grid-template-columns: 1fr; grid-template-rows: auto auto; overflow-y: auto; align-content: start; gap: 12px; }
  .game.watching { grid-template-columns: 1fr 1fr; }
  .game.watching .stage { grid-column: 1 / -1; grid-row: 1; }
  /* stacked: every section is as tall as its content (min-height: 0 let the board overflow onto the panel) */
  .stage, .right { display: block; min-height: auto; max-height: none; overflow: visible; }
  .right { display: flex; }
  /* a short banner-style portrait on phones */
  .game:not(.watching) .right :deep(.portrait) { aspect-ratio: 21 / 9; }
  .boardcol, .watching .boardcol { height: auto; width: min(100%, 60dvh); margin: 0 auto; }
  .boardwrap { height: auto; width: 100%; padding: 16px; }
  .controls { justify-content: center; flex-wrap: wrap; height: auto; padding: 4px 0; }
  .over { inset: 16px; }
}
</style>

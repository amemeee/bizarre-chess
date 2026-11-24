<script setup>
/* The title screen: Ren's cover art full-bleed behind everything, the name on the left. The spotlight moves
   from rival to rival every few seconds: their name shows under the title and the page takes their colour.
   Play (or Enter) opens the main menu. */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { CHARS, ROSTER } from '../data/characters'

const emit = defineEmits(['play']) // the chosen character id, or nothing for the Play button
const ids = ROSTER
const spot = ref(Math.floor(Math.random() * ids.length))
const cur = computed(() => CHARS[ids[spot.value]])

let timer = null
function tick() { spot.value = (spot.value + 1) % ids.length }
onMounted(() => { timer = setInterval(tick, 3200) })
onUnmounted(() => clearInterval(timer))

// the page background (on <body>) follows the spotlight
watch(cur, c => document.body.style.setProperty('--home-glow', c.glow), { immediate: true })

const root = ref(null)
function move(e) {
  const r = root.value.getBoundingClientRect()
  root.value.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3))
  root.value.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3))
}
const key = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('play') } }
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section ref="root" class="home" :style="{ '--g': cur.glow }" @pointermove="move">
    <!-- cover art: Ren at the board, full-bleed, with scrims so the title and roster stay readable -->
    <img class="cover" src="/assets/chess/ren-cover.jpg" alt="" draggable="false">
    <div class="scrim" aria-hidden="true" />

    <!-- title -->
    <div class="title">
      <span class="jp">ビザール・チェス</span>
      <h1 aria-label="Bizarre Chess"><span>Bizarre</span><span class="l2">Chess</span></h1>
      <i class="rule" />
      <p class="tag">{{ ids.length }} rivals. One table. Every piece has something to say.</p>
      <button class="play" @click="emit('play')"><b class="edge l" /><span>Play</span><b class="edge r" /></button>
      <em class="hint">Press Enter</em>
      <Transition name="who" mode="out-in">
        <p :key="cur.id" class="who"><i>{{ cur.villain ? 'Antagonist' : 'Rival' }}</i>{{ cur.name }} · {{ cur.level }}</p>
      </Transition>
    </div>

    <div class="vignette" />
  </section>
</template>

<style scoped>
/* the screen runs up behind the header bar (margin-top), so there's no seam above it */
.home { position: relative; overflow: hidden; isolation: isolate; min-height: 0; margin: -48px -16px -16px; color: var(--text); }

/* ---- cover art ---- */
.cover {
  position: absolute; z-index: 0; inset: -2%; width: 104%; height: 104%; max-width: none; object-fit: cover; object-position: 50% 30%;
  translate: calc(var(--mx, 0) * -14px) calc(var(--my, 0) * -8px); animation: coverin 1.6s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes coverin { from { opacity: 0; transform: scale(1.06) } }
.scrim {
  position: absolute; z-index: 1; inset: 0; pointer-events: none;
  background:
    linear-gradient(90deg, rgba(7, 7, 11, .9) 0%, rgba(7, 7, 11, .55) 24%, transparent 42%),
    radial-gradient(ellipse 60% 50% at 50% 100%, color-mix(in srgb, var(--g) 14%, transparent), transparent 70%);
  transition: background 1.2s;
}

/* ---- title ---- */
.title { position: absolute; z-index: 3; left: 5%; top: 50%; translate: 0 -50%; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; animation: titlein .9s .1s cubic-bezier(.2, .8, .2, 1) both; }
@keyframes titlein { from { opacity: 0; transform: translateX(-40px) } }
.jp { font-family: 'Shippori Mincho B1', serif; font-weight: 800; font-size: min(3.4vh, 2vw); letter-spacing: .3em; color: var(--g); transition: color 1.2s; }
h1 { display: flex; flex-direction: column; font-family: 'Cinzel', serif; font-weight: 900; text-transform: uppercase; font-size: min(11vh, 5.6vw); line-height: .9; letter-spacing: .04em; }
h1 span { background: linear-gradient(180deg, #fff 30%, #b9b6c8); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 30px color-mix(in srgb, var(--g) 45%, transparent)); transition: filter 1.2s; }
h1 .l2 { margin-left: .6em; }
.rule { display: block; width: min(420px, 30vw); height: 2px; background: linear-gradient(90deg, var(--g), transparent); transition: background 1.2s; }
.tag { max-width: 30ch; text-shadow: 0 1px 8px #000; font-size: 14px; line-height: 1.5; color: var(--soft); }
.play {
  margin-top: 2vh; display: inline-flex; align-items: center; gap: 20px; padding: 10px 4px 10px calc(4px + .5em); border: 0; border-radius: 0; background: none; color: #f4f2fb;
  font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(26px, 4.6vh, 40px); letter-spacing: .5em; text-transform: uppercase; transition: text-shadow .3s;
}
.play:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 26px var(--g); }
.play:focus-visible { outline: 1px solid #fff; outline-offset: 6px; }
.edge { display: block; width: clamp(40px, 5vw, 90px); height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(0 50%, 100% 0, 100% 100%); transition: width .35s; }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(100% 50%, 0 0, 0 100%); }
.play:hover .edge { width: clamp(60px, 8vw, 140px); }
.hint { font-style: normal; font-size: 10.5px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); padding-left: calc(clamp(40px, 5vw, 90px) + 24px); animation: blink 1.6s infinite; }
@keyframes blink { 50% { opacity: .3 } }
.who { margin-top: 3vh; display: flex; align-items: baseline; gap: 10px; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--soft); }
.who i { font-style: normal; font-size: 9.5px; letter-spacing: .28em; padding: 2px 8px; border: 1px solid var(--g); color: var(--g); }
.who-enter-active, .who-leave-active { transition: opacity .3s, transform .3s; }
.who-enter-from { opacity: 0; transform: translateY(6px); }
.who-leave-to { opacity: 0; transform: translateY(-6px); }

.vignette { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: radial-gradient(ellipse 90% 85% at 50% 50%, transparent 60%, rgba(0, 0, 0, .55)); }

@media (prefers-reduced-motion: reduce) {
  .home *, .home *::before, .home *::after { animation: none !important; transition: none !important; }
}
@media (max-width: 760px) {
  .cover { object-position: 52% 30%; }
  .scrim { background: linear-gradient(180deg, rgba(7, 7, 11, .8) 0%, transparent 30%, transparent 58%, rgba(7, 7, 11, .9) 72%); }
  .title { top: 30%; left: 6%; }
  .jp { font-size: 3.6vw; }
  h1 { font-size: 15vw; }
  .tag, .who { display: none; }
  .play { font-size: 7vw; }
}
</style>

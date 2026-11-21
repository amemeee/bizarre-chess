<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { CHARS } from '../data/characters'

// emits the chosen character id (or nothing, for the Play button)
const emit = defineEmits(['play'])

/* Featured rival: one is picked at random on each visit, and the whole poster takes their aura colour.
   Key art is a cut-out on a transparent background in public/assets/home/.
   A rival whose key art is missing is skipped; Ren is the final fallback. */
const FEATURED = [
  { id: 'ren', art: '/assets/home/ren-knight.webp',
    theme: { base: '#c41e16', light: '#e0301f', dark: '#8e0f0c', ink: 'rgba(70, 0, 0, .28)', shade: 'rgba(40, 0, 0, .45)', halo: 'rgba(255, 190, 170, .38)' } },
  { id: 'noa', art: '/assets/home/noa-strings.webp',
    theme: { base: '#5b2a9e', light: '#7b45c9', dark: '#2a1056', ink: 'rgba(20, 0, 50, .3)', shade: 'rgba(12, 0, 30, .5)', halo: 'rgba(220, 190, 255, .34)' } },
]
const featured = ref(FEATURED[Math.floor(Math.random() * FEATURED.length)])
const star = computed(() => CHARS[featured.value.id])
function artFailed() {
  // try the other featured rival; if Ren's own art is missing, use his full pose
  const other = FEATURED.find(f => f.id !== featured.value.id && !f.failed)
  featured.value.failed = true
  if (other) featured.value = other
  else featured.value = { ...FEATURED[0], art: CHARS.ren.full, failed: true }
}

// the page background lives on <body>, so hand it the theme as CSS variables
function applyTheme(t) {
  const st = document.body.style
  st.setProperty('--home-base', t.base); st.setProperty('--home-light', t.light); st.setProperty('--home-dark', t.dark)
}
watch(featured, f => applyTheme(f.theme), { immediate: true })

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
  <section ref="root" class="home" :style="{ '--ink': featured.theme.ink, '--shade': featured.theme.shade, '--halo': featured.theme.halo, '--base': featured.theme.base }" @pointermove="move">
    <!-- faint line-drawn structures (bridge cables, girders, crane) -->
    <svg class="struct" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2">
        <path d="M250 900 L290 260 L330 900" />
        <path d="M262 600 H318 M270 460 H310 M278 340 H302" />
        <path v-for="i in 9" :key="'c' + i" :d="`M290 ${270 + i * 6} L${-40 + i * 34} ${560 + i * 40}`" />
        <path v-for="i in 9" :key="'d' + i" :d="`M290 ${270 + i * 6} L${640 - i * 18} ${560 + i * 40}`" />
        <path d="M0 640 L900 560 M0 676 L900 596" />
        <path v-for="i in 18" :key="'g' + i" :d="`M${i * 50} ${640 - i * 4.4} L${i * 50 + 25} ${676 - (i * 50 + 25) * .089}`" />
        <path d="M1380 900 L1380 120 L1420 120 L1420 900 M1250 160 H1600 M1260 160 L1400 60 L1540 160" />
        <path v-for="i in 12" :key="'k' + i" :d="`M1380 ${120 + i * 62} L1420 ${151 + i * 62}`" />
        <path d="M560 900 V420 M600 900 V420 M560 420 H600 M560 520 H600 M560 620 H600 M560 720 H600" />
      </g>
    </svg>

    <!-- black brush band behind the title -->
    <div class="band" />

    <!-- soft light behind the rival so they separate from the background -->
    <div class="halo" />

    <!-- key art: the featured rival -->
    <div class="cast" :style="{ '--g': star.glow }">
      <button class="ren" :aria-label="`Fight ${star.name}`" @click="emit('play', star.id)">
        <img :key="featured.art" :src="featured.art" :alt="star.name" draggable="false" @error="artFailed">
        <span class="tag"><i>Featured rival</i><b>{{ star.name }}</b><small>{{ star.level }} · {{ star.ult.name }}</small></span>
      </button>
    </div>

    <!-- title -->
    <div class="title">
      <span class="jp">ビザール・チェス</span>
      <h1 aria-label="Bizarre Chess"><span>Bizarre</span><span class="l2">Chess</span></h1>
      <span class="latin">Chess Duel</span>
      <button class="play" @click="emit('play')"><span>Play</span><i>→</i></button>
      <em class="hint">Press Enter</em>
    </div>

    <div class="vignette" />
    <div class="grain" />
  </section>
</template>

<style scoped>
/* the poster runs up behind the header bar (margin-top), so there's no seam above it */
.home { position: relative; overflow: hidden; isolation: isolate; min-height: 0; margin: -48px -16px -16px; color: #fff; }

.struct { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; color: var(--ink); translate: calc(var(--mx, 0) * -12px) calc(var(--my, 0) * -6px); }

.band {
  position: absolute; z-index: 1; left: -10%; top: 44%; width: 70%; height: 30%; background: #0c0a0a;
  transform: rotate(-8deg) skewX(-18deg); transform-origin: left center; opacity: .9;
  -webkit-mask-image: linear-gradient(90deg, #000 60%, transparent); mask-image: linear-gradient(90deg, #000 60%, transparent);
  animation: bandin .9s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes bandin { from { transform: rotate(-8deg) skewX(-18deg) translateX(-40%); opacity: 0 } }

/* ---- Ren key art ---- */
.cast { position: absolute; z-index: 2; right: 0; top: 0; bottom: 0; width: 54%; translate: calc(var(--mx, 0) * 14px) calc(var(--my, 0) * 8px); }
.ren {
  position: absolute; inset: 0; padding: 0; border: 0; background: none; cursor: pointer;
  text-transform: none; letter-spacing: 0; font-family: inherit; animation: renin 1s .15s cubic-bezier(.2, .8, .2, 1) both;
}
.ren:hover:not(:disabled) { background: none; }
@keyframes renin { from { opacity: 0; translate: 40px 0 } }
.ren img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: 62% 100%; display: block;
  transform-origin: 62% 100%; animation: breathe 6s ease-in-out infinite;
  /* the cutout has no backdrop; a soft shadow lifts him off the page */
  filter: drop-shadow(0 20px 30px rgba(60, 0, 0, .45));
}
.ren:hover img { animation-play-state: paused; }
@keyframes breathe { 50% { transform: translateY(-6px) scale(1.008) } }
.ren:focus-visible { outline: none; }
.ren:focus-visible .tag { box-shadow: 5px 5px 0 var(--g), 0 0 0 2px #fff; }

.halo {
  position: absolute; z-index: 1; right: 4%; top: 6%; width: 46%; aspect-ratio: 1; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, var(--halo), color-mix(in srgb, var(--halo) 30%, transparent) 45%, transparent 70%);
  translate: calc(var(--mx, 0) * 8px) calc(var(--my, 0) * 4px); animation: halo 6s ease-in-out infinite;
}
@keyframes halo { 50% { opacity: .75; transform: scale(1.04) } }
.vignette { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, var(--shade)); }
.tag {
  position: absolute; left: 6%; bottom: 10%; transition: transform .25s; display: flex; flex-direction: column; padding: 6px 14px 8px; background: #0c0a0a;
  transform: skewX(-8deg); box-shadow: 5px 5px 0 var(--g); text-align: left;
}
.tag i { font-style: normal; font-family: 'Anton', 'Impact', sans-serif; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--g); }
.tag b { font-family: 'Anton', 'Impact', sans-serif; font-weight: 400; font-size: clamp(24px, 4.4vh, 40px); line-height: 1; letter-spacing: .04em; text-transform: uppercase; }
.ren:hover .tag { transform: skewX(-8deg) translateY(-4px); }
.tag small { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #ddd; margin-top: 3px; }

/* ---- title ---- */
.title {
  position: absolute; z-index: 3; left: 4%; top: 50%; translate: 0 -54%;
  display: flex; flex-direction: column; align-items: flex-start; pointer-events: none;
  transform: rotate(-8deg); transform-origin: left center; animation: titlein .8s .1s cubic-bezier(.2, .8, .2, 1) both;
}
.title > * { pointer-events: auto; }
@keyframes titlein { from { opacity: 0; transform: rotate(-8deg) translateX(-60px) } }
.jp { margin-left: 22%; font-family: 'Shippori Mincho B1', serif; font-weight: 800; font-size: min(4.6vh, 2.6vw); letter-spacing: .12em; }
h1 {
  display: flex; flex-direction: column; font-family: 'Anton', 'Impact', sans-serif; font-weight: 400; text-transform: uppercase;
  font-size: min(23vh, 11.5vw); line-height: .86; letter-spacing: .005em; color: #fff; transform: skewX(-8deg);
  text-shadow: 6px 6px 0 rgba(0, 0, 0, .28);
}
h1 .l2 { margin-left: 18%; }
.latin { margin-top: 1.4vh; font-family: 'Anton', 'Impact', sans-serif; font-style: italic; font-size: min(5.4vh, 2.8vw); letter-spacing: .06em; text-transform: uppercase; transform: skewX(-8deg); }

.play {
  margin-top: 3.4vh; margin-left: 4%; display: inline-flex; align-items: center; gap: 14px;
  padding: 12px 40px 12px 46px; border: 0; background: #fff; color: var(--base);
  font-family: 'Anton', 'Impact', sans-serif; font-weight: 400; font-size: min(5vh, 2.6vw); letter-spacing: .08em;
  clip-path: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%); transition: background .2s, color .2s, transform .2s;
}
.play:hover:not(:disabled) { background: #0c0a0a; color: #fff; border: 0; transform: translateX(6px); }
.play:active:not(:disabled) { transform: translateX(6px) scale(.97); }
.play:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
.play i { font-style: normal; transition: transform .2s; }
.play:hover i { transform: translateX(6px); }
.hint { margin: 1.4vh 0 0 6%; font-style: normal; font-size: 10.5px; letter-spacing: .24em; text-transform: uppercase; opacity: .75; animation: blink 1.6s infinite; }
@keyframes blink { 50% { opacity: .25 } }

/* printed-poster grain */
.grain { position: absolute; inset: 0; z-index: 5; pointer-events: none; opacity: .18; mix-blend-mode: multiply;
  background-image: radial-gradient(rgba(0, 0, 0, .5) 1px, transparent 1.2px); background-size: 4px 4px; }

@media (prefers-reduced-motion: reduce) {
  .home *, .home *::before, .home *::after { animation: none !important; transition: none !important; }
}

@media (max-width: 760px) {
  .halo { right: 0; top: auto; bottom: 0; width: 90%; }
  .cast { left: 0; width: 100%; top: auto; height: 52%; opacity: .95; }
  .tag { left: auto; right: 6%; }
  .title { top: 30%; }
  .band { top: 22%; width: 110%; }
  .jp { font-size: 4.4vw; }
  h1 { font-size: 17vw; }
  .latin { font-size: 6vw; }
  .play { font-size: 7vw; }
}
</style>

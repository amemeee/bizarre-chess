<script setup>
/* A story scene: an optional chapter title card, then lines of dialogue typed out one by one,
   with the speaker's art and voice. Click / Enter / Space advances (or finishes the line being typed);
   Skip jumps to the end. */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { CHARS } from '../data/characters'
import { usePlayer } from '../composables/usePlayer'
import * as sound from '../lib/sound'

const props = defineProps({
  lines: { type: Array, required: true },
  chapter: { type: String, default: '' }, // e.g. "Chapter 1"
  title: { type: String, default: '' },   // e.g. "The Café Girl"
  action: { type: String, default: 'Continue' }, // label for the last step (e.g. "Fight")
})
const emit = defineEmits(['done'])

const showTitle = ref(!!props.title)
const i = ref(0)
const typed = ref('')
let timer = null

const { hero } = usePlayer()
const fill = t => t.replaceAll('{name}', hero.value.name)
const line = computed(() => { const l = props.lines[i.value]; return l && { ...l, text: fill(l.text) } })
const speaker = id => (id === 'player' ? hero.value : CHARS[id])
const who = computed(() => (line.value?.who && line.value.who !== 'narrator' ? speaker(line.value.who) : null))
const noArt = ref({}) // speakers whose art failed to load (your portrait, until it exists)
const last = computed(() => i.value >= props.lines.length - 1)
const done = computed(() => typed.value.length >= (line.value?.text.length ?? 0))
// the most recent character to speak stays on screen while the narrator talks
const shown = ref(null)
// a line can ask for one of the speaker's mood portraits (`face`), e.g. Kyo losing hope
watch(who, c => { if (c) shown.value = { ...c, faceImg: c.moods?.[line.value?.face] ?? null } }, { immediate: true })
watch(() => line.value?.face, f => { if (who.value && shown.value?.id === who.value.id) shown.value = { ...shown.value, faceImg: who.value.moods?.[f] ?? null } })

function type() {
  clearInterval(timer)
  typed.value = ''
  const text = line.value?.text ?? ''
  if (who.value && who.value.id !== 'player') sound.voice(who.value.id, null, text)
  let n = 0
  timer = setInterval(() => {
    n += 1
    typed.value = text.slice(0, n)
    if (n >= text.length) clearInterval(timer)
  }, 22)
}
function advance() {
  if (showTitle.value) { showTitle.value = false; type(); return }
  if (!done.value) { clearInterval(timer); typed.value = line.value.text; return } // finish the line first
  if (last.value) { emit('done'); return }
  i.value++
  type()
}
function skip() { clearInterval(timer); emit('done') }

const key = e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
  if (e.key === 'Escape') skip()
}
let titleTimer = null
onMounted(() => {
  window.addEventListener('keydown', key)
  if (showTitle.value) titleTimer = setTimeout(() => { if (showTitle.value) advance() }, 1900)
  else type()
})
onUnmounted(() => { window.removeEventListener('keydown', key); clearInterval(timer); clearTimeout(titleTimer) })
</script>

<template>
  <section class="scene" :style="{ '--g': shown?.glow ?? '#8b6bff' }" @click="advance">
    <button class="skip ghost" @click.stop="skip">Skip ›</button>

    <!-- the chapter title card -->
    <Transition name="fade">
      <div v-if="showTitle" class="titlecard">
        <span class="caption">{{ chapter }}</span>
        <h1>{{ title }}</h1>
        <i class="rule" />
      </div>
    </Transition>

    <!-- the speaker -->
    <Transition name="art" mode="out-in">
      <img
        v-if="shown && !showTitle && shown.img && !noArt[shown.id]" :key="shown.id + (shown.faceImg ?? '')" class="art" :class="{ left: shown.id === 'player' }"
        :src="shown.faceImg ?? (shown.fullPending ? shown.img : shown.full ?? shown.img)" :alt="shown.name" draggable="false"
        @error="noArt = { ...noArt, [shown.id]: true }"
      >
    </Transition>

    <!-- the dialogue box -->
    <div v-if="!showTitle && line" class="box" :class="{ narrator: !who }">
      <span v-if="who" class="name">{{ who.name }}</span>
      <p>{{ typed }}<span v-if="!done" class="caret" /></p>
      <span class="hint">
        <template v-if="done">{{ last ? action : 'Next' }} ▾</template>
      </span>
      <span class="dots"><i v-for="(l, n) in lines" :key="n" :class="{ on: n <= i }" /></span>
    </div>
  </section>
</template>

<style scoped>
.scene {
  position: relative; overflow: hidden; min-height: 0; cursor: pointer; user-select: none;
  background: radial-gradient(ellipse 60% 70% at 70% 45%, color-mix(in srgb, var(--g) 22%, transparent), transparent 70%);
  transition: background .6s;
}
.skip { position: absolute; top: 4px; right: 4px; z-index: 10; padding: 6px 12px; font-size: 10.5px; }

.titlecard { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.titlecard h1 { font-size: clamp(36px, 8vh, 72px); letter-spacing: .08em; text-shadow: 0 0 40px color-mix(in srgb, var(--g) 50%, transparent); animation: rise .9s cubic-bezier(.2, .8, .2, 1) both; }
.titlecard .rule { display: block; width: 160px; height: 2px; background: linear-gradient(90deg, transparent, var(--g), transparent); animation: rise .9s .2s both; }
@keyframes rise { from { opacity: 0; transform: translateY(16px) } }

.art {
  position: absolute; z-index: 1; right: 4%; bottom: 0; height: 100%; max-width: 60%; object-fit: contain; object-position: 50% 100%;
  /* fade out on every side, so the art's light backdrop melts into the dark scene instead of showing as a box */
  -webkit-mask-image: radial-gradient(ellipse 50% 56% at 50% 46%, #000 52%, transparent 100%);
  mask-image: radial-gradient(ellipse 50% 56% at 50% 46%, #000 52%, transparent 100%);
  filter: drop-shadow(0 0 30px color-mix(in srgb, var(--g) 30%, transparent));
}
/* you stand on the left, your rivals on the right */
.art.left { right: auto; left: 4%; }
.art-enter-active, .art-leave-active { transition: opacity .35s, transform .35s; }
.art-enter-from { opacity: 0; transform: translateX(30px); }
.art-leave-to { opacity: 0; transform: translateX(-20px); }

.box {
  position: absolute; left: 4%; right: 4%; bottom: 4%; z-index: 3; min-height: 140px; padding: 26px 30px 34px;
  background: rgba(10, 9, 14, .9); border: 1px solid var(--line-strong); backdrop-filter: blur(8px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .55);
}
.box::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--g); }
.box.narrator { border-color: var(--line); text-align: center; }
.box.narrator::before { display: none; }
.box.narrator p { font-style: italic; color: var(--soft); }
.name {
  position: absolute; top: -14px; left: 24px; padding: 4px 14px; background: var(--g); color: #07070b;
  font-family: var(--serif); font-weight: 900; font-size: 13px; letter-spacing: .2em; text-transform: uppercase;
}
.box p { font-size: clamp(15px, 2.3vh, 19px); line-height: 1.6; color: var(--text); max-width: 72ch; }
.box.narrator p { margin: 0 auto; }
.caret { display: inline-block; width: 8px; height: 1em; margin-left: 2px; vertical-align: -2px; background: var(--g); animation: blink .8s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0 } }
.hint { position: absolute; right: 20px; bottom: 10px; font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); animation: bob 1.2s ease-in-out infinite; }
@keyframes bob { 50% { transform: translateY(2px) } }
.dots { position: absolute; left: 30px; bottom: 14px; display: flex; gap: 5px; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--line); }
.dots i.on { background: var(--g); }

.fade-enter-active, .fade-leave-active { transition: opacity .5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .art { right: -10%; max-width: 90%; opacity: .55; }
  .box { min-height: 160px; padding: 24px 18px 34px; }
}
@media (prefers-reduced-motion: reduce) {
  .titlecard h1, .titlecard .rule, .caret, .hint { animation: none; }
}
</style>

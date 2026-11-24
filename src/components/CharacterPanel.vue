<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import * as sound from '../lib/sound'

const props = defineProps({
  char: Object, face: Object, bubble: String, charge: Number, status: String, canUndo: Boolean, canSurrender: Boolean,
  losing: { type: Boolean, default: false }, // far behind in material: a character with a `mask` mood puts it on (Kyo)
  side: { type: String, default: '' },          // 'White' / 'Black' in spectate mode; empty in a duel
  controls: { type: Boolean, default: true },   // show Undo / Surrender
  active: { type: Boolean, default: false },    // spectate: it's this side's turn
})
const emit = defineEmits(['undo', 'surrender'])

// Surrender asks first: the first click arms it, a second click within 3s resigns
const confirming = ref(false)
let confirmTimer = null
function surrender() {
  clearTimeout(confirmTimer)
  if (confirming.value) { confirming.value = false; emit('surrender'); return }
  confirming.value = true
  confirmTimer = setTimeout(() => { confirming.value = false }, 3000)
}
onUnmounted(() => clearTimeout(confirmTimer))

// Characters share one portrait; if it fails to load (or none exists) the mood emoji is shown.
const failed = ref(false)
watch(() => props.char?.id, () => {
  failed.value = false
  for (const src of Object.values(props.char?.moods ?? {})) { const im = new Image(); im.src = src } // preload, so mood swaps are instant
}, { immediate: true })
/* The portrait for the current mood. A character with a `mask` mood (Kyo) hides behind it while losing badly;
   once actually defeated, the `sad` face takes over (Kyo's mask breaks into the silhouette), and his ultimate face still shows. */
const masked = computed(() => !!props.char?.moods?.mask && props.losing && !['sad', 'ult'].includes(props.face?.mood))
const portrait = computed(() => (masked.value ? props.char.moods.mask : props.char?.moods?.[props.face?.mood] ?? props.char?.img))
const MOOD = { idle: 'Calm', happy: 'Pleased', angry: 'Irritated', sad: 'Defeated', shock: 'Shaken', ult: 'Ultimate' }

/* The character voices every new line. The line is matched to the moment it belongs to
   (start, capture, check, win, ult…) so a recorded clip for that moment can play; otherwise they babble. */
const GREETINGS = ['metBeaten', 'metWon', 'metAgain']
/** Does `text` match a line, where the line may contain {w}/{l} number placeholders? */
function fits(line, text) {
  if (line === text) return true
  if (!/\{[wl]\}/.test(line)) return false
  const parts = line.split(/\{[wl]\}/)
  return text.startsWith(parts[0]) && text.endsWith(parts[parts.length - 1]) && text.length > parts.join('').length
}
function momentOf(c, text) {
  if (!c || !text) return null
  if (text.includes(c.ult.name) || text === c.ult.shout) return 'ult'
  for (const [key, val] of Object.entries(c.say)) {
    const lines = Array.isArray(val) ? val : [val]
    if (lines.some(l => fits(l, text))) return GREETINGS.includes(key) ? 'greet' : key
  }
  return null
}
// immediate: the opening greeting is set just before this panel appears, so voice it on mount too
watch(() => props.bubble, text => { if (text) sound.voice(props.char?.id, momentOf(props.char, text), text) }, { immediate: true })
</script>

<template>
  <aside :class="{ spectate: !!side, active }">
    <div class="portrait" :class="[face.anim, face.mood]" :key="face.n">
      <span v-if="char.flirting || char.flustered" class="hearts" :class="{ flustered: char.flustered }" aria-hidden="true"><i v-for="k in 5" :key="k" :style="{ '--k': k }" /></span>
      <img v-if="char.img && !failed" :src="portrait" alt="" :class="{ color: char.art === 'color', alter: char.alter, mooded: portrait !== char.img }" :style="{ transformOrigin: char.focus, objectPosition: char.focus }" @error="failed = true">
      <span v-else class="emoji">{{ char.emoji[face.mood] }}</span>
      <span class="mood caption">{{ masked ? 'Masked' : MOOD[face.mood] }}</span>
    </div>

    <div class="id">
      <span class="caption">{{ char.level }} · {{ side || 'Opponent' }}</span>
      <h2>{{ char.name }}</h2>
      <span class="status" :class="{ mine: status === 'Your turn' }"><i />{{ status || '—' }}</span>
    </div>

    <Transition name="say" mode="out-in">
      <p :key="bubble" class="bubble">“{{ bubble }}”</p>
    </Transition>

    <div class="ult" :class="{ full: charge >= 100 }">
      <div class="ulthead">
        <span class="caption">Ultimate</span>
        <b>{{ char.ult.name }}</b>
      </div>
      <div class="meter"><i :style="{ width: charge + '%' }" /><s v-for="n in 4" :key="n" /></div>
      <p class="ulttext">{{ char.ult.text }}</p>
    </div>

    <div v-if="controls" class="btns">
      <button class="ghost" :disabled="!canUndo" @click="$emit('undo')">Undo</button>
      <button class="ghost surrender" :class="{ confirming }" :disabled="!canSurrender" @click="surrender">{{ confirming ? 'Really resign?' : 'Surrender' }}</button>
    </div>
  </aside>
</template>

<style scoped>
aside { align-self: center; max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; padding: 4px 4px 4px 0; }

.portrait {
  position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--c) 26%, #0d0c14), #08080c 75%);
  transition: background .4s;
}
.portrait::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 5px; height: 22px; transform: translateX(-50%); background: var(--text); clip-path: polygon(0 0, 100% 0, 50% 100%); }
.portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: var(--focus, 50% 30%); transform: scale(2); filter: invert(1); mix-blend-mode: screen; }
.portrait img.color { filter: none; mix-blend-mode: normal; transform: scale(1.25); transition: filter .3s; }
/* an Alter (mirror match): the portrait is a photographic negative */
.portrait img.alter { scale: -1 1; filter: grayscale(1) invert(1) contrast(1.1) !important; }
/* Rai flirting: little lightning hearts float up around his portrait */
.hearts { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.hearts i { position: absolute; bottom: -10%; left: calc(var(--k) * 17% - 8%); width: 14%; aspect-ratio: 1; background: url(/assets/fx/rai/heart.webp) center / contain no-repeat; filter: drop-shadow(0 0 6px #3d7bff); opacity: 0; animation: heartup 3.2s ease-in calc(var(--k) * .6s) infinite; }
/* AI-0 facing Rai: teal hearts that glitch as they rise */
.hearts.flustered i { filter: hue-rotate(-50deg) saturate(1.4) drop-shadow(0 0 6px #00e5c7); animation-name: heartglitch; }
@keyframes heartglitch { 0% { opacity: 0; transform: translateY(0) scale(.6) } 15% { opacity: 1 } 40% { transform: translateY(-160%) translateX(8%) } 42% { transform: translateY(-170%) translateX(-10%) skewX(25deg); opacity: .4 } 45% { transform: translateY(-180%); opacity: 1 } 100% { opacity: 0; transform: translateY(-420%) scale(1) } }
@keyframes heartup { 0% { opacity: 0; transform: translateY(0) scale(.6) } 15% { opacity: 1 } 80% { opacity: .9 } 100% { opacity: 0; transform: translateY(-420%) scale(1) rotate(12deg) } }
/* a portrait drawn for this mood already shows it: no tint on top */
.portrait img.color.mooded { filter: none !important; }
/* colour art shows mood through a tint instead of the background */
.portrait.angry img.color, .portrait.shock img.color { filter: saturate(1.3) contrast(1.05); }
.portrait.sad img.color { filter: saturate(.5) brightness(.85); }
.portrait.ult img.color { filter: saturate(1.4) brightness(1.1); }
.emoji { font-size: 84px; filter: drop-shadow(0 0 24px var(--c)); }
/* the mood, on a dark chip so it reads over light artwork */
.mood { position: absolute; left: 8px; top: 8px; z-index: 1; padding: 3px 8px; background: rgba(7, 7, 11, .72); color: var(--soft); backdrop-filter: blur(4px); }
.portrait.angry, .portrait.shock { background: radial-gradient(circle at 50% 40%, rgba(255, 95, 138, .35), #08080c 75%); }
.portrait.happy { background: radial-gradient(circle at 50% 40%, rgba(255, 212, 0, .22), #08080c 75%); }
.portrait.sad { background: radial-gradient(circle at 50% 40%, rgba(120, 150, 220, .25), #08080c 75%); }
.portrait.ult { background: radial-gradient(circle at 50% 40%, var(--c), #08080c 80%); }
.portrait.react { animation: pop .45s; } .portrait.hurt { animation: shake .5s; }
@keyframes pop { 50% { transform: scale(1.04) } }
@keyframes shake { 20%, 60% { transform: translateX(-8px) } 40%, 80% { transform: translateX(8px) } }

.id { display: flex; flex-direction: column; gap: 6px; }
.id h2 { font-size: clamp(36px, 7vh, 56px); text-shadow: 0 0 34px color-mix(in srgb, var(--c) 45%, transparent); }
.status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.status i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.status.mine { color: var(--text); }
.status.mine i { background: var(--win); box-shadow: 0 0 10px var(--win); }
.status:not(.mine) i { animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: .2 } }

.bubble { font-size: 15px; line-height: 1.55; color: var(--soft); font-style: italic; padding-left: 14px; border-left: 1px solid var(--c); min-height: 48px; }
.say-enter-active, .say-leave-active { transition: opacity .2s, transform .2s; }
.say-enter-from { opacity: 0; transform: translateY(6px); }
.say-leave-to { opacity: 0; }

.ult { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--line); }
.ulthead { display: flex; justify-content: space-between; align-items: baseline; }
.ulthead b { font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--c); }
.meter { position: relative; height: 6px; background: rgba(255, 255, 255, .06); overflow: hidden; }
.meter i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 40%, transparent), var(--c)); box-shadow: 0 0 12px var(--c); transition: width .5s cubic-bezier(.2, .8, .2, 1); }
.meter s { position: relative; float: left; width: 25%; height: 100%; border-right: 2px solid var(--bg); }
.ult.full .meter i { animation: glow .6s infinite alternate; }
.ult.full .ulthead b { text-shadow: 0 0 12px var(--c); }
@keyframes glow { to { filter: brightness(1.7) } }
.ulttext { font-size: 12px; color: var(--muted); line-height: 1.5; }

/* spectate: the side whose turn it is lights up, the other dims slightly */
aside.spectate { gap: 14px; transition: opacity .3s; }
aside.spectate:not(.active) { opacity: .62; }
aside.spectate .id h2 { font-size: clamp(28px, 5.4vh, 44px); }
aside.spectate .ulttext { display: none; }
aside.spectate.active .portrait { box-shadow: 0 0 0 1px var(--c), 0 0 40px -10px var(--c); }
aside.spectate.active .status i { background: var(--c); box-shadow: 0 0 10px var(--c); }

.btns { display: flex; gap: 10px; }
.btns button { flex: 1; padding: 10px; font-size: 11px; }
.surrender:hover:not(:disabled) { border-color: color-mix(in srgb, var(--loss) 60%, transparent); color: #fff; }
.surrender.confirming, .surrender.confirming:hover:not(:disabled) { border-color: var(--loss); color: #fff; background: color-mix(in srgb, var(--loss) 22%, transparent); }

@media (max-width: 900px) {
  aside { align-self: start; }
  .portrait { aspect-ratio: 16 / 7; }
}
</style>

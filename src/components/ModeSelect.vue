<script setup>
/* Choose how to play: Story (the tournament, rival by rival), Free Battle, or Spectate. */
import { computed, onMounted, onUnmounted } from 'vue'
import { CHARS } from '../data/characters'
import { CHAPTERS } from '../data/story'
import { useStory } from '../composables/useStory'

const emit = defineEmits(['story', 'battle', 'watch', 'back'])
const { cleared, finished } = useStory()
const storyNote = computed(() => (finished.value ? 'Tournament cleared' : cleared.value ? `Chapter ${cleared.value + 1} of ${CHAPTERS.length}` : 'Begin the tournament'))

const MODES = computed(() => [
  { key: 'story', title: 'Story', text: 'Climb the Bizarre Chess tournament. Five rivals, in order, with a scene before and after every duel.', note: storyNote.value, art: CHARS.noa.full, glow: CHARS.noa.glow },
  { key: 'battle', title: 'Free Battle', text: 'Pick any rival and fight. Your record against each of them is saved.', note: '5 rivals', art: CHARS.kaito.full, glow: CHARS.kaito.glow },
  { key: 'watch', title: 'Spectate', text: 'Pick two rivals and watch them fight each other.', note: 'Computer vs computer', art: CHARS.yuki.full, glow: CHARS.yuki.glow },
])
function go(k) { emit(k) }
const key = e => {
  if (e.key === 'Escape') emit('back')
  const n = Number(e.key)
  if (n >= 1 && n <= 3) go(MODES.value[n - 1].key)
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section class="modes">
    <div class="top">
      <button class="back" @click="emit('back')">← Back</button>
      <p class="eyebrow">Choose a mode</p>
    </div>
    <div class="cards">
      <button v-for="(m, i) in MODES" :key="m.key" class="mode" :style="{ '--g': m.glow, '--n': i }" @click="go(m.key)">
        <img :src="m.art" alt="" draggable="false">
        <span class="shade" />
        <span class="meta">
          <i class="num">0{{ i + 1 }}</i>
          <b>{{ m.title }}</b>
          <span class="text">{{ m.text }}</span>
          <small>{{ m.note }}</small>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.modes { display: flex; flex-direction: column; gap: 16px; min-height: 0; }
.top { display: flex; align-items: center; gap: 16px; }
.back { background: none; border: 0; padding: 4px 0; color: var(--muted); font-size: 12px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 13px; letter-spacing: .3em; text-transform: uppercase; }

.cards { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.mode {
  position: relative; overflow: hidden; padding: 0; border: 0; text-align: left; text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400;
  background: #0d0c14; min-height: 0; animation: modein .6s both; animation-delay: calc(var(--n) * .1s);
  transition: transform .3s, box-shadow .3s;
}
@keyframes modein { from { opacity: 0; transform: translateY(24px) } }
.mode:hover:not(:disabled), .mode:focus-visible { background: #0d0c14; color: var(--text); transform: translateY(-6px); box-shadow: 0 20px 50px -18px color-mix(in srgb, var(--g) 80%, transparent); }
.mode img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 15%; filter: grayscale(.35) brightness(.7); transition: filter .4s, transform .6s; }
.mode:hover img, .mode:focus-visible img { filter: none; transform: scale(1.04); }
.shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 30%, rgba(7, 7, 11, .85) 62%, #07070b); }
.meta { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 8px; padding: 22px 22px 24px; }
.meta::before { content: ''; position: absolute; left: 22px; top: 0; width: 40px; height: 3px; background: var(--g); transition: width .35s; }
.mode:hover .meta::before { width: 90px; }
.num { font-style: normal; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .2em; color: var(--g); }
.meta b { font-family: var(--serif); font-weight: 900; font-size: clamp(26px, 4.6vh, 40px); letter-spacing: .06em; text-transform: uppercase; line-height: 1; }
.text { font-size: 13.5px; line-height: 1.5; color: var(--soft); }
.meta small { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--g); }

@media (max-width: 760px) {
  .cards { grid-template-columns: 1fr; grid-auto-rows: minmax(150px, 1fr); overflow-y: auto; }
  .text { display: none; }
}
</style>

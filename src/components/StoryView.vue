<script setup>
/* The story map: one chapter per rival, unlocked in order, played as your own character (created the first time
   you open it). Each card shows the piece set you play that chapter with (bone → dark → awakened); a chapter where
   the set changes is marked. */
import { computed, ref } from 'vue'
import { CHARS } from '../data/characters'
import { CHAPTERS, SETS } from '../data/story'
import PieceArt from './PieceArt.vue'
import PlayerSetup from './PlayerSetup.vue'
import { usePlayer } from '../composables/usePlayer'
import { useStory } from '../composables/useStory'

const emit = defineEmits(['play', 'ending', 'back'])
const { cleared, finished, unlocked, reset } = useStory()
const next = computed(() => Math.min(cleared.value, CHAPTERS.length - 1))
const confirming = ref(false)
// the progress bar runs through every rival's colour, in chapter order
const rainbow = `linear-gradient(90deg, ${CHAPTERS.map(ch => CHARS[ch.id].glow).join(', ')})`

const state = i => (i < cleared.value ? 'cleared' : unlocked(i) ? 'next' : 'locked')
const { ready, hero } = usePlayer()
const editing = ref(false)
const evolves = i => i > 0 && CHAPTERS[i].set !== CHAPTERS[i - 1].set
function play(i) { if (unlocked(i)) emit('play', i) }
function doReset() { reset(); confirming.value = false }
</script>

<template>
  <section class="story">
    <div class="top">
      <button class="back" @click="emit('back')">← Back</button>
      <div class="title">
        <p class="eyebrow">Story</p>
        <h2>The Bizarre Chess Tournament</h2>
      </div>
      <button v-if="ready" class="me" title="Change your character" @click="editing = true">
        <span class="caption">Playing as</span><b>{{ hero.name }}</b><i>Edit</i>
      </button>
      <div class="progress">
        <span class="caption">{{ finished ? 'Cleared' : `Chapter ${next + 1} of ${CHAPTERS.length}` }}</span>
        <span class="bar"><i :style="{ width: (cleared / CHAPTERS.length) * 100 + '%', backgroundImage: rainbow, backgroundSize: `${(CHAPTERS.length / Math.max(1, cleared)) * 100}% 100%` }" /></span>
      </div>
    </div>

    <ol class="path">
      <li
        v-for="(ch, i) in CHAPTERS" :key="ch.id" class="chapter" :class="state(i)"
        :style="{ '--g': CHARS[ch.id].glow, '--n': i }"
      >
        <button :disabled="state(i) === 'locked'" @click="play(i)">
          <img :src="CHARS[ch.id].fullPending ? CHARS[ch.id].img : CHARS[ch.id].full ?? CHARS[ch.id].img" alt="" draggable="false">
          <span class="shade" />
          <span class="badge" v-if="state(i) !== 'locked'">{{ state(i) === 'cleared' ? 'Cleared ✓' : 'Next' }}</span>
          <span class="lock" v-else aria-label="Locked">
            <svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3" /><rect x="5" y="10" width="14" height="11" rx="2" /></svg>
          </span>
          <span class="set" :class="{ evolves: evolves(i) && state(i) !== 'locked' }" :title="SETS[ch.set].text">
            <span class="king"><PieceArt type="k" color="w" :set="ch.set" /></span>
            <em>{{ state(i) === 'locked' && evolves(i) ? '???' : SETS[ch.set].name }}<template v-if="evolves(i) && state(i) !== 'locked'"> · New</template></em>
          </span>
          <span class="meta">
            <i>Chapter {{ i + 1 }}</i>
            <b>{{ state(i) === 'locked' ? '???' : CHARS[ch.id].name }}</b>
            <small>{{ state(i) === 'locked' ? 'Beat the previous rival' : ch.title }}</small>
          </span>
        </button>
      </li>
    </ol>

    <PlayerSetup v-if="!ready" title="Before the tournament begins…" @cancel="emit('back')" @done="() => {}" />
    <PlayerSetup v-else-if="editing" title="Edit your character" cancellable @done="editing = false" @cancel="editing = false" />

    <div class="foot">
      <button v-if="finished" class="ending" @click="emit('ending')"><b class="edge l" /><span>Watch the ending</span><b class="edge r" /></button>
      <span class="spacer" />
      <template v-if="cleared > 0">
        <button v-if="!confirming" class="ghost small" @click="confirming = true">Reset progress</button>
        <span v-else class="confirm">
          Start the story over?
          <button class="ghost small" @click="doReset">Reset</button>
          <button class="ghost small" @click="confirming = false">Cancel</button>
        </span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.story { display: flex; flex-direction: column; gap: 16px; min-height: 0; }
.top { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.back { background: none; border: 0; padding: 4px 0; color: var(--muted); font-size: 12px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
.title h2 { font-size: clamp(20px, 3.4vh, 30px); letter-spacing: .06em; }
.progress { margin-left: auto; display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
.bar { height: 4px; background: rgba(255, 255, 255, .08); }
.bar i { display: block; height: 100%; transition: width .6s; }

.path { flex: 1; min-height: 0; list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 14px; counter-reset: ch; }
.chapter { position: relative; min-height: 0; animation: chin .6s both; animation-delay: calc(var(--n) * .08s); }
@keyframes chin { from { opacity: 0; transform: translateY(20px) } }
/* a thin line linking each chapter to the next */
.chapter:not(:last-child):not(:nth-child(5n))::after { content: ''; position: absolute; top: 50%; right: -14px; width: 14px; height: 2px; background: var(--line); }
.chapter.cleared:not(:last-child):not(:nth-child(5n))::after { background: var(--g); }
.chapter button {
  position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; overflow: hidden; text-align: left;
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; background: #0d0c14; transition: transform .3s, box-shadow .3s;
}
.chapter button:hover:not(:disabled) { background: #0d0c14; color: var(--text); transform: translateY(-6px); box-shadow: 0 18px 40px -16px color-mix(in srgb, var(--g) 80%, transparent); }
.chapter img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 8%; transition: filter .4s, transform .6s; }
.chapter.locked img { filter: grayscale(1) brightness(.25) blur(1px); }
.chapter.cleared img { filter: brightness(.75); }
.chapter button:hover img { transform: scale(1.04); }
.shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(7, 7, 11, .9) 75%); }
.chapter.next button { box-shadow: 0 0 0 1px var(--g), 0 0 36px -10px var(--g); }
.badge { position: absolute; top: 10px; left: 10px; z-index: 1; padding: 4px 10px; font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; background: rgba(7, 7, 11, .75); color: var(--g); }
.chapter.next .badge { background: var(--g); color: #07070b; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .65 } }
.lock { position: absolute; top: 38%; left: 50%; translate: -50% -50%; width: 34px; height: 34px; color: var(--faint); }
.lock svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.meta { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 4px; padding: 14px; }
.meta i { font-style: normal; font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--g); }
.chapter.locked .meta i { color: var(--faint); }
.meta b { font-family: var(--serif); font-weight: 900; font-size: clamp(18px, 3.2vh, 28px); letter-spacing: .06em; text-transform: uppercase; line-height: 1; }
.meta small { font-size: 12px; color: var(--soft); }
.chapter.locked .meta small { color: var(--faint); }

.me { display: flex; align-items: baseline; gap: 8px; padding: 6px 12px; border: 1px solid var(--line); background: none; text-transform: none; letter-spacing: 0; }
.me b { font-family: var(--serif); font-weight: 900; font-size: 14px; letter-spacing: .1em; text-transform: uppercase; color: var(--text); }
.me i { font-style: normal; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.me:hover:not(:disabled) { border-color: var(--line-strong); background: rgba(255, 255, 255, .04); }
.set { position: absolute; top: 8px; right: 8px; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 6px 5px; background: rgba(7, 7, 11, .7); --cw: #e8e4ff; }
.set .king { display: block; width: clamp(26px, 4.4vh, 40px); aspect-ratio: 1; }
.set em { font-style: normal; font-family: var(--serif); font-weight: 700; font-size: 8.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--soft); white-space: nowrap; }
.set.evolves { box-shadow: 0 0 0 1px #e8e4ff, 0 0 18px -4px #e8e4ff; }
.set.evolves em { color: #fff; }
.chapter.locked .set .king { filter: brightness(.3) grayscale(1); }
.foot { display: flex; align-items: center; gap: 12px; min-height: 40px; }
.spacer { flex: 1; }
.small { padding: 6px 12px; font-size: 10.5px; }
.confirm { display: inline-flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--soft); }
.ending { display: inline-flex; align-items: center; gap: 16px; border: 0; padding: 8px 4px; font-weight: 900; font-size: 15px; letter-spacing: .3em; }
.ending:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 18px #b06bff; }
.edge { display: block; width: 40px; height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(0 50%, 100% 0, 100% 100%); }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(100% 50%, 0 0, 0 100%); }

@media (max-width: 760px) {
  .path { grid-template-columns: 1fr; grid-auto-rows: 110px; overflow-y: auto; }
  .chapter::after { display: none; }
  .chapter img { object-position: 50% 18%; }
  .progress { margin-left: 0; width: 100%; }
}
</style>

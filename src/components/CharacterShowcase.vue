<script setup>
/* The cast: every rival in full, with who they are, how they play, their ultimate, their piece set,
   their story chapter and your record against them. The roster runs along the bottom. */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ROSTER, CHARS, LEVELS } from '../data/characters'
import { CHAPTERS } from '../data/story'
import { SET_NAMES, MOVESETS } from '../data/sets'
import { useStats } from '../composables/useStats'
import * as sound from '../lib/sound'
import PieceArt from './PieceArt.vue'
import { setOf, stageOf } from '../composables/useProgress'

const props = defineProps({ initial: { type: String, default: null } })
const emit = defineEmits(['back', 'fight', 'select'])
const { byCharacter } = useStats()
const ids = Object.keys(CHARS) // locked characters (coming soon) are shown too, with a padlock
const sel = ref(CHARS[props.initial] ? props.initial : ids[0])
const c = computed(() => CHARS[sel.value])
// the Alter: this character's negative self, met in a mirror match
const alter = ref(false)
const name = computed(() => (alter.value ? 'Alter ' + c.value.name : c.value.name))
const quote = computed(() => (alter.value ? c.value.say.mirror?.start ?? c.value.say.start : c.value.say.start))
const idx = computed(() => ids.indexOf(sel.value))
const chapter = computed(() => CHAPTERS.findIndex(ch => ch.id === sel.value))
const epithet = computed(() => CHAPTERS[chapter.value]?.title ?? '')
const pips = computed(() => Math.max(0, LEVELS.findIndex(l => l.name === c.value.level)))
const rec = computed(() => byCharacter.value[sel.value])
const meter = r => (r == null || r === 1 ? 'Normal meter' : r < 1 ? 'Slow meter' : 'Fast meter')

function choose(id) { sel.value = id; emit('select', id) }
function step(d) { choose(ids[(idx.value + d + ids.length) % ids.length]) }
function hear() { sound.voice(c.value.id, alter.value ? null : 'start', quote.value) }

const key = e => {
  if (e.key === 'Escape') emit('back')
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1)
  else if (e.key === 'Enter' && !e.target.closest?.('button')) emit('fight', sel.value)
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section class="cast" :class="{ alter }" :style="{ '--g': c.glow }">
    <i class="aura" />
    <div class="top">
      <button class="back" @click="emit('back')">← Back</button>
      <div><p class="eyebrow">Characters</p><h2>The Cast</h2></div>
      <div class="altsw" role="tablist" aria-label="Version">
        <button role="tab" :aria-selected="!alter" :class="{ on: !alter }" @click="alter = false">Normal</button>
        <button role="tab" :aria-selected="alter" :class="{ on: alter }" @click="alter = true">Alter</button>
      </div>
      <span class="count">{{ String(idx + 1).padStart(2, '0') }} <i>/ {{ String(ids.length).padStart(2, '0') }}</i></span>
    </div>

    <!-- the character -->
    <div class="hero">
      <Transition name="word" mode="out-in"><span :key="c.id + 'w' + alter" class="bigword" aria-hidden="true">{{ name }}</span></Transition>
      <Transition name="art" mode="out-in">
        <img :key="c.id + alter" :src="c.fullPending ? c.img : c.full ?? c.img" :alt="name" class="keyart" draggable="false">
      </Transition>
      <button class="nav prev" aria-label="Previous character" @click="step(-1)">‹</button>
      <button class="nav next" aria-label="Next character" @click="step(1)">›</button>
    </div>

    <!-- who they are -->
    <Transition name="info" mode="out-in">
      <div :key="c.id + alter" class="info">
        <div class="tags">
          <span v-if="chapter >= 0" class="tag">Chapter {{ chapter + 1 }}</span>
          <span v-if="c.villain" class="tag villain">Antagonist</span>
          <span v-if="c.locked" class="tag locked">Locked · Coming soon</span>
          <span v-if="alter" class="tag alt">Alter · mirror match</span>
        </div>
        <p class="epithet">{{ epithet }}</p>
        <h3>{{ name }}</h3>
        <div class="level"><small>{{ c.level }}</small><span class="pips"><i v-for="n in 5" :key="n" :class="{ on: n <= pips }" /></span></div>
        <p class="desc">{{ c.desc }}</p>
        <button class="quote" title="Hear them" @click="hear">“{{ quote }}”<i>▶</i></button>
        <p v-if="alter && c.say.mirror" class="text mirrorlines"><b>Wins:</b> “{{ c.say.mirror.win }}”<br><b>Loses:</b> “{{ c.say.mirror.lose }}”</p>

        <div class="block">
          <span class="label">Ultimate</span>
          <p class="ult"><b>{{ c.ult.name }}</b><em>{{ meter(c.ult.charge) }}</em></p>
          <p class="text">{{ c.ult.text }}</p>
        </div>

        <div class="block">
          <span class="label">Piece set · {{ stageOf(c)?.name ?? SET_NAMES[c.id] }}</span>
          <div class="set"><span v-for="t in ['k', 'q', 'r', 'b', 'n', 'p']" :key="t" class="pc"><PieceArt :type="t" color="b" :set="setOf(c)" /></span></div>
          <p class="text">{{ MOVESETS[c.id]?.move }}</p>
        </div>

        <div class="foot">
          <span class="rec">
            <template v-if="rec?.played">Your record · <b>{{ rec.win }}W</b> {{ rec.loss }}L {{ rec.draw }}D</template>
            <template v-else>Not played yet</template>
          </span>
          <span v-if="c.locked" class="lockedmsg">Locked</span>
          <button v-else class="fight" @click="emit('fight', c.id)"><b class="edge l" /><span>Fight</span><b class="edge r" /></button>
        </div>
      </div>
    </Transition>

    <!-- roster -->
    <div class="roster">
      <button v-for="id in ids" :key="id" class="face" :class="{ on: sel === id, villain: CHARS[id].villain, locked: CHARS[id].locked }" :style="{ '--fg': CHARS[id].glow }" :title="CHARS[id].name" @click="choose(id)">
        <img :src="CHARS[id].img" alt="" draggable="false">
      </button>
    </div>
  </section>
</template>

<style scoped>
.cast { position: relative; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(340px, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px 28px; min-height: 0; isolation: isolate; overflow: hidden; }
.aura { position: absolute; inset: -20%; z-index: -1; background: radial-gradient(ellipse 40% 55% at 30% 55%, color-mix(in srgb, var(--g) 22%, transparent), transparent 70%); transition: background .6s; }
.top { grid-column: 1 / -1; display: flex; align-items: center; gap: 20px; }
.back { background: none; border: 0; padding: 4px 0; color: var(--muted); font-size: 12px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
.top h2 { font-size: clamp(20px, 3.4vh, 30px); letter-spacing: .06em; }
/* Normal / Alter switch: the Alter (who you meet in a mirror match) is shown as a photographic negative */
.altsw { display: inline-flex; border: 1px solid var(--line); }
.altsw button { border: 0; padding: 5px 12px; font-size: 10.5px; letter-spacing: .2em; color: var(--muted); background: none; }
.altsw button.on { background: #f4f2fb; color: #07070b; }
.altsw button:not(.on):hover:not(:disabled) { background: rgba(255, 255, 255, .06); color: #fff; }
.cast.alter .keyart { scale: -1 1; } /* the Alter: a mirror image */
.cast.alter .keyart, .cast.alter .set .pc { filter: grayscale(1) invert(1) contrast(1.1); }
.tag.alt { background: #f4f2fb; color: #07070b; }
.mirrorlines b { font-family: var(--serif); letter-spacing: .1em; color: var(--g); }
.altsw { margin-left: auto; }
.tag.locked { background: rgba(244, 242, 251, .1); color: var(--soft); }
.lockedmsg { font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(16px, 2.6vh, 22px); letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
.face.locked img { filter: grayscale(1) brightness(.4); }
.face.locked::after { content: '🔒'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 14px; opacity: .8; }
.count { margin-left: 16px; font-family: var(--serif); font-weight: 700; font-size: 18px; letter-spacing: .12em; color: var(--g); }
.count i { font-style: normal; font-size: 12px; color: var(--muted); }

/* the character */
.hero { position: relative; min-height: 0; }
.bigword {
  position: absolute; left: -2%; top: 50%; translate: 0 -50%; white-space: nowrap; pointer-events: none;
  font-family: 'Cinzel', serif; font-weight: 900; font-size: min(32vh, 15vw); line-height: .8; color: transparent; -webkit-text-stroke: 1.5px color-mix(in srgb, var(--g) 40%, transparent);
}
.keyart {
  position: absolute; left: 50%; bottom: 0; translate: -50% 0; height: 104%; max-width: 100%; object-fit: contain; object-position: 50% 100%;
  -webkit-mask-image: radial-gradient(ellipse 46% 56% at 50% 42%, #000 28%, rgba(0,0,0,.6) 52%, transparent 78%); mask-image: radial-gradient(ellipse 46% 56% at 50% 42%, #000 28%, rgba(0,0,0,.6) 52%, transparent 78%);
  filter: drop-shadow(0 0 40px color-mix(in srgb, var(--g) 35%, transparent));
}
.nav { position: absolute; top: 50%; translate: 0 -50%; z-index: 2; width: 44px; height: 64px; padding: 0; border: 1px solid var(--line); background: rgba(7, 7, 11, .6); font-family: var(--serif); font-size: 28px; color: var(--text); }
.nav:hover:not(:disabled) { background: color-mix(in srgb, var(--g) 25%, rgba(7, 7, 11, .6)); color: #fff; }
.prev { left: 0; } .next { right: 0; }

/* the info column */
.info { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow-y: auto; padding-right: 4px; }
.tags { display: flex; gap: 8px; }
.tag { padding: 3px 9px; font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; border: 1px solid color-mix(in srgb, var(--g) 60%, transparent); color: var(--g); }
.tag.villain { background: #d1002c; border-color: #d1002c; color: #fff; }
.epithet { font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .3em; text-transform: uppercase; color: var(--soft); }
.info h3 { font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(44px, 9vh, 88px); line-height: .95; letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 0 40px color-mix(in srgb, var(--g) 45%, transparent); }
.level { display: flex; align-items: center; gap: 12px; }
.level small { font-size: 10.5px; letter-spacing: .26em; text-transform: uppercase; color: #8a8a98; }
.pips { display: inline-flex; gap: 4px; }
.pips i { width: 14px; height: 4px; transform: skewX(-20deg); background: rgba(244, 242, 251, .14); }
.pips i.on { background: var(--g); box-shadow: 0 0 8px var(--g); }
.desc { font-size: 14px; line-height: 1.5; color: var(--soft); max-width: 46ch; }
.quote {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border: 0; border-left: 2px solid var(--g); background: rgba(255, 255, 255, .03);
  font-family: var(--serif); font-weight: 700; font-style: italic; font-size: 13px; letter-spacing: .02em; text-transform: none; text-align: left; color: var(--text);
}
.quote i { font-style: normal; font-size: 10px; color: var(--g); }
.quote:hover:not(:disabled) { background: color-mix(in srgb, var(--g) 12%, transparent); color: #fff; }
.block { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--line); }
.label { font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: .24em; text-transform: uppercase; color: var(--muted); }
.ult { display: flex; align-items: baseline; gap: 10px; }
.ult b { font-family: var(--serif); font-weight: 900; font-size: 17px; letter-spacing: .14em; text-transform: uppercase; color: var(--g); }
.ult em { font-style: normal; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.text { font-size: 12.5px; line-height: 1.5; color: var(--soft); max-width: 52ch; }
.set { display: flex; gap: 4px; }
.pc { display: block; width: clamp(36px, 5.6vh, 54px); aspect-ratio: 1; }
.foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; }
.rec { font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .14em; color: var(--muted); }
.rec b { color: var(--g); }
.fight {
  margin-left: auto; display: inline-flex; align-items: center; gap: 16px; padding: 8px 4px 8px calc(4px + .45em); border: 0; border-radius: 0; background: none; color: #f4f2fb;
  font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(18px, 2.8vh, 24px); letter-spacing: .45em; text-transform: uppercase; transition: text-shadow .3s;
}
.fight:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 22px var(--g); }
.edge { display: block; width: clamp(28px, 3.6vw, 56px); height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(0 50%, 100% 0, 100% 100%); }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), #f4f2fb); clip-path: polygon(100% 50%, 0 0, 0 100%); }

/* roster */
.roster { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: center; }
.face { position: relative; width: clamp(44px, 7vh, 64px); aspect-ratio: 1; padding: 0; border: 0; border-radius: 0; overflow: hidden; background: #0d0c14; transition: transform .25s; }
.face img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; filter: grayscale(.7) brightness(.6); transition: filter .25s; }
.face:hover img, .face.on img { filter: none; }
.face.on { transform: translateY(-4px); box-shadow: 0 0 0 2px var(--fg), 0 10px 24px -8px var(--fg); }
.face::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--fg); }
.face.villain::before { content: ''; position: absolute; top: 3px; right: 3px; z-index: 1; width: 7px; height: 7px; background: #d1002c; box-shadow: 0 0 6px #d1002c; transform: rotate(45deg); }

/* transitions */
.art-enter-active, .art-leave-active, .info-enter-active, .info-leave-active, .word-enter-active, .word-leave-active { transition: opacity .25s, transform .35s cubic-bezier(.2, .8, .2, 1); }
.art-enter-from { opacity: 0; transform: translateX(-30px); }
.art-leave-to { opacity: 0; transform: translateX(20px); }
.info-enter-from { opacity: 0; transform: translateX(20px); }
.info-leave-to { opacity: 0; }
.word-enter-from, .word-leave-to { opacity: 0; }

@media (max-width: 860px) {
  /* phone: everything stacks and the page scrolls; the roster becomes a strip that scrolls sideways */
  .cast { display: flex; flex-direction: column; overflow-y: auto; gap: 12px; }
  .top { flex-wrap: wrap; gap: 10px; }
  .hero { flex: none; height: 42vh; }
  .info { overflow: visible; flex: none; }
  .bigword { display: none; }
  .roster { flex: none; flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; padding-bottom: 6px; }
  .roster .face { flex: none; }
}
@media (prefers-reduced-motion: reduce) { .cast * { animation: none !important; transition: none !important; } }
</style>

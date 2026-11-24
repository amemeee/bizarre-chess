<script setup>
/* The main menu, laid out like a game lobby: the cover art full-bleed behind everything, a big menu stack on the left
   (the chosen item lights up in its character's colour, with a slanted callout describing it), and a live panel on
   the right: your story progress, your next achievements, and the rivals still locked.
   ↑/↓ or 1-6 to choose, Enter to go, Esc back to the title. */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CHARS, ROSTER } from '../data/characters'
import { CHAPTERS } from '../data/story'
import { useStory } from '../composables/useStory'
import { useStats } from '../composables/useStats'
import { usePlayer } from '../composables/usePlayer'
import { ACHIEVEMENTS, useProgress } from '../composables/useProgress'

const emit = defineEmits(['story', 'battle', 'watch', 'characters', 'pieces', 'stats', 'back'])
const { cleared, finished } = useStory()
const { totals } = useStats()
const { ready: hasHero, hero } = usePlayer()
const { state: progress } = useProgress()

const ITEMS = [
  { key: 'story', title: 'Story', text: 'Climb the tournament and find out who is pulling the strings.', glow: CHARS.kyo.glow },
  { key: 'battle', title: 'Free Battle', text: 'Any rival, any difficulty, as anyone you like.', glow: CHARS.kaito.glow },
  { key: 'watch', title: 'Spectate', text: 'Pick two rivals and watch them fight it out.', glow: CHARS.yuki.glow },
  { key: 'characters', title: 'Characters', text: 'The whole cast: who they are and how they play.', glow: CHARS.ren.glow },
  { key: 'pieces', title: 'Collection', text: 'Every piece set, and how its pieces move.', glow: CHARS.sena.glow },
  { key: 'stats', title: 'Profile', text: 'Your character, record, achievements and titles.', glow: '#e8e4ff' },
]
const sel = ref(0)
// the wallpaper: one of these, picked at random each time the menu opens
const COVERS = ['/assets/ui/cover.jpg', '/assets/ui/cover-kyo.jpg']
const cover = COVERS[Math.floor(Math.random() * COVERS.length)]
const cur = computed(() => ITEMS[sel.value])
const go = i => emit(ITEMS[i].key)

// ---- the side panel's live data ----
const storyPct = computed(() => Math.round((cleared.value / CHAPTERS.length) * 100))
const storyNext = computed(() => (finished.value ? 'Tournament cleared' : `Next: Chapter ${cleared.value + 1} · ${CHARS[CHAPTERS[Math.min(cleared.value, CHAPTERS.length - 1)].id].name}`))
const earned = computed(() => ACHIEVEMENTS.filter(a => progress.value.ach[a.id]).length)
const nextAch = computed(() => ACHIEVEMENTS.filter(a => !progress.value.ach[a.id]).slice(0, 2))
const title = computed(() => {
  const got = ACHIEVEMENTS.filter(a => progress.value.ach[a.id]).sort((a, b) => progress.value.ach[b.id] - progress.value.ach[a.id])
  return got[0]?.title ?? null
})
const locked = Object.values(CHARS).filter(c => c.locked)

const key = e => {
  if (e.key === 'Escape') return emit('back')
  if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = (sel.value + 1) % ITEMS.length }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = (sel.value + ITEMS.length - 1) % ITEMS.length }
  else if (e.key === 'Enter' && !e.target.closest?.('button')) go(sel.value)
  const n = Number(e.key)
  if (n >= 1 && n <= ITEMS.length) go(n - 1)
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <section class="lobby" :style="{ '--g': cur.glow }">
    <!-- the scene -->
    <img class="scene" :src="cover" alt="" draggable="false">
    <i class="tint" />

    <!-- top bar -->
    <header class="top">
      <button class="back" @click="emit('back')" title="Back to the title">←</button>
      <div class="brand">
        <b>Bizarre Chess</b>
        <small>The Tournament /// {{ ROSTER.length }} rivals</small>
      </div>
      <div class="me">
        <img v-if="hasHero" :src="hero.img" alt="">
        <span>
          <b>{{ hasHero ? hero.name : 'Player' }}</b>
          <small>{{ title ? `“${title}”` : 'No title yet' }}</small>
        </span>
        <span class="stat" title="Achievements">★ {{ earned }}/{{ ACHIEVEMENTS.length }}</span>
        <span v-if="totals?.played" class="stat" title="Your record">{{ totals.win }}W · {{ totals.loss }}L</span>
      </div>
    </header>

    <!-- the menu -->
    <nav class="items" aria-label="Main menu">
      <button
        v-for="(m, i) in ITEMS" :key="m.key" class="item" :class="{ on: sel === i }" :style="{ '--ig': m.glow, '--n': i }"
        @pointerenter="sel = i" @focus="sel = i" @click="go(i)"
      >
        <i class="pip" />
        <b>{{ m.title }}</b>
        <span v-if="sel === i" class="callout">{{ m.text }}</span>
      </button>
    </nav>

    <!-- the side panel -->
    <aside class="panel">
      <div class="block">
        <div class="bhead"><b>Story</b><small>{{ storyPct }}%</small></div>
        <span class="bar"><i :style="{ width: storyPct + '%' }" /></span>
        <p class="note">{{ storyNext }}</p>
        <button class="row cta" @click="emit('story')"><span>{{ finished ? 'Replay the story' : cleared ? 'Continue' : 'Begin' }}</span><i>→</i></button>
      </div>

      <div class="block">
        <div class="bhead"><b>Achievements</b><small>{{ earned }} / {{ ACHIEVEMENTS.length }}</small></div>
        <div v-for="a in nextAch" :key="a.id" class="mission">
          <span>☆ {{ a.name }}</span>
          <small>{{ a.text }}</small>
          <em>Title: “{{ a.title }}”</em>
        </div>
        <p v-if="!nextAch.length" class="note">All achievements earned. Impressive.</p>
      </div>

      <div v-if="locked.length" class="block">
        <div class="bhead"><b>Rivals coming soon</b><small>{{ locked.length }}</small></div>
        <div class="locked">
          <span v-for="c in locked" :key="c.id" class="face" :style="{ '--lg': c.glow }" :title="c.name">
            <img :src="c.img" alt=""><i>🔒</i>
          </span>
        </div>
        <button class="row" @click="emit('characters')"><span>View them</span><i>→</i></button>
      </div>
    </aside>

    <small class="hint">↑ ↓ choose · Enter go · 1–6 jump · Esc title</small>
  </section>
</template>

<style scoped>
/* the screen runs up behind the header bar, like the title screen */
.lobby { position: relative; overflow: hidden; isolation: isolate; min-height: 0; margin: -48px -16px -16px; padding: 18px 28px; display: grid; grid-template-columns: 1fr minmax(280px, 340px); grid-template-rows: auto 1fr auto; gap: 16px 28px; }
.scene { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; object-position: 60% 30%; filter: saturate(.85) brightness(.55); animation: scenein 1.2s ease-out both; }
@keyframes scenein { from { opacity: 0; transform: scale(1.04) } }
/* darker on the left (the menu) and right (the panel), tinted in the chosen item's colour */
.tint { position: absolute; inset: 0; z-index: -1; background:
  linear-gradient(90deg, rgba(7, 7, 11, .92) 0%, rgba(7, 7, 11, .55) 32%, transparent 55%, rgba(7, 7, 11, .4) 75%, rgba(7, 7, 11, .85)),
  radial-gradient(ellipse 60% 70% at 20% 55%, color-mix(in srgb, var(--g) 22%, transparent), transparent 70%);
  transition: background .5s; }

/* ---- top bar ---- */
.top { grid-column: 1 / -1; display: flex; align-items: center; gap: 18px; padding-top: 30px; }
.back { width: 38px; height: 38px; padding: 0; border: 1px solid var(--line); background: rgba(7, 7, 11, .5); color: var(--soft); font-size: 16px; }
.back:hover:not(:disabled) { color: #fff; border-color: var(--line-strong); background: rgba(255, 255, 255, .06); }
.brand { display: flex; flex-direction: column; gap: 2px; }
.brand b { font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(20px, 3.2vh, 28px); letter-spacing: .14em; text-transform: uppercase; color: #fff; }
.brand small { font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .3em; text-transform: uppercase; color: var(--g); transition: color .4s; }
.me { margin-left: auto; margin-right: 150px; display: flex; align-items: center; gap: 12px; }
.me img { width: 34px; height: 34px; object-fit: cover; object-position: 50% 25%; box-shadow: 0 0 0 1px var(--line-strong); }
.me > span:first-of-type { display: flex; flex-direction: column; gap: 1px; }
.me b { font-family: var(--serif); font-weight: 900; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; }
.me small { font-size: 11px; color: #ffcf4a; font-style: italic; }
.stat { padding: 4px 10px; border: 1px solid var(--line); background: rgba(7, 7, 11, .5); font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .1em; color: var(--soft); }

/* ---- the menu stack ---- */
.items { grid-column: 1; align-self: center; display: flex; flex-direction: column; gap: clamp(2px, .8vh, 10px); }
.item {
  position: relative; display: flex; align-items: center; gap: 18px; padding: 0; border: 0; background: none; text-align: left;
  text-transform: none; letter-spacing: 0; font-family: inherit; color: #d8d6e4; width: fit-content;
  animation: itemin .5s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--n) * .06s);
}
@keyframes itemin { from { opacity: 0; transform: translateX(-30px) } }
.item:hover:not(:disabled) { background: none; }
/* a small slanted pip, like a diamond bullet */
.pip { width: 9px; height: 9px; transform: rotate(45deg); background: rgba(244, 242, 251, .35); transition: background .25s, box-shadow .25s, transform .25s; }
.item b { font-family: 'Cinzel', serif; font-weight: 900; font-size: clamp(24px, 4.6vh, 40px); letter-spacing: .06em; text-transform: uppercase; line-height: 1.05; transition: font-size .3s cubic-bezier(.2, .8, .2, 1), color .25s, text-shadow .25s; }
.item.on .pip { background: var(--ig); box-shadow: 0 0 12px var(--ig); transform: rotate(45deg) scale(1.3); }
.item.on b { font-size: clamp(44px, 9vh, 84px); color: var(--ig); text-shadow: 0 0 30px color-mix(in srgb, var(--ig) 45%, transparent); }
.item:not(.on):hover b { color: #fff; }
/* the callout: a slanted box beside the chosen item */
.callout {
  margin-left: 10px; padding: 12px 18px 12px 16px; max-width: 30ch; font-size: 13px; line-height: 1.45; color: var(--soft);
  background: rgba(7, 7, 11, .72); border-left: 2px solid var(--ig); clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px);
  backdrop-filter: blur(6px); animation: callout .35s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes callout { from { opacity: 0; transform: translateX(-12px) } }

/* ---- the side panel ---- */
.panel { grid-column: 2; align-self: center; display: flex; flex-direction: column; gap: 10px; animation: panelin .6s .2s cubic-bezier(.2, .8, .2, 1) both; }
@keyframes panelin { from { opacity: 0; transform: translateX(30px) } }
.block { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: rgba(9, 8, 14, .78); border: 1px solid var(--line); backdrop-filter: blur(8px); clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%); }
.bhead { display: flex; align-items: baseline; justify-content: space-between; }
.bhead b { font-family: var(--serif); font-weight: 900; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #fff; }
.bhead small { font-family: var(--serif); font-weight: 700; font-size: 11px; color: var(--g); transition: color .4s; }
.bar { height: 4px; background: rgba(255, 255, 255, .08); }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, color-mix(in srgb, var(--g) 50%, transparent), var(--g)); box-shadow: 0 0 10px var(--g); transition: width .6s, background .4s; }
.note { font-size: 12px; color: var(--soft); }
.row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--line); background: rgba(255, 255, 255, .03); font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--soft); }
.row i { font-style: normal; color: var(--g); transition: transform .25s; }
.row:hover:not(:disabled) { color: #fff; border-color: var(--line-strong); background: rgba(255, 255, 255, .06); }
.row:hover i { transform: translateX(4px); }
.row.cta { border-color: color-mix(in srgb, var(--g) 50%, transparent); color: #fff; }
.mission { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: rgba(255, 255, 255, .03); border-left: 2px solid rgba(255, 207, 74, .5); }
.mission span { font-family: var(--serif); font-weight: 900; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #fff; }
.mission small { font-size: 11.5px; color: var(--soft); }
.mission em { font-size: 10.5px; color: #ffcf4a; }
.locked { display: flex; gap: 6px; }
.face { position: relative; flex: 1; aspect-ratio: 1; overflow: hidden; box-shadow: inset 0 -3px 0 var(--lg); }
.face img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; filter: grayscale(1) brightness(.45); }
.face i { position: absolute; inset: 0; display: grid; place-items: center; font-style: normal; font-size: 14px; }

.hint { grid-column: 1 / -1; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #6c6c82; }

/* ---- phone ---- */
@media (max-width: 860px) {
  .lobby { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto; overflow-y: auto; padding: 14px 16px; }
  .me { margin-right: 0; } .me .stat:last-child, .me small { display: none; }
  .scene { position: fixed; }
  .items { align-self: start; }
  .item b { font-size: 22px; }
  .item.on b { font-size: 30px; }
  .brand b { font-size: 18px; }
  .brand small { letter-spacing: .16em; }
  .top { padding-top: 34px; }
  .callout { display: none; }
  .panel { grid-column: 1; }
  .hint { display: none; }
}
@media (prefers-reduced-motion: reduce) { .lobby * { animation: none !important; transition: none !important; } }
</style>

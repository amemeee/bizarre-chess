<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import HomeView from './components/HomeView.vue'
import ModeSelect from './components/ModeSelect.vue'
import CharacterSelect from './components/CharacterSelect.vue'
import SpectateSelect from './components/SpectateSelect.vue'
import StoryView from './components/StoryView.vue'
import StoryScene from './components/StoryScene.vue'
import GameView from './components/GameView.vue'
import StatsView from './components/StatsView.vue'
import PieceShowcase from './components/PieceShowcase.vue'
import CharacterShowcase from './components/CharacterShowcase.vue'
import AuthModal from './components/AuthModal.vue'
import Toasts from './components/Toasts.vue'
import { unlock } from './composables/useProgress'

import { useAuth } from './composables/useAuth'
import { useGame } from './composables/useGame'
import { useStats } from './composables/useStats'
import { useStory } from './composables/useStory'
import { CHAPTERS, ENDING } from './data/story'
import { CHARS } from './data/characters'
import { music } from './lib/sound'

const showAuth = ref(false)
const pickFirst = ref('ren') // character pre-selected on the select screen
const castFirst = ref(null) // character shown first on the Characters page
const selectMode = ref('duel') // character select opens in Duel or Spectate

/* ---- pages and their addresses ----
   Every screen has its own address (#/play, #/battle, #/story, #/collection …), so refreshing the page keeps you
   where you were, and the browser's Back / Forward buttons move between screens.
   A game in progress can't survive a refresh, so its address brings you back to where you picked it:
   #/battle/ren → the select screen with Ren chosen, #/story/3 → the story map. */
function routeOf(path) {
  const [, a, b] = path.split('/')
  if (a === 'play') return 'mode'
  if (a === 'battle') { selectMode.value = 'duel'; if (CHARS[b]) pickFirst.value = b; return 'select' }
  if (a === 'spectate') { selectMode.value = 'watch'; return 'select' }
  if (a === 'story') return 'story'
  if (a === 'collection') return 'pieces'
  if (a === 'characters') { castFirst.value = CHARS[b] ? b : null; return 'characters' }
  if (a === 'stats') return 'stats'
  return 'home'
}
const currentPath = () => location.hash.replace(/^#/, '') || '/'

// 'home' | 'mode' | 'select' | 'story' | 'scene' | 'game' | 'stats' | 'pieces' | 'characters'
const view = ref(routeOf(currentPath()))
// the story chapter being played: { chapter, phase }, phase 'intro' → 'battle' → 'win' / 'lose', or 'ending'
const run = ref(null)
const { user } = useAuth()
const game = useGame()
const stats = useStats()
const story = useStory()

// Load saved data whenever the player signs in; drop it when they sign out.
watch(user, u => { u ? stats.load() : stats.clear() }, { immediate: true })
watch(view, v => {
  document.body.classList.toggle('ingame', v === 'game' || v === 'scene')
  document.body.classList.toggle('home', v === 'home')
}, { immediate: true })
watch(game.quake, q => document.body.classList.toggle('quake', q))
// music: the title theme on menus, the opponent's theme during a game or its story scenes (silent if a track isn't there)
watch([view, () => game.char.value?.id, () => run.value?.chapter], ([v, id, ch]) => {
  if (v === 'game' && id) music.play(id)
  else if (v === 'scene' && ch != null) music.play(CHAPTERS[ch].id)
  else music.play('home')
}, { immediate: true })

/* ---- free battle & spectate ---- */
// `level`: the difficulty picked in Free Battle (null = the rival's own); kept for Rematch
const lastLevel = ref(null)
// `as`: who you play as in Free Battle (a hero 'm' / 'f', or any rival's id); kept for Rematch
const lastAs = ref(null)
function play(id, level = null, as = null) { run.value = null; lastLevel.value = level; lastAs.value = as; game.start(id, level, { as }); view.value = 'game' }
// computer vs computer; the last matchup is kept for Rematch
const lastPair = ref(null)
function spectate(white, black) { run.value = null; lastPair.value = [white, black]; game.startWatch(white, black); view.value = 'game' }
function rematch() { game.mode.value === 'watch' && lastPair.value ? spectate(...lastPair.value) : play(game.char.value.id, lastLevel.value, lastAs.value) }
function openSelect(mode) { selectMode.value = mode; view.value = 'select' }

/* ---- story ---- (see `run` above) */
function startChapter(i) { run.value = { chapter: i, phase: 'intro' }; view.value = 'scene' }
const sceneLines = () => {
  const r = run.value
  if (r.phase === 'ending') return ENDING
  return CHAPTERS[r.chapter][r.phase]
}
function sceneDone() {
  const r = run.value
  if (r.phase === 'intro') { run.value = { ...r, phase: 'battle' }; game.start(CHAPTERS[r.chapter].id, null, { set: CHAPTERS[r.chapter].set }); view.value = 'game'; return }
  if (r.phase === 'win' && story.complete(r.chapter)) { unlock('champion'); run.value = { ...r, phase: 'ending' }; return } // just finished the tournament
  if (r.phase === 'ending') story.markEnding()
  run.value = null
  view.value = 'story'
}
/** The story duel ended: go to the win or lose scene. */
function storyResult(result) {
  run.value = { ...run.value, phase: result === 'win' ? 'win' : 'lose' }
  view.value = 'scene'
}
function retryChapter() { startChapter(run.value.chapter) }
function watchEnding() { run.value = { chapter: CHAPTERS.length - 1, phase: 'ending' }; view.value = 'scene' }

/* ---- keeping the address in step with the screen ---- */
function pathOf(v) {
  if (v === 'mode') return '/play'
  if (v === 'select') return selectMode.value === 'watch' ? '/spectate' : '/battle'
  if (v === 'story') return '/story'
  if (v === 'scene' || (v === 'game' && run.value)) return run.value?.phase === 'ending' ? '/story/ending' : `/story/${(run.value?.chapter ?? 0) + 1}`
  if (v === 'game') return game.mode.value === 'watch' ? '/spectate/match' : `/battle/${game.char.value?.id ?? ''}`
  if (v === 'pieces') return '/collection'
  if (v === 'characters') return castFirst.value ? `/characters/${castFirst.value}` : '/characters'
  if (v === 'stats') return '/stats'
  return '/'
}
watch([view, run, () => game.char.value?.id, castFirst], () => {
  const next = pathOf(view.value)
  if (next === currentPath()) return
  // moving between a story scene and its duel just updates the address; anything else is a new step in the history
  const sameStep = next.startsWith('/story/') && currentPath().startsWith('/story/')
  history[sameStep ? 'replaceState' : 'pushState'](null, '', '#' + next)
}, { immediate: true })
// Back / Forward (or typing an address): show that screen, leaving any game in progress
function onPop() {
  const next = routeOf(currentPath())
  if (view.value === 'game' || view.value === 'scene') { game.leave(); run.value = null }
  view.value = next
}
onMounted(() => window.addEventListener('popstate', onPop))
onUnmounted(() => window.removeEventListener('popstate', onPop))

/* ---- leaving a game ---- */
function menu() { game.leave(); if (run.value) { run.value = null; view.value = 'story' } else view.value = 'select' }
function home() { game.leave(); run.value = null; view.value = 'home' }
onMounted(() => document.documentElement.style.setProperty('--c', '#8b6bff'))
</script>

<template>
  <AppHeader @nav="v => (v === 'home' ? home() : (view = v))" @login="showAuth = true" />
  <main>
    <HomeView v-if="view === 'home'" @play="id => { if (id) { pickFirst = id; openSelect('duel') } else view = 'mode' }" />
    <ModeSelect
      v-else-if="view === 'mode'"
      @story="view = 'story'" @battle="openSelect('duel')" @watch="openSelect('watch')" @pieces="view = 'pieces'" @characters="view = 'characters'" @stats="view = 'stats'" @back="view = 'home'"
    />
    <SpectateSelect
      v-else-if="view === 'select' && selectMode === 'watch'" :pair="lastPair"
      @watch="spectate" @duel="openSelect('duel')" @back="view = 'mode'"
    />
    <CharacterSelect
      v-else-if="view === 'select'" :initial="pickFirst"
      @pick="(id, level, as) => { pickFirst = id; play(id, level, as) }" @spectate="openSelect('watch')" @back="view = 'mode'"
    />
    <StoryView v-else-if="view === 'story'" @play="startChapter" @ending="watchEnding" @back="view = 'mode'" />
    <StoryScene
      v-else-if="view === 'scene'" :key="`${run.chapter}-${run.phase}`" :lines="sceneLines()"
      :chapter="run.phase === 'intro' ? `Chapter ${run.chapter + 1}` : run.phase === 'ending' ? 'Ending' : ''"
      :title="run.phase === 'intro' ? CHAPTERS[run.chapter].title : run.phase === 'ending' ? 'The Final Table' : ''"
      :action="run.phase === 'intro' ? 'Fight' : 'Continue'"
      @done="sceneDone"
    />
    <GameView
      v-else-if="view === 'game'" :story="!!run"
      @menu="menu" @rematch="rematch" @story-result="storyResult" @story-retry="retryChapter"
    />
    <PieceShowcase v-else-if="view === 'pieces'" @back="view = 'mode'" />
    <CharacterShowcase
      v-else-if="view === 'characters'" :initial="castFirst"
      @select="id => (castFirst = id)" @fight="id => { pickFirst = id; openSelect('duel') }" @back="view = 'mode'"
    />
    <StatsView v-else-if="view === 'stats'" @login="showAuth = true" @back="view = 'mode'" />
  </main>
  <AuthModal v-if="showAuth" @close="showAuth = false" />
  <Toasts />
</template>

<style>
main { flex: 1; min-height: 0; width: 100%; margin: 0 auto; padding: 0 16px 16px; display: flex; flex-direction: column; }
main > * { flex: 1; min-height: 0; }
</style>

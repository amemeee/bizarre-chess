<script setup>
import { ref, watch, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import HomeView from './components/HomeView.vue'
import ModeSelect from './components/ModeSelect.vue'
import CharacterSelect from './components/CharacterSelect.vue'
import StoryView from './components/StoryView.vue'
import StoryScene from './components/StoryScene.vue'
import GameView from './components/GameView.vue'
import StatsView from './components/StatsView.vue'
import AuthModal from './components/AuthModal.vue'
import { useAuth } from './composables/useAuth'
import { useGame } from './composables/useGame'
import { useStats } from './composables/useStats'
import { useStory } from './composables/useStory'
import { CHAPTERS, ENDING } from './data/story'
import { music } from './lib/sound'

// 'home' | 'mode' | 'select' | 'story' | 'scene' | 'game' | 'stats'
const view = ref('home')
const showAuth = ref(false)
const pickFirst = ref('ren') // character pre-selected on the select screen
const selectMode = ref('duel') // character select opens in Duel or Spectate
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
function play(id) { run.value = null; game.start(id); view.value = 'game' }
// computer vs computer; the last matchup is kept for Rematch
const lastPair = ref(null)
function spectate(white, black) { run.value = null; lastPair.value = [white, black]; game.startWatch(white, black); view.value = 'game' }
function rematch() { game.mode.value === 'watch' && lastPair.value ? spectate(...lastPair.value) : play(game.char.value.id) }
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
  if (r.phase === 'intro') { run.value = { ...r, phase: 'battle' }; game.start(CHAPTERS[r.chapter].id); view.value = 'game'; return }
  if (r.phase === 'win' && story.complete(r.chapter)) { run.value = { ...r, phase: 'ending' }; return } // just finished the tournament
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
      @story="view = 'story'" @battle="openSelect('duel')" @watch="openSelect('watch')" @back="view = 'home'"
    />
    <CharacterSelect
      v-else-if="view === 'select'" :initial="pickFirst" :initial-mode="selectMode"
      @pick="id => { pickFirst = id; play(id) }" @watch="spectate" @back="view = 'mode'"
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
    <StatsView v-else-if="view === 'stats'" @login="showAuth = true" @back="home" />
  </main>
  <AuthModal v-if="showAuth" @close="showAuth = false" />
</template>

<style>
main { flex: 1; min-height: 0; width: 100%; margin: 0 auto; padding: 0 16px 16px; display: flex; flex-direction: column; }
main > * { flex: 1; min-height: 0; }
</style>

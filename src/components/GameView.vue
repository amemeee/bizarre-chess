<script setup>
import { computed, watch } from 'vue'
import ChessBoard from './ChessBoard.vue'
import CharacterPanel from './CharacterPanel.vue'
import CutIn from './CutIn.vue'
import CapturedTray from './CapturedTray.vue'
import PlayerUlt from './PlayerUlt.vue'
import * as sound from '../lib/sound'
import { useGame } from '../composables/useGame'

defineProps({ story: { type: Boolean, default: false } }) // a story chapter's duel: the end screen leads on to its scene
defineEmits(['menu', 'rematch', 'story-result', 'story-retry'])
const g = useGame()

// sounds: an ultimate's opening sting (by who fired it), your meter filling up, and the end of the game
watch(() => g.cutin.value, on => { if (on) sound.ultimate(g.cutinChar.value?.id) })
watch(() => g.playerReady.value, (ready, was) => { if (ready && !was) sound.ready() })
watch(() => g.over.value, o => {
  if (!o) return
  if (o.result === 'draw') sound.draw()
  else if (o.result === 'win' || (watching.value && o.result)) sound.win()
  else sound.lose()
})
const watching = computed(() => g.mode.value === 'watch')
// a character with an exclusive piece set (Yuki's ice) uses it for their side; you always play the default set
// a character's landing trail (Yuki's frost), per side
const trails = computed(() => ({
  w: watching.value ? g.white.char.value?.trail ?? null : null,
  b: g.char.value?.trail ?? null,
}))
// how a character's pieces move (Noa's puppets), per side
const motions = computed(() => ({
  w: watching.value ? g.white.char.value?.motion ?? null : null,
  b: g.char.value?.motion ?? null,
}))
// captured pieces and material lead
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const worth = list => list.reduce((sum, t) => sum + (VALUE[t] ?? 0), 0)
const whiteLead = computed(() => worth(g.lost.value.b) - worth(g.lost.value.w))
const topLabel = computed(() => `${g.char.value.name} took`)
const bottomLabel = computed(() => (watching.value ? `${g.white.char.value.name} took` : 'You took'))
const pieceSets = computed(() => ({
  w: watching.value ? g.white.char.value?.pieces ?? null : null,
  b: g.char.value?.pieces ?? null,
}))
</script>

<template>
  <div class="game" :class="{ watching }">
    <!-- spectate: White's character on the left -->
    <CharacterPanel
      v-if="watching" class="pw" side="White" :controls="false" :active="!g.over.value && g.turn.value === 'w'"
      :style="{ '--c': g.white.char.value.glow }"
      :char="g.white.char.value" :face="g.white.face.value" :bubble="g.white.bubble.value" :charge="g.white.charge.value"
      :status="g.statusOf('w')"
    />

    <div class="stage">
     <div class="boardcol">
      <!-- pieces taken by the top side (Black) -->
      <CapturedTray :pieces="g.lost.value.w" color="w" :set="pieceSets.w" :lead="-whiteLead" :label="topLabel" />
      <div class="boardwrap">
        <ChessBoard
          :squares="g.squares.value" :interactive="!watching" :sets="pieceSets" :trails="trails" :motions="motions" :last-move="g.lastMove.value" :ult-event="g.ultEvent.value"
          @select="g.select"
        />
        <Transition name="fade">
          <div v-if="g.over.value" class="over" :class="g.over.value.result">
            <span class="caption">{{ g.over.value.result === 'draw' ? 'Stalemate' : 'Checkmate' }}</span>
            <h1>{{ g.over.value.title }}</h1>
            <p>{{ g.over.value.msg }}</p>
            <div v-if="story" class="btns">
              <button class="blade" @click="$emit('story-result', g.over.value.result)"><b class="edge l" /><span>Continue</span><b class="edge r" /></button>
              <button v-if="g.over.value.result !== 'win'" class="ghost" @click="$emit('story-retry')">Try again</button>
            </div>
            <div v-else class="btns">
              <button class="blade" @click="$emit('rematch')"><b class="edge l" /><span>Rematch</span><b class="edge r" /></button>
              <button class="ghost" @click="$emit('menu')">{{ watching ? 'Change matchup' : 'Change opponent' }}</button>
            </div>
          </div>
        </Transition>
      </div>
      <!-- pieces taken by the bottom side (White: you, or White's character) -->
      <CapturedTray :pieces="g.lost.value.b" color="b" :set="pieceSets.b" :lead="whiteLead" :label="bottomLabel" />
     </div>

      <!-- spectate controls -->
      <div v-if="watching" class="controls">
        <span class="caption live"><i :class="{ off: g.paused.value || g.over.value }" />{{ g.over.value ? 'Finished' : g.paused.value ? 'Paused' : 'Live' }}</span>
        <button class="ghost" :disabled="!!g.over.value" @click="g.togglePause">{{ g.paused.value ? 'Resume' : 'Pause' }}</button>
        <button class="ghost" @click="g.cycleSpeed">Speed {{ g.speed.value }}×</button>
        <button class="ghost" @click="$emit('menu')">Exit</button>
      </div>
    </div>

    <div class="right">
      <!-- the opponent in a duel / Black's character in spectate -->
      <CharacterPanel
        :side="watching ? 'Black' : ''" :controls="!watching" :active="watching && !g.over.value && g.turn.value === 'b'"
        :char="g.char.value" :face="g.face.value" :bubble="g.bubble.value" :charge="g.charge.value"
        :status="watching ? g.statusOf('b') : g.status.value" :can-undo="g.canUndo.value" @undo="g.undo" @menu="$emit('menu')"
      />
      <!-- your ultimate (duels only) -->
      <PlayerUlt
        v-if="!watching" :charge="g.playerCharge.value" :ready="g.playerReady.value" :aim="g.aim.value"
        :comeback="g.comeback.value" :can-use="g.canUse" @use="k => { sound.ui(); g.playerUltimate(k) }" @cancel="g.cancelAim"
      />
    </div>
    <CutIn v-if="g.cutin.value" :char="g.cutinChar.value" :style="{ '--c': g.cutinChar.value.glow }" />
  </div>
</template>

<style scoped>
.game { display: grid; grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: minmax(0, 1fr); gap: 32px; padding: 0 8px 8px; }
.game.watching { grid-template-columns: 300px minmax(0, 1fr) 300px; gap: 24px; }
.right { align-self: center; min-height: 0; max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
/* the character panel fills its column (it used to centre itself and shrink to its portrait) */
.right > :deep(aside), .game > :deep(aside) { align-self: stretch; max-height: none; overflow: visible; }
/* duel: a wider, shorter portrait and tighter spacing so the panel and your ultimate fit on a laptop screen */
.game:not(.watching) .right :deep(.portrait) { aspect-ratio: 16 / 9; }
.game:not(.watching) .right :deep(aside) { gap: 12px; }
.game.watching > :deep(aside) { align-self: center; }
.stage { min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.boardcol { display: flex; flex-direction: column; height: 100%; min-height: 0; max-width: 100%; }
.watching .boardcol { height: calc(100% - 52px); }
/* the board takes what's left after the two captured-piece trays */
.boardwrap { position: relative; height: calc(100% - 60px); max-width: 100%; aspect-ratio: 1; padding: 22px; }

.controls { flex: none; height: 44px; display: flex; align-items: center; gap: 10px; }
.controls button { padding: 8px 14px; font-size: 11px; min-width: 96px; }
.live { display: inline-flex; align-items: center; gap: 8px; margin-right: 8px; color: var(--soft); }
.live i { width: 7px; height: 7px; border-radius: 50%; background: var(--loss); box-shadow: 0 0 10px var(--loss); animation: blink 1s infinite; }
.live i.off { background: var(--muted); box-shadow: none; animation: none; }
@keyframes blink { 50% { opacity: .25 } }

.over {
  position: absolute; inset: 22px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 24px;
  background: radial-gradient(circle, rgba(7, 7, 11, .82), rgba(7, 7, 11, .94)); backdrop-filter: blur(6px);
}
.over h1 { font-size: clamp(40px, 8vh, 80px); letter-spacing: .08em; text-shadow: 0 0 40px color-mix(in srgb, var(--c) 60%, transparent); }
.over.win h1, .over.black h1 { color: var(--text); }
.over.white h1 { color: var(--text); text-shadow: 0 0 40px color-mix(in srgb, var(--cw, #fff) 60%, transparent); }
.over.loss h1 { color: var(--loss); text-shadow: 0 0 40px rgba(255, 95, 138, .5); }
.over p { color: var(--soft); max-width: 34ch; font-size: 14px; line-height: 1.5; }
.btns { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 14px; }

/* same blade button as Play / Fight */
.blade { display: inline-flex; align-items: center; gap: 16px; border: 0; padding: 8px 4px 8px calc(4px + .4em); font-weight: 900; font-size: 20px; letter-spacing: .4em; }
.blade:hover:not(:disabled) { background: none; color: #fff; text-shadow: 0 0 22px var(--c); }
.edge { display: block; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(0 50%, 100% 0, 100% 100%); transition: width .35s; }
.edge.r { background: linear-gradient(270deg, rgba(244, 242, 251, .1), var(--text)); clip-path: polygon(100% 50%, 0 0, 0 100%); }
.blade:hover .edge { width: 80px; }

.fade-enter-active, .fade-leave-active { transition: opacity .5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 1100px) {
  .game.watching { grid-template-columns: 240px minmax(0, 1fr) 240px; gap: 16px; }
}
@media (max-width: 900px) {
  .game, .game.watching { grid-template-columns: 1fr; grid-template-rows: auto auto; overflow-y: auto; align-content: start; gap: 12px; }
  .game.watching { grid-template-columns: 1fr 1fr; }
  .game.watching .stage { grid-column: 1 / -1; grid-row: 1; }
  /* stacked: every section is as tall as its content (min-height: 0 let the board overflow onto the panel) */
  .stage, .right { display: block; min-height: auto; max-height: none; overflow: visible; }
  .right { display: flex; }
  /* a short banner-style portrait on phones */
  .game:not(.watching) .right :deep(.portrait) { aspect-ratio: 21 / 9; }
  .boardcol, .watching .boardcol { height: auto; width: min(100%, 60dvh); margin: 0 auto; }
  .boardwrap { height: auto; width: 100%; padding: 16px; }
  .controls { justify-content: center; flex-wrap: wrap; height: auto; padding: 4px 0; }
  .over { inset: 16px; }
}
</style>

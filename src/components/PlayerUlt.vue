<script setup>
/* Your ultimate: a meter that fills like the characters' (captures, checks, losses), and four abilities
   to choose from once it's full. Smite and Shield then ask you to pick a target on the board.
   Compact: the four abilities are small buttons; the one you point at (or a prompt) is described below. */
import { ref, computed } from 'vue'
import { PLAYER_ULTS, ultsFor } from '../composables/useGame'

const noFace = ref(false)

// `you`: who you play as ({ kind: 'hero' | 'rival', name, img, look, ult })
const props = defineProps({ charge: Number, ready: Boolean, aim: String, swapFrom: String, aimHint: String, comeback: Boolean, canUse: Function, you: Object })
defineEmits(['use', 'cancel'])
// a hero: their signature first (full width), then the four shared ultimates; a rival: their one ultimate
const KINDS = computed(() => (props.you?.kind === 'rival' ? ['rival'] : ultsFor(props.you?.look)))
const info = k => (k === 'rival' ? { ...props.you.ult, hero: true } : PLAYER_ULTS[k])
const AIM_TEXT = { smite: 'Choose an enemy knight, bishop or pawn to remove', shield: 'Choose one of your pieces to shield' }
const aimText = computed(() => props.aimHint || (props.aim === 'swap'
  ? (props.swapFrom ? 'Choose the piece to trade places with' : 'Choose the first piece to swap')
  : AIM_TEXT[props.aim]))
const hovered = ref(null)
const hint = computed(() => {
  if (hovered.value) return info(hovered.value).text
  return props.ready ? 'Your ultimate is ready. Choose one.' : 'Captures, checks and losses fill your meter.'
})
</script>

<template>
  <section class="you" :class="{ ready }">
    <div class="head">
      <img v-if="you?.img && !noFace" class="face" :src="you.img" alt="" @error="noFace = true">
      <span class="caption">{{ you?.img ? `${you.name} · Ultimate` : 'Your ultimate' }}</span>
      <b v-if="comeback" class="comeback" title="You're far behind: your meter fills 1.5x faster">Comeback ×1.5</b>
      <span class="pct">{{ Math.round(charge) }}%</span>
    </div>
    <div class="meter"><i :style="{ width: charge + '%' }" /><s v-for="n in 4" :key="n" /></div>

    <div v-if="aim" class="aiming">
      <span>{{ aimText }}</span>
      <button class="ghost" @click="$emit('cancel')">Cancel</button>
    </div>
    <template v-else>
      <div class="abilities">
        <button
          v-for="k in KINDS" :key="k" class="ability" :class="{ sig: !!info(k).hero }" :disabled="!canUse(k)" :title="info(k).text"
          @click="$emit('use', k)" @pointerenter="hovered = k" @pointerleave="hovered = null" @focus="hovered = k" @blur="hovered = null"
        >{{ info(k).name }}</button>
      </div>
      <p class="hint">{{ hint }}</p>
    </template>
  </section>
</template>

<style scoped>
.you { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line); }
.head { display: flex; align-items: center; gap: 10px; }
.face { width: 28px; height: 28px; object-fit: cover; object-position: 50% 20%; box-shadow: 0 0 0 1px var(--line-strong); }
.pct { margin-left: auto; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .1em; color: var(--soft); }
.comeback { font-family: var(--serif); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #ffcf4a; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .5 } }

.meter { position: relative; height: 6px; background: rgba(255, 255, 255, .06); overflow: hidden; }
.meter i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgba(244, 242, 251, .35), #f4f2fb); box-shadow: 0 0 10px rgba(244, 242, 251, .6); transition: width .5s cubic-bezier(.2, .8, .2, 1); }
.meter s { position: relative; float: left; width: 25%; height: 100%; border-right: 2px solid var(--bg); }
.ready .meter i { animation: glow .6s infinite alternate; }
@keyframes glow { to { filter: brightness(1.5) drop-shadow(0 0 6px #fff) } }

.abilities { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ability { padding: 8px 6px; font-size: 10.5px; letter-spacing: .14em; border-color: var(--line); }
.ability:hover:not(:disabled) { background: rgba(244, 242, 251, .08); color: var(--text); border-color: var(--line-strong); }
/* your hero's signature: a full-width button on top, in their own accent */
.ability.sig { grid-column: 1 / -1; padding: 10px 6px; font-size: 11.5px; letter-spacing: .2em; border-color: rgba(232, 228, 255, .4); color: #e8e4ff; background: linear-gradient(90deg, rgba(232, 228, 255, .04), rgba(232, 228, 255, .12), rgba(232, 228, 255, .04)); }
.ability.sig::before { content: '★ '; }
.ready .ability:not(:disabled) { border-color: rgba(244, 242, 251, .55); box-shadow: 0 0 14px -6px #fff; color: var(--text); }
.ability:disabled { opacity: .35; }
.hint { min-height: 2.6em; font-size: 11.5px; line-height: 1.35; color: var(--muted); }

.aiming { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid rgba(244, 242, 251, .5); font-size: 12.5px; color: var(--text); animation: pulse 1.4s ease-in-out infinite; }
.aiming button { padding: 6px 12px; font-size: 10.5px; animation: none; }
</style>

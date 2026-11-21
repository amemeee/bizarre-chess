<script setup>
/* A chess piece drawn from painted art:
   - a character's exclusive set (`set`, e.g. 'ice'): public/assets/pieces/<set>/K.webp … P.webp (+ K-glow.webp …)
   - otherwise the default sets: public/assets/pieces/wK.webp … bP.webp (+ b?-glow.webp for the dark veins)
   Glowing parts are tinted in that side's character colour. If an image is missing it falls back
   to the default set, then to the hand-drawn SVG pieces. */
import { ref, computed, watch } from 'vue'
import PieceSvg from './PieceSvg.vue'

const props = defineProps({
  type: String, color: String, set: { type: String, default: null },
  sway: { type: Boolean, default: false }, // puppet pieces dangle gently from their strings
  swayDelay: { type: Number, default: 0 },
})
const level = ref(0) // 0 = exclusive set (if any), 1 = default set, 2 = drawn SVG
watch(() => [props.color, props.type, props.set].join(), () => { level.value = props.set ? 0 : 1 }, { immediate: true })

const T = computed(() => props.type.toUpperCase())
const useSet = computed(() => level.value === 0 && !!props.set)
const src = computed(() => (useSet.value ? `/assets/pieces/${props.set}/${T.value}.webp` : `/assets/pieces/${props.color}${T.value}.webp`))
const glow = computed(() => {
  if (useSet.value) return `/assets/pieces/${props.set}/${T.value}-glow.webp`
  return props.color === 'b' ? `/assets/pieces/b${T.value}-glow.webp` : null
})
const onError = () => { level.value = useSet.value ? 1 : 2 }
</script>

<template>
  <PieceSvg v-if="level === 2" :type="type" :color="color" />
  <span v-else class="art" :class="[color, { exclusive: useSet, sway }]" :style="sway ? { animationDelay: -swayDelay + 's' } : null">
    <img :key="src" :src="src" alt="" draggable="false" @error="onError">
    <i v-if="glow" class="veins" :style="{ '--mask': `url(${glow})` }" />
  </span>
</template>

<style scoped>
.art { position: relative; display: block; width: 100%; height: 100%; --tint: var(--c); }
/* in spectate, White can be a character too: its glow uses White's colour */
.art.w { --tint: var(--cw, var(--c)); }
.art img { display: block; width: 100%; height: 100%; object-fit: contain; user-select: none; -webkit-user-drag: none; }
.art.w img { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, .55)); }
/* obsidian on a dark board: a thin edge and a soft aura in the opponent's colour keep the silhouette readable */
.art.b img {
  filter: drop-shadow(0 0 1px color-mix(in srgb, var(--tint) 75%, #fff)) drop-shadow(0 0 7px color-mix(in srgb, var(--tint) 50%, transparent))
    drop-shadow(0 3px 4px rgba(0, 0, 0, .65));
}
/* exclusive sets are already bright and coloured: just a soft aura in the character's colour */
.art.exclusive img { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tint) 55%, transparent)) drop-shadow(0 3px 4px rgba(0, 0, 0, .55)); }

/* glowing veins / cores, tinted in the side's colour, slowly pulsing */
.veins {
  position: absolute; inset: 0; pointer-events: none; background: color-mix(in srgb, var(--tint) 65%, #fff);
  -webkit-mask: var(--mask) center / contain no-repeat; mask: var(--mask) center / contain no-repeat;
  animation: veins 3.2s ease-in-out infinite;
}
.art.exclusive .veins { mix-blend-mode: screen; opacity: .8; }
/* puppet pieces hang from their strings and sway slightly, never quite still */
.art.sway { transform-origin: 50% 0%; animation: dangle 3.8s ease-in-out infinite; }
@keyframes dangle { 0%, 100% { transform: rotate(-2.2deg) } 50% { transform: rotate(2.2deg) translateY(-1%) } }
@keyframes veins { 0%, 100% { opacity: .85 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .veins, .art.sway { animation: none; } }
</style>

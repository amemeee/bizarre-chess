<script setup>
/* Refined tournament-style chess pieces (no crosses): warm ivory and polished obsidian,
   lit from the left, with fine outlines. Moods are shown by the board (motion and glow), not on the piece.
   viewBox space: pieces stand on y ≈ 92. */
import { computed } from 'vue'

const props = defineProps({
  type: String,  // p n b r q k
  color: String, // w b
})
// gradients are shared by every piece of the same colour (identical definitions, so repeated ids are harmless)
const fill = computed(() => `url(#pc-fill-${props.color})`)
</script>

<template>
  <svg class="pc" :class="color" viewBox="16 8 68 87" aria-hidden="true">
    <defs>
      <!-- warm ivory: bright on the lit left, falling into a soft shadow on the right -->
      <linearGradient id="pc-fill-w" x1="0" x2="1" y1="0" y2="0.15">
        <stop offset="0" stop-color="#fffdf8" />
        <stop offset="0.38" stop-color="#f1ebdf" />
        <stop offset="0.78" stop-color="#cfc5b5" />
        <stop offset="1" stop-color="#9c9284" />
      </linearGradient>
      <!-- polished obsidian, with the opponent's colour catching the shadow edge -->
      <linearGradient id="pc-fill-b" x1="0" x2="1" y1="0" y2="0.15">
        <stop offset="0" stop-color="#4a4456" />
        <stop offset="0.22" stop-color="#1d1925" />
        <stop offset="0.75" stop-color="#0a090e" />
        <stop offset="1" style="stop-color: color-mix(in srgb, var(--c) 45%, #0a090e)" />
      </linearGradient>
      <!-- narrow specular streak -->
      <linearGradient id="pc-shine" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".9" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- contact shadow -->
    <ellipse class="ground" cx="50" cy="92.6" rx="27" ry="2.2" />

    <g class="body" :style="{ '--fill': fill }">
      <!-- slim two-tier base -->
      <path d="M23 92 Q23 87.5 28 86.5 H72 Q77 87.5 77 92 Z" />
      <path d="M30 86.5 Q31 82.5 36 81.5 H64 Q69 82.5 70 86.5 Z" />

      <template v-if="type === 'p'">
        <path d="M38 81.5 C41 74 43 67 44 59 H56 C57 67 59 74 62 81.5 Z" />
        <ellipse cx="50" cy="57.5" rx="10.5" ry="2.6" />
        <circle cx="50" cy="44" r="11" />
        <path class="shine" d="M43.5 37 C44.5 33.5 47 31.5 49 31 C46.5 33 45 35.5 44.5 38.5 Z" />
        <path class="shine" d="M41.5 78 C43.5 72 45 66 45.6 61 H46.8 C46.4 66 45.4 72 43.4 78 Z" />
      </template>

      <template v-else-if="type === 'r'">
        <path d="M36 81.5 C38 71 39 61 39.5 51 H60.5 C61 61 62 71 64 81.5 Z" />
        <rect x="35" y="46.5" width="30" height="4.6" rx="2.2" />
        <path d="M33 46.5 V27 H40 V32 H46 V27 H54 V32 H60 V27 H67 V46.5 Z" />
        <path class="detail" d="M34 39 H66" />
        <path class="shine" d="M40.5 78 C41.5 69 42 61 42.2 53 H43.4 C43.4 61 43 69 42.2 78 Z" />
        <rect class="shine" x="35" y="29" width="1.6" height="15" rx=".8" />
      </template>

      <template v-else-if="type === 'n'">
        <path d="M34.5 81.5 C34.5 71 38.5 64 45.5 59 C39.5 58 32.5 56 29.5 51 C26.5 46 30 40 36 36 C38 34 39 28.5 39 21.5 C42 24 45 27 47.5 29 C58.5 28 68.5 36 70.5 50 C72.5 63 69.5 74 67.5 81.5 Z" />
        <path class="detail" d="M48.5 30 C58 32 64.5 39 66 50 C67 59 66.5 68 65.5 77" />
        <path class="detail" d="M40 25 C41.5 27 42.5 29 43 31" />
        <circle class="nostril" cx="33" cy="47" r="1" />
        <circle class="nostril" cx="44" cy="38.5" r="1.1" />
        <path class="shine" d="M37.5 78 C38 70 41 64.5 45 61 C42.5 66 40.5 71.5 39.8 78 Z" />
      </template>

      <template v-else-if="type === 'b'">
        <circle cx="50" cy="15.5" r="3.6" />
        <path d="M50 19.5 C59 26.5 63 36 60.5 45.5 C58.8 51.5 55.6 54.8 54 57 H46 C44.4 54.8 41.2 51.5 39.5 45.5 C37 36 41 26.5 50 19.5 Z" />
        <path class="cut" d="M56 28.5 L47.8 38.2" />
        <ellipse cx="50" cy="59" rx="10" ry="2.8" />
        <path d="M43 61.5 C43 69.5 40.5 76 36.5 81.5 H63.5 C59.5 76 57 69.5 57 61.5 Z" />
        <path class="shine" d="M43 43 C42 37 43.5 31 46.5 27 C45 32 44.2 37.5 44.4 43 Z" />
        <path class="shine" d="M40 78.5 C42.8 74 44 69 44.4 63.5 H45.6 C45.3 69.5 44 74.5 41.6 78.5 Z" />
      </template>

      <template v-else-if="type === 'q'">
        <path d="M30 33 L37 53 L41 30 L46 51 L50 26 L54 51 L59 30 L63 53 L70 33 L65 58 H35 Z" />
        <circle cx="30" cy="31" r="2.9" /><circle cx="41" cy="28" r="2.9" /><circle cx="50" cy="23.6" r="3.3" />
        <circle cx="59" cy="28" r="2.9" /><circle cx="70" cy="31" r="2.9" />
        <ellipse cx="50" cy="59.5" rx="15.5" ry="3" />
        <path class="jewels" d="M40 59.6 h0.1 M45 60.2 h0.1 M50 60.4 h0.1 M55 60.2 h0.1 M60 59.6 h0.1" />
        <path d="M37.5 62 C39.5 70 37.5 76 33.5 81.5 H66.5 C62.5 76 60.5 70 62.5 62 Z" />
        <path class="shine" d="M36.6 54 L32 36 L33.2 35.6 L37.8 53.4 Z" />
        <path class="shine" d="M37.6 78.5 C40.5 73 41.6 68 41.2 64 H42.4 C42.8 68.5 41.8 73.5 39.2 78.5 Z" />
      </template>

      <template v-else-if="type === 'k'">
        <!-- arched crown with an orb finial and a gem band (no cross) -->
        <path d="M32.5 35 C36.5 30.5 41 29.5 44.5 31.5 L50 18 L55.5 31.5 C59 29.5 63.5 30.5 67.5 35 L63.5 56 H36.5 Z" />
        <circle cx="50" cy="14.6" r="3.4" />
        <circle cx="32.5" cy="34.5" r="2.4" /><circle cx="67.5" cy="34.5" r="2.4" />
        <ellipse cx="50" cy="58" rx="15.5" ry="3.2" />
        <circle class="gem" cx="50" cy="58" r="1.9" />
        <path d="M37.5 61 C39.5 70 37.5 76 33.5 81.5 H66.5 C62.5 76 60.5 70 62.5 61 Z" />
        <path class="shine" d="M37 53 L34.5 37 L35.8 36.4 L38.3 52.6 Z" />
        <path class="shine" d="M37.6 78.5 C40.5 73 41.6 68 41.2 63 H42.4 C42.8 68.5 41.8 73.5 39.2 78.5 Z" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.pc { width: 100%; height: 100%; overflow: visible; }

.ground { fill: rgba(0, 0, 0, .5); }

/* shaded fill + fine outline */
.body > * { fill: var(--fill); stroke-width: 1.05; stroke-linejoin: round; stroke-linecap: round; }
.pc.w .body > * { stroke: rgba(40, 34, 30, .75); }
.pc.b .body > * { stroke: color-mix(in srgb, var(--c) 55%, #8d86a0); }

/* engraved details, highlights and gems */
.body > .detail, .body > .cut { fill: none; stroke-width: .8; }
.pc.w .body > .detail { stroke: rgba(120, 108, 94, .6); }
.pc.b .body > .detail { stroke: color-mix(in srgb, var(--c) 35%, #4a4456); }
.body > .cut { stroke-width: 1.6; }
.body > .shine { fill: url(#pc-shine); stroke: none; }
.pc.w .body > .shine { opacity: .85; }
.pc.b .body > .shine { opacity: .28; }
.body > .nostril { fill: rgba(40, 34, 30, .6); stroke: none; }
.pc.b .body > .nostril { fill: color-mix(in srgb, var(--c) 50%, #8d86a0); }
.body > .gem { fill: var(--c); stroke: none; }
.body > .jewels { fill: none; stroke: var(--c); stroke-width: 2.1; }
.pc.b .body > .gem { fill: color-mix(in srgb, var(--c) 85%, #fff); }
.pc.b .body > .jewels { stroke: color-mix(in srgb, var(--c) 85%, #fff); }

.pc.w { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, .55)); }
.pc.b { filter: drop-shadow(0 3px 4px rgba(0, 0, 0, .6)) drop-shadow(0 0 4px color-mix(in srgb, var(--c) 30%, transparent)); }
</style>

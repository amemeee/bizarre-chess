<script setup>
/* A row of captured pieces shown beside the board, with the material lead.
   `pieces` are the piece types the other side has lost (e.g. ['p', 'n']), drawn in that side's art. */
import { computed } from 'vue'
import PieceArt from './PieceArt.vue'

const props = defineProps({
  pieces: { type: Array, default: () => [] },
  color: String,                         // colour of the captured pieces
  set: { type: String, default: null },  // their exclusive piece set, if any
  lead: { type: Number, default: 0 },    // material lead of the capturing side (shown when > 0)
  label: String,
  held: { type: Array, default: () => [] }, // piece types in flight to this tray: one slot of each stays empty until it lands
})
const ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 }
const sorted = computed(() => [...props.pieces].sort((a, b) => ORDER[a] - ORDER[b]))
// the slots kept empty: the last piece of each held type (one per flight)
const heldAt = computed(() => {
  const out = new Set()
  const want = {}
  for (const t of props.held) want[t] = (want[t] ?? 0) + 1
  for (let i = sorted.value.length - 1; i >= 0; i--) { const t = sorted.value[i]; if (want[t] > 0) { out.add(i); want[t]-- } }
  return out
})
</script>

<template>
  <div class="tray" :aria-label="label">
    <span class="caption">{{ label }}</span>
    <TransitionGroup name="taken" tag="span" class="pieces">
      <span v-for="(t, i) in sorted" :key="t + i" class="pc" :class="{ gap: i > 0 && sorted[i - 1] !== t, held: heldAt.has(i) }" :data-t="t">
        <PieceArt :type="t" :color="color" :set="set" />
      </span>
    </TransitionGroup>
    <b v-if="lead > 0" class="lead">+{{ lead }}</b>
  </div>
</template>

<style scoped>
.tray { flex: none; height: 30px; display: flex; align-items: center; gap: 10px; padding: 0 22px; min-width: 0; }
.caption { flex: none; font-size: 9.5px; }
.pieces { display: flex; align-items: center; min-width: 0; overflow: hidden; }
/* same pieces overlap; a new kind of piece starts a little apart */
.pc { width: 26px; height: 26px; flex: none; margin-left: -9px; }
.pc:first-child { margin-left: 0; }
.pc.gap { margin-left: -2px; }
.pc :deep(.art img) { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .6)) !important; }
.lead { flex: none; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .08em; color: var(--soft); }
/* a slot waiting for its piece to fly in; when it lands, the piece pops into place */
.pc { transition: opacity .12s, transform .4s cubic-bezier(.3, 1.8, .5, 1); }
.pc.held { opacity: 0; transform: scale(1.7); transition: none; }
/* a newly captured piece drops into the tray */
.taken-enter-active { transition: transform .35s cubic-bezier(.3, 1.5, .5, 1), opacity .35s; }
.taken-enter-from { transform: translateY(-10px) scale(1.4); opacity: 0; }
</style>

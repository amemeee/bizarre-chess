import { ref, computed } from 'vue'
import { CHAPTERS } from '../data/story'

/* Story progress, kept in this browser.
   `cleared` = how many chapters you've beaten in order (chapter i is playable once cleared >= i). */
const KEY = 'bizarre-chess:story'

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { cleared: Math.min(CHAPTERS.length, Math.max(0, v.cleared | 0)), endingSeen: !!v.endingSeen }
  } catch { return { cleared: 0, endingSeen: false } }
}
const state = ref(load())
function save() { try { localStorage.setItem(KEY, JSON.stringify(state.value)) } catch { /* storage unavailable: progress lasts this visit only */ } }

export function useStory() {
  const cleared = computed(() => state.value.cleared)
  const finished = computed(() => state.value.cleared >= CHAPTERS.length)
  const unlocked = i => i <= state.value.cleared
  /** You beat chapter i. Returns true if that finished the story for the first time. */
  function complete(i) {
    const first = i + 1 > state.value.cleared && i + 1 === CHAPTERS.length
    state.value = { ...state.value, cleared: Math.max(state.value.cleared, i + 1) }
    save()
    return first
  }
  function markEnding() { state.value = { ...state.value, endingSeen: true }; save() }
  function reset() { state.value = { cleared: 0, endingSeen: false }; save() }
  return { cleared, finished, unlocked, complete, markEnding, reset, endingSeen: computed(() => state.value.endingSeen) }
}

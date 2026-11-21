import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

const games = ref([])
const loading = ref(false)

export function useStats() {
  async function load() {
    if (!supabase) return
    loading.value = true
    const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false }).limit(500)
    games.value = data ?? []
    loading.value = false
  }

  /** Saves a finished game. Does nothing when signed out / Supabase not configured. */
  async function saveGame(g) {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('games').insert(g).select().single()
    if (data) games.value = [data, ...games.value]
  }

  const totals = computed(() => {
    const t = { played: games.value.length, win: 0, loss: 0, draw: 0, ultimates: 0 }
    for (const g of games.value) { t[g.result]++; t.ultimates += g.ultimates_faced }
    t.rate = t.played ? Math.round((t.win / t.played) * 100) : 0
    return t
  })

  const byCharacter = computed(() => {
    const m = {}
    for (const g of games.value) {
      const c = (m[g.character_id] ??= { win: 0, loss: 0, draw: 0, played: 0 })
      c[g.result]++; c.played++
    }
    return m
  })

  function clear() { games.value = [] }
  return { games, loading, totals, byCharacter, load, saveGame, clear }
}

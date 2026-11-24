import { ref, computed } from 'vue'

/* The player's character: one of two, chosen once (and changeable on the Profile page). Kept in this browser.
   Used as the hero of the story (rivals say the name), and as your portrait in duels, your ultimates' cut-ins,
   the Collection and the Profile page. */
export const HEROES = {
  m: { key: 'm', name: 'Shin', label: 'Male', img: '/assets/characters/shin/portrait.jpg', desc: 'A quiet newcomer who never shows his hand.' },
  f: { key: 'f', name: 'Akane', label: 'Female', img: '/assets/characters/akane/portrait.jpg', desc: 'A quiet newcomer whose red eyes miss nothing.' },
}
export const PLAYER_GLOW = '#e8e4ff'
const KEY = 'bizarre-chess:player'

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (HEROES[v.look]) return v.look
  } catch { /* no storage */ }
  return null
}
const look = ref(load())

export function usePlayer() {
  const ready = computed(() => !!look.value)
  // the player as a character: { id, name, glow, img, art } (a neutral "You" until one is chosen)
  const hero = computed(() => {
    const h = HEROES[look.value]
    return { id: 'player', name: h?.name ?? 'You', glow: PLAYER_GLOW, img: h?.img ?? null, art: 'color', look: look.value, desc: h?.desc ?? '' }
  })
  function save(k) {
    if (!HEROES[k]) return
    look.value = k
    try { localStorage.setItem(KEY, JSON.stringify({ look: k })) } catch { /* lasts this visit only */ }
  }
  return { ready, hero, save, look }
}

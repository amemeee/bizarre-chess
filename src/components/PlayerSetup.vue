<script setup>
/* Choose your character: Shin or Akane. Both are playable; you play as one at a time.
   Shown the first time you open Story, and from the Profile page / story map to switch. */
import { ref, onMounted, onUnmounted } from 'vue'
import { HEROES, usePlayer } from '../composables/usePlayer'

defineProps({ title: { type: String, default: 'Choose your character' }, cancellable: { type: Boolean, default: false } })
const emit = defineEmits(['done', 'cancel'])
const { look, save } = usePlayer()

const pick = ref(look.value)
function confirm() { if (!pick.value) return; save(pick.value); emit('done') }

const key = e => {
  if (e.key === 'Escape') emit('cancel')
  else if (e.key === 'ArrowLeft') pick.value = 'm'
  else if (e.key === 'ArrowRight') pick.value = 'f'
  else if (e.key === 'Enter' && pick.value) { e.preventDefault(); confirm() }
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
</script>

<template>
  <div class="backdrop" @click.self="cancellable && emit('cancel')">
    <div class="dialog" role="dialog" :aria-label="title">
      <p class="eyebrow">Your character</p>
      <h2>{{ title }}</h2>

      <div class="heroes" role="radiogroup" aria-label="Character">
        <button
          v-for="h in HEROES" :key="h.key" type="button" role="radio" :aria-checked="pick === h.key"
          class="hero" :class="{ on: pick === h.key }" @click="pick = h.key" @dblclick="pick = h.key; confirm()"
        >
          <img :src="h.img" alt="" draggable="false">
          <span class="meta">
            <small>{{ h.label }}</small>
            <b>{{ h.name }}</b>
            <em>{{ h.desc }}</em>
          </span>
        </button>
      </div>

      <div class="btns">
        <button v-if="cancellable" type="button" class="ghost" @click="emit('cancel')">Cancel</button>
        <button type="button" class="go" :disabled="!pick" @click="confirm">
          {{ pick ? `Play as ${HEROES[pick].name}` : 'Pick one' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(4, 4, 8, .85); backdrop-filter: blur(6px); animation: fade .3s both; }
@keyframes fade { from { opacity: 0 } }
.dialog { width: min(760px, 100%); max-height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 28px; background: #0d0c14; border: 1px solid var(--line-strong); box-shadow: 0 30px 80px rgba(0, 0, 0, .6); }
.eyebrow { font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
h2 { font-size: clamp(24px, 4vh, 34px); letter-spacing: .06em; }
.heroes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.hero {
  position: relative; aspect-ratio: 4 / 5; padding: 0; overflow: hidden; border: 1px solid var(--line); background: #08080c;
  text-transform: none; letter-spacing: 0; font-family: inherit; font-weight: 400; text-align: left; transition: border-color .25s, box-shadow .25s, transform .25s;
}
.hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; filter: grayscale(.75) brightness(.55); transition: filter .35s, transform .5s; }
.hero:hover:not(:disabled) { background: #08080c; border-color: var(--line-strong); }
.hero:hover img { filter: grayscale(.25) brightness(.8); }
.hero.on { border-color: #e8e4ff; box-shadow: 0 0 0 1px #e8e4ff, 0 0 40px -10px #e8e4ff; transform: translateY(-4px); }
.hero.on img { filter: none; transform: scale(1.04); }
.meta { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 3px; padding: 50px 16px 14px; background: linear-gradient(transparent, rgba(7, 7, 11, .75) 40%, rgba(7, 7, 11, .96)); }
.meta small { font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: .26em; text-transform: uppercase; color: var(--muted); }
.meta b { font-family: var(--serif); font-weight: 900; font-size: clamp(24px, 4.4vh, 36px); letter-spacing: .08em; text-transform: uppercase; line-height: 1; color: var(--soft); }
.hero.on .meta b { color: #fff; text-shadow: 0 0 24px rgba(232, 228, 255, .6); }
.hero.on .meta small { color: #e8e4ff; }
.meta em { font-style: normal; font-size: 12px; line-height: 1.4; color: var(--muted); }
.hero.on .meta em { color: var(--soft); }
@media (max-width: 520px) { .dialog { padding: 18px; } .meta b { font-size: 20px; letter-spacing: .04em; } .meta em { font-size: 11px; } }
.btns { display: flex; justify-content: flex-end; gap: 10px; }
.go { padding: 10px 26px; }
</style>

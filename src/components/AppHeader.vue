<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { isMuted, setMuted, onMuteChange } from '../lib/sound'

defineEmits(['nav', 'login'])
const { user, cloudEnabled, signOut } = useAuth()
const label = computed(() => (user.value?.is_anonymous ? 'Guest' : user.value?.email?.split('@')[0] ?? ''))

// sound on/off, remembered in this browser
const muted = ref(isMuted())
onUnmounted(onMuteChange(m => { muted.value = m }))
</script>

<template>
  <header>
    <button class="ghost sound" :aria-pressed="!muted" :title="muted ? 'Sound off' : 'Sound on'" @click="setMuted(!muted)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        <template v-if="!muted"><path class="wave" d="M16 9a4 4 0 0 1 0 6" /><path class="wave" d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></template>
        <path v-else class="wave" d="M16 9l5 6M21 9l-5 6" />
      </svg>
      <span>{{ muted ? 'Sound off' : 'Sound on' }}</span>
    </button>
    <template v-if="cloudEnabled">
      <template v-if="user">
        <a class="tag" href="#" title="Your stats" @click.prevent="$emit('nav', 'stats')">{{ label }}</a>
        <button class="ghost" @click="signOut">Sign out</button>
      </template>
      <button v-else class="ghost" @click="$emit('login')">Sign in</button>
    </template>
  </header>
</template>

<style scoped>
header { position: relative; z-index: 10; flex: none; display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 10px 16px 6px; }
header button { padding: 7px 14px; font-size: 11px; }
.sound { display: inline-flex; align-items: center; gap: 8px; }
.sound svg { width: 15px; height: 15px; fill: currentColor; }
.sound .wave { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.tag { color: var(--soft); text-decoration: none; font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; padding: 7px 4px; }
.tag:hover { color: var(--text); }
</style>

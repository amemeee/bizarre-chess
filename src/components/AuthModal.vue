<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits(['close'])
const { user, cloudEnabled, signInGuest, signInEmail } = useAuth()
const email = ref('')
const sent = ref(false)
const err = ref('')
const loading = ref(false)

watch(user, u => { if (u) emit('close') })

async function run(fn) {
  loading.value = true; err.value = ''
  const e = await fn()
  loading.value = false
  if (e) err.value = e.message
  return !e
}
const guest = () => run(signInGuest)
async function magic() { if (email.value && await run(() => signInEmail(email.value.trim()))) sent.value = true }
</script>

<template>
  <div class="backdrop" @click.self="$emit('close')">
    <div class="modal">
      <span class="caption">Bizarre Chess</span>
      <h2>Save your progress</h2>
      <p v-if="!cloudEnabled" class="muted">Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code> and add your project keys.</p>
      <template v-else-if="sent">
        <p>Check <b>{{ email }}</b> for your sign-in link.</p>
        <button class="ghost" @click="$emit('close')">Close</button>
      </template>
      <template v-else>
        <p class="muted">Sign in to keep your wins, losses and stats across devices.</p>
        <form @submit.prevent="magic">
          <input v-model="email" type="email" placeholder="you@example.com" required autofocus>
          <button :disabled="loading">Email me a sign-in link</button>
        </form>
        <div class="or"><span>or</span></div>
        <button class="ghost" :disabled="loading" @click="guest">Continue as guest</button>
        <p v-if="err" class="err">{{ err }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(4, 4, 8, .78); backdrop-filter: blur(8px); display: grid; place-items: center; padding: 16px; }
.modal { position: relative; width: min(420px, 100%); padding: 32px; display: flex; flex-direction: column; gap: 14px; background: #0d0c14; border: 1px solid var(--line); box-shadow: 0 40px 100px -30px #000, 0 0 80px -30px rgba(139, 107, 255, .5); }
.modal::after { content: ''; position: absolute; left: 50%; bottom: -1px; width: 5px; height: 22px; transform: translateX(-50%); background: var(--text); clip-path: polygon(0 0, 100% 0, 50% 100%); }
h2 { font-size: 24px; }
p { color: var(--soft); font-size: 14px; line-height: 1.5; }
form { display: flex; flex-direction: column; gap: 10px; }
.or { text-align: center; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 10px; }
.or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.err { color: var(--loss); font-size: 13px; }
</style>

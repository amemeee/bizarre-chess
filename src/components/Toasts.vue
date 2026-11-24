<script setup>
/* Pop-up notifications along the top of the screen: achievements unlocked, a piece set evolving. */
import { toasts } from '../composables/useProgress'
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toasts" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">
      <i aria-hidden="true">{{ t.kind === 'evolve' ? '⚡' : '★' }}</i>
      <span><b>{{ t.title }}</b><small>{{ t.text }}</small></span>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toasts { position: fixed; top: 14px; left: 50%; translate: -50% 0; z-index: 70; display: flex; flex-direction: column; gap: 8px; pointer-events: none; width: min(420px, calc(100vw - 32px)); }
.toast { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: rgba(13, 12, 20, .95); border: 1px solid #ffcf4a; box-shadow: 0 10px 30px rgba(0, 0, 0, .5), 0 0 24px -8px #ffcf4a; }
.toast.evolve { border-color: #3d7bff; box-shadow: 0 10px 30px rgba(0, 0, 0, .5), 0 0 24px -8px #3d7bff; }
.toast i { font-style: normal; font-size: 20px; color: #ffcf4a; }
.toast.evolve i { color: #3d7bff; }
.toast span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.toast b { font-family: var(--serif); font-weight: 900; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #fff; }
.toast small { font-size: 12px; color: var(--soft); }
.toast-enter-active, .toast-leave-active { transition: opacity .35s, transform .35s cubic-bezier(.2, .8, .2, 1); }
.toast-enter-from { opacity: 0; transform: translateY(-20px) scale(.95); }
.toast-leave-to { opacity: 0; transform: translateY(-10px); }
</style>

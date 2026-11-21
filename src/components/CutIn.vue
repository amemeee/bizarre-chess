<script setup>
defineProps({ char: Object })
// Random spark trajectories, generated once per cut-in
const sparks = Array.from({ length: 36 }, () => {
  const a = Math.random() * 6.28, d = 160 + Math.random() * 380
  return { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', animationDelay: Math.random() * .5 + 's' }
})
</script>

<template>
  <div class="cutin">
    <div class="band">
      <img v-if="char.img" :src="char.img" alt="" :class="{ color: char.art === 'color' }" :style="{ objectPosition: char.focus }">
      <span v-else class="emoji">{{ char.emoji.ult }}</span>
    </div>
    <div class="line top" /><div class="line bot" />
    <div class="big">
      <span class="caption">{{ char.name }} · Ultimate</span>
      <h2>{{ char.ult.name }}</h2>
      <p>{{ char.ult.text }}</p>
    </div>
    <i v-for="(s, i) in sparks" :key="i" class="sp" :style="s" />
  </div>
</template>

<style scoped>
.cutin { position: fixed; inset: 0; z-index: 50; pointer-events: none; overflow: hidden; background: rgba(4, 4, 8, .88); color: var(--text); animation: flash 2.4s forwards; }
.band {
  position: absolute; left: -10%; right: -10%; top: 26%; height: 48%; overflow: hidden; transform: skewY(-5deg); animation: slide 2.4s cubic-bezier(.2, .8, .2, 1) forwards;
  background: linear-gradient(100deg, color-mix(in srgb, var(--c) 55%, #000), #000 75%);
}
.band img { position: absolute; left: 8%; top: -40%; width: 60%; height: 180%; object-fit: cover; filter: invert(1); mix-blend-mode: screen; opacity: .9; transform: skewY(5deg); }
.band img.color { filter: none; mix-blend-mode: normal; opacity: 1; -webkit-mask-image: linear-gradient(90deg, transparent, #000 15% 70%, transparent); mask-image: linear-gradient(90deg, transparent, #000 15% 70%, transparent); }
.band .emoji { position: absolute; left: 18%; top: 50%; transform: translateY(-50%) skewY(5deg); font-size: min(26vh, 200px); }
.line { position: absolute; left: -10%; right: -10%; height: 1px; background: var(--text); transform: skewY(-5deg); animation: slide 2.4s cubic-bezier(.2, .8, .2, 1) forwards; }
.line.top { top: calc(26% - 10px); } .line.bot { top: calc(74% + 10px); animation-direction: reverse; }
.big { position: absolute; right: 8%; top: 50%; transform: translateY(-50%); text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; animation: zoom 2.4s forwards; }
.big h2 { font-size: min(11vw, 96px); letter-spacing: .06em; text-shadow: 0 0 40px var(--c); }
.big p { font-size: 15px; color: var(--soft); max-width: 36ch; }
.sp { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px 2px var(--c); animation: spark 1.6s forwards; }
@keyframes flash { 0% { opacity: 0 } 10% { opacity: 1 } 85% { opacity: 1 } 100% { opacity: 0 } }
@keyframes slide { 0% { translate: -100% 0 } 22% { translate: 0 0 } 100% { translate: 3% 0 } }
@keyframes zoom { 0% { opacity: 0; transform: translate(40px, -50%) } 25% { opacity: 1; transform: translate(0, -50%) } }
@keyframes spark { from { opacity: 1; transform: translate(0, 0) } to { opacity: 0; transform: translate(var(--dx), var(--dy)) } }
</style>

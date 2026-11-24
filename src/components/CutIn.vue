<script setup>
/* The ultimate cut-in: the character sweeps across the screen with the ultimate's name,
   over a motif of their own (Mio's flames, Haru's petals and vines, Kaito's golden crown, Jun's dice and cards,
   Yuki's snow, Ren's clock, Sena's breaking glass, Noa's strings, your light). */
import { ref, computed } from 'vue'
const props = defineProps({ char: Object })
// an ultimate can have its own key art (ult.img, colour); otherwise the portrait is used
const ultFailed = ref(false)
const art = computed(() => (props.char.ult?.img && !ultFailed.value ? props.char.ult.img : props.char.img))
const artColor = computed(() => art.value === props.char.ult?.img || props.char.art === 'color')
const fx = computed(() => props.char.ult?.fx ?? 'you')
const theme = computed(() => (['smite', 'shield', 'rewind', 'double'].includes(fx.value) ? 'you' : fx.value))
const r = (a, b) => a + Math.random() * (b - a)
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i))

// random spark trajectories, generated once per cut-in
const sparks = many(36, () => {
  const a = Math.random() * 6.28, d = 160 + Math.random() * 380
  return { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', animationDelay: Math.random() * .5 + 's' }
})
// motif particles (all generated once; each theme uses its own)
const flames = many(26, i => ({ left: (i / 25) * 100 + '%', '--h': r(14, 34) + 'vh', '--d': r(0, .5) + 's', '--w': r(3, 6) + 'vw' }))
const petals = many(34, () => ({ left: r(-10, 100) + '%', '--d': r(0, 1.4) + 's', '--dx': r(10, 30) + 'vw', '--r': r(200, 720) + 'deg', '--s': r(.6, 1.3) }))
const flakes = many(40, () => ({ left: r(0, 100) + '%', '--d': r(0, 1.6) + 's', '--dx': r(-6, 6) + 'vw', '--s': r(.4, 1.2), '--t': r(1.6, 2.6) + 's' }))
const dice = many(5, i => ({ top: r(8, 85) + '%', '--d': i * .18 + 's', '--r': r(540, 1080) + 'deg', '--s': r(.7, 1.3), '--y': r(-20, 20) + 'vh' }))
const cards = many(10, () => ({ left: r(30, 70) + '%', top: r(30, 70) + '%', '--dx': r(-50, 50) + 'vw', '--dy': r(-45, 45) + 'vh', '--r': r(-540, 540) + 'deg', '--d': r(.2, .8) + 's' }))
const strings = many(16, i => ({ left: (i / 15) * 100 + r(-2, 2) + '%', '--h': r(25, 95) + '%', '--d': r(0, .6) + 's', '--sw': r(1.5, 4) + 's' }))
const cracks = many(9, i => ({ '--a': i * 40 + r(-12, 12) + 'deg', '--l': r(35, 70) + 'vmax', '--d': r(0, .25) + 's' }))
const shards = many(22, () => {
  const a = Math.random() * 6.28, d = r(20, 55)
  return { '--dx': Math.cos(a) * d + 'vw', '--dy': Math.sin(a) * d + 'vh', '--r': r(-500, 500) + 'deg', '--d': r(.5, .8) + 's', '--s': r(.6, 1.6) }
})
const links = many(8, i => ({ top: 8 + i * 11.5 + '%', '--d': i * 0.06 + 's', '--dir': i % 2 ? 1 : -1 }))
const bubbles = many(30, () => ({ left: r(0, 100) + '%', '--d': r(0, 1.4) + 's', '--s': r(.5, 1.6), '--t': r(1.4, 2.4) + 's', '--dx': r(-4, 4) + 'vw' }))
const drips = many(14, () => ({ left: r(0, 100) + '%', '--h': r(6, 22) + 'vh', '--d': r(0, .8) + 's' }))
</script>

<template>
  <div class="cutin" :class="['t-' + theme, { alter: char.alter }]">
    <!-- the motif, behind everything -->
    <div class="motif" aria-hidden="true">
      <template v-if="theme === 'burn'">
        <i class="art flamewall" /><i class="art fheart" /><i class="art cake" />
        <i v-for="(f, i) in flames" :key="i" class="flame" :style="f" />
        <i class="heat" />
      </template>
      <template v-else-if="theme === 'revive'">
        <i class="art hvine top" /><i class="art hvine bottom" /><i class="art hflower" /><i class="art hcan" />
        <svg class="vines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M-2 102 C 10 80, 2 70, 14 58 S 8 30, 22 18 S 30 4, 40 -2" />
          <path d="M102 102 C 90 84, 98 72, 86 62 S 92 36, 78 24 S 70 6, 60 -2" />
          <path d="M-2 40 C 6 46, 10 38, 16 44 S 22 50, 28 46" />
          <path d="M102 60 C 94 54, 90 62, 84 56 S 78 50, 72 54" />
        </svg>
        <i v-for="(p, i) in petals" :key="i" class="petal" :style="p" />
      </template>
      <template v-else-if="theme === 'promote'">
        <i class="art kbolt" /><i class="art kfist" /><i class="art kstars" /><i class="art kcrown" />
        <i class="rays" />
        <svg class="crown" viewBox="0 0 100 80">
          <path d="M8 72 L8 30 L30 50 L50 16 L70 50 L92 30 L92 72 Z" />
          <circle cx="8" cy="26" r="5" /><circle cx="50" cy="11" r="6" /><circle cx="92" cy="26" r="5" />
        </svg>
        <i class="bolt b1" /><i class="bolt b2" />
      </template>
      <template v-else-if="theme === 'gamble'">
        <i class="art cardfan" /><i class="art coin" /><i class="art chipstack" />
        <span v-for="(d, i) in dice" :key="'d' + i" class="die" :style="d"><i /><i /><i /><i /><i /></span>
        <i v-for="(c, i) in cards" :key="'c' + i" class="card" :style="c" />
      </template>
      <template v-else-if="theme === 'freeze'">
        <i class="art icicles" /><i class="art bigflake" /><i class="art iceswirl" /><i class="art icecrown" />
        <i class="frost" />
        <i v-for="(f, i) in flakes" :key="i" class="flake" :style="f" />
      </template>
      <template v-else-if="theme === 'skip'">
        <i class="gear g1" /><i class="gear g2" />
        <div class="clock"><i class="hand hr" /><i class="hand mn" /></div>
        <i class="watch" />
      </template>
      <template v-else-if="theme === 'demote'">
        <i class="art window l" /><i class="art window r" /><i class="art throne" />
        <i v-for="(c, i) in cracks" :key="'k' + i" class="crack" :style="c" />
        <i v-for="(s, i) in shards" :key="'s' + i" class="shard" :style="s" />
      </template>
      <!-- Erika: rain sheets down past an opening umbrella, the storm cloud overhead -->
      <template v-else-if="theme === 'flood'">
        <i class="art crain" /><i class="art ccloud" /><i class="art cumbrella" /><i class="art clight" />
      </template>
      <!-- Melati: songket cloth unfurls, the loom and the keris -->
      <template v-else-if="theme === 'bond'">
        <i class="art cthread top" /><i class="art cthread bottom" /><i class="art ccloth" /><i class="art cloom" /><i class="art ckeris" />
      </template>
      <!-- Rai: a lightning bolt, an electric ring, and a wink with a heart -->
      <template v-else-if="theme === 'chain'">
        <i class="art rbolt" /><i class="art rring" /><i class="art rsparkle" /><i class="art rhearts" /><i class="art rarc" />
      </template>
      <!-- AI-0: a wireframe floor, a loading ring and a code panel -->
      <template v-else-if="theme === 'calc' || theme === 'reset'">
        <i class="art cfloor" /><i class="art aring" /><i class="art cpanel" /><i class="art cpixels" />
      </template>
      <!-- Shin: his hand slides a king through drifting mist -->
      <template v-else-if="theme === 'swap'">
        <i class="rays white" /><i class="art mistcloud" /><i class="art shinhand" /><i class="art wisps" />
      </template>
      <!-- Akane: her crimson eye opens behind everything -->
      <template v-else-if="theme === 'sight'">
        <i class="art bigeye" /><i class="art cring" />
      </template>
      <template v-else-if="theme === 'seal'">
        <i class="redglow" />
        <i v-for="(l, i) in links" :key="i" class="chainrow" :style="l" />
        <i class="biglock" style="left: 13%; top: 85%; --t: 0s"><b /></i>
        <i class="biglock" style="left: 87%; top: 15%; --t: .15s"><b /></i>
      </template>
      <template v-else-if="theme === 'poison'">
        <i class="art sdrips" /><i class="art svial" /><i class="art sskull" /><i class="art sfog" />
        <i class="fog" />
        <i v-for="(d, i) in drips" :key="'d' + i" class="drip" :style="d" />
        <i v-for="(b, i) in bubbles" :key="'b' + i" class="bubble" :style="b" />
      </template>
      <template v-else-if="theme === 'steal'">
        <i class="art curtain l" /><i class="art curtain r" /><i class="art phand" /><i class="art spool" />
        <i v-for="(s, i) in strings" :key="i" class="string" :style="s"><b /></i>
      </template>
      <template v-else>
        <i class="rays white" />
      </template>
    </div>

    <div class="band">
      <img
        v-if="art" :src="art" alt="" :class="{ color: artColor, key: art === char.ult?.img, alter: char.alter }"
        :style="{ objectPosition: art === char.ult?.img ? '50% 50%' : char.focus }" @error="ultFailed = true"
      >
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
.motif { position: absolute; inset: 0; overflow: hidden; }
.motif i, .motif span { position: absolute; display: block; }
/* an Alter's cut-in: its whole motif in black-and-white negative, the band in greys */
.cutin.alter .motif, .cutin.alter .line { filter: grayscale(1) invert(1) contrast(1.1); }
.cutin.alter .band { background: linear-gradient(100deg, #d8d8d8, #000 75%); }
/* painted art (public/assets/fx/<character>/) placed above and below the band, clear of the portrait and title */
.art { background: center / contain no-repeat; animation: artin .6s cubic-bezier(.2, .8, .2, 1) both; }
@keyframes artin { from { opacity: 0; transform: translateY(12%) scale(.9) } }
/* Rai */
.rbolt { left: 7%; top: -2%; height: 46vh; aspect-ratio: 197 / 367; background-image: url(/assets/fx/rai/bolt.webp); mix-blend-mode: screen; animation: artin .2s both, flicker .12s steps(2) .3s 6; }
.rring { right: 7%; bottom: 2%; height: 25vh; aspect-ratio: 1; background-image: url(/assets/fx/rai/ring.webp); mix-blend-mode: screen; animation: artin .5s .1s both, spin 3s linear infinite; }
.rsparkle { right: 24%; top: 3%; height: 15vh; aspect-ratio: 188 / 175; background-image: url(/assets/fx/rai/sparkle.webp); animation: artin .4s .35s both, beat .6s ease-in-out .8s infinite alternate; }
.rhearts { left: 24%; top: 4%; height: 15vh; aspect-ratio: 97 / 130; background-image: url(/assets/fx/rai/hearts.webp); animation-delay: .5s; }
.rarc { left: 0; right: 0; bottom: 6%; height: 7vh; background: url(/assets/fx/rai/arc.webp) center / 100% 100% no-repeat; mix-blend-mode: screen; animation: artin .3s .2s both, flicker .12s steps(2) .5s 5; }
/* Erika */
.crain { inset: 0; background: url(/assets/fx/erika/rain.webp) 0 0 / 22vw auto repeat; opacity: .35; mix-blend-mode: screen; animation: artin .4s both, craindrop .5s linear infinite; }
@keyframes craindrop { to { background-position: 0 50vh } }
.ccloud { left: 4%; top: -2%; height: 24vh; aspect-ratio: 388 / 180; background-image: url(/assets/fx/erika/cloud.webp); }
.cumbrella { right: 9%; bottom: 3%; height: 24vh; aspect-ratio: 202 / 213; background-image: url(/assets/fx/erika/umbrella.webp); animation: artin .6s .2s both; }
.clight { right: 26%; top: 3%; height: 15vh; aspect-ratio: 247 / 147; background-image: url(/assets/fx/erika/lightning.webp); animation: artin .2s .5s both, flicker .15s steps(2) .7s 4; }
/* Melati */
.cthread { left: -2%; right: -2%; height: 7vh; background: url(/assets/fx/melati/thread.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 10px #e3b23c); animation: hvine 1s ease-out both; }
.cthread.top { top: 4%; } .cthread.bottom { bottom: 4%; transform: scaleX(-1); }
.ccloth { left: 5%; bottom: 0; height: 24vh; aspect-ratio: 366 / 219; background-image: url(/assets/fx/melati/cloth.webp); animation-delay: .15s; }
.cloom { right: 7%; top: 1%; height: 24vh; aspect-ratio: 356 / 332; background-image: url(/assets/fx/melati/loom.webp); animation-delay: .25s; }
.ckeris { right: 10%; bottom: 3%; height: 22vh; aspect-ratio: 290 / 245; background-image: url(/assets/fx/melati/keris.webp); filter: drop-shadow(0 0 14px #e3b23c); animation: artin .5s .35s both; }
/* AI-0 */
.cfloor { left: -5%; right: -5%; bottom: -2%; height: 30vh; background: url(/assets/fx/ai/floor.webp) center bottom / 100% 100% no-repeat; opacity: .8; }
.aring { right: 9%; top: 3%; height: 22vh; aspect-ratio: 1; background-image: url(/assets/fx/ai/ring.webp); filter: drop-shadow(0 0 16px #00e5c7); animation: artin .5s both, spin 1.2s linear infinite; }
@keyframes spin { to { rotate: 360deg } }
.cpanel { left: 6%; top: 3%; height: 19vh; aspect-ratio: 298 / 162; background-image: url(/assets/fx/ai/panel.webp); animation-delay: .2s; }
.cpixels { right: 26%; bottom: 4%; height: 18vh; aspect-ratio: 312 / 281; background-image: url(/assets/fx/ai/pixels.webp); animation-delay: .3s; }
/* Haru */
.hvine { left: -3%; right: -3%; height: 14vh; background: url(/assets/fx/haru/vine.webp) center / 100% 100% no-repeat; filter: drop-shadow(0 0 12px #4dff9b); animation: hvine 1s ease-out both; }
.hvine.top { top: 0; } .hvine.bottom { bottom: 0; transform: scaleY(-1); }
@keyframes hvine { from { clip-path: inset(0 100% 0 0) } }
.hflower { right: 9%; top: 3%; height: 20vh; aspect-ratio: 343 / 347; background-image: url(/assets/fx/haru/flower.webp); animation: artin .6s .2s both, flakespin 14s linear infinite; }
.hcan { left: 7%; bottom: 4%; height: 20vh; aspect-ratio: 298 / 308; background-image: url(/assets/fx/haru/can.webp); animation-delay: .35s; }
/* Kaito */
.t-promote .motif .crown { display: none; } /* the painted crown replaces the drawn outline */
.kbolt { left: 7%; top: -2%; height: 50vh; aspect-ratio: 182 / 626; background-image: url(/assets/fx/kaito/bolt.webp); filter: drop-shadow(0 0 20px #ffb020); animation: artin .3s both, flicker .15s steps(2) .3s 6; }
@keyframes flicker { 50% { opacity: .5 } }
.kfist { right: 7%; bottom: 2%; height: 26vh; aspect-ratio: 316 / 320; background-image: url(/assets/fx/kaito/fist.webp); filter: drop-shadow(0 0 20px #ffb020); animation: artin .4s .15s both, punch .5s ease-in-out .6s infinite alternate; }
@keyframes punch { to { transform: translateY(-6%) scale(1.05) } }
.kstars { right: 26%; top: 2%; height: 18vh; aspect-ratio: 245 / 222; background-image: url(/assets/fx/kaito/stars.webp); animation-delay: .3s; }
.kcrown { left: 24%; top: 2%; height: 20vh; aspect-ratio: 275 / 315; background-image: url(/assets/fx/kaito/crown.webp); animation: crownin .7s cubic-bezier(.3, 1.4, .5, 1) .25s both; }
@keyframes crownin { from { opacity: 0; transform: translateY(-60%) } }
/* Shion */
.sdrips { left: 30%; right: 30%; top: 0; height: 18vh; background: url(/assets/fx/shion/drips.webp) center top / 100% 100% no-repeat; transform-origin: 50% 0; animation: sdrips 2s ease-in both; }
@keyframes sdrips { from { transform: scaleY(.2); opacity: 0 } 30% { opacity: 1 } to { transform: scaleY(1.2) } }
.svial { right: 8%; top: 3%; height: 20vh; aspect-ratio: 174 / 218; background-image: url(/assets/fx/shion/vial.webp); animation: artin .6s .15s both, vialsway 1.4s ease-in-out .7s infinite alternate; }
@keyframes vialsway { from { rotate: -6deg } to { rotate: 6deg } }
.sskull { right: 8%; bottom: 3%; height: 22vh; aspect-ratio: 375 / 355; background-image: url(/assets/fx/shion/skull.webp); opacity: .9; animation-delay: .3s; }
.sfog { left: -10%; bottom: -3%; width: 75%; aspect-ratio: 816 / 250; background-image: url(/assets/fx/shion/fog.webp); opacity: .8; animation: artin .6s both, blow 2.4s ease-in-out; }
/* Mio */
.flamewall { left: -5%; right: -5%; bottom: -2%; height: 30vh; background: url(/assets/fx/mio/flames.webp) 0 100% / auto 100% repeat-x; filter: drop-shadow(0 0 20px #ff3d7a); }
.fheart { right: 9%; top: 3%; height: 22vh; aspect-ratio: 213 / 202; background-image: url(/assets/fx/mio/heart.webp); animation: artin .6s .2s both, beat .7s ease-in-out .8s infinite alternate; }
@keyframes beat { to { transform: scale(1.08) } }
.cake { left: 10%; top: 4%; height: 18vh; aspect-ratio: 114 / 155; background-image: url(/assets/fx/mio/cake.webp); animation-delay: .35s; }
/* Jun */
.cardfan { left: 6%; bottom: 2%; height: 26vh; aspect-ratio: 290 / 224; background-image: url(/assets/fx/jun/cards.webp); rotate: -8deg; }
.coin { right: 12%; top: 4%; height: 17vh; aspect-ratio: 1; background-image: url(/assets/fx/jun/coin.webp); animation: artin .6s .15s both, coinspin 1.2s linear .7s infinite; }
@keyframes coinspin { 50% { transform: scaleX(.08) } }
.chipstack { right: 6%; bottom: 3%; height: 22vh; aspect-ratio: 272 / 217; background-image: url(/assets/fx/jun/chips.webp); animation-delay: .3s; }
/* Yuki */
.icicles { left: 0; right: 0; top: 0; height: 15vh; background: url(/assets/fx/yuki/icicles.webp) 0 0 / auto 100% repeat-x; filter: drop-shadow(0 0 10px #8ff0ff); }
.bigflake { right: 8%; bottom: 3%; height: 22vh; aspect-ratio: 173 / 196; background-image: url(/assets/fx/yuki/snowflake.webp); animation: artin .6s .2s both, flakespin 8s linear infinite; }
@keyframes flakespin { to { rotate: 360deg } }
.iceswirl { left: -10%; bottom: 0; width: 70%; aspect-ratio: 574 / 179; background-image: url(/assets/fx/yuki/swirl.webp); opacity: .85; animation: artin .6s both, blow 2.4s ease-in-out; }
@keyframes blow { to { translate: 20% 0 } }
.icecrown { left: 12%; top: 14vh; height: 11vh; aspect-ratio: 215 / 176; background-image: url(/assets/fx/yuki/crown.webp); animation-delay: .35s; }
/* Sena */
.window { top: 2%; height: 26vh; aspect-ratio: 146 / 366; background-image: url(/assets/fx/sena/window.webp); }
.window.l { left: 6%; } .window.r { right: 6%; }
.throne { right: 26%; bottom: 1%; height: 24vh; aspect-ratio: 212 / 358; background-image: url(/assets/fx/sena/throne.webp); filter: drop-shadow(0 0 20px #4a7dff); animation-delay: .2s; }
/* Noa */
.curtain { top: -2%; bottom: -2%; width: 16vw; background: url(/assets/fx/noa/curtain.webp) center / 100% 100% no-repeat; animation: curtainin .7s cubic-bezier(.2, .8, .2, 1) both; }
.curtain.l { left: 0; } .curtain.r { right: 0; transform: scaleX(-1); animation-name: curtainr; }
@keyframes curtainin { from { translate: -100% 0 } }
@keyframes curtainr { from { translate: 100% 0 } }
.phand { left: 40%; top: -3%; height: 26vh; aspect-ratio: 251 / 368; background-image: url(/assets/fx/noa/hand.webp); filter: drop-shadow(0 0 14px #b06bff); animation: artin .6s .2s both, puppeteer 1.2s ease-in-out .8s infinite alternate; }
@keyframes puppeteer { to { transform: translateY(6%) rotate(4deg) } }
.spool { right: 20%; bottom: 3%; height: 14vh; aspect-ratio: 133 / 150; background-image: url(/assets/fx/noa/spool.webp); animation-delay: .35s; }
/* Shin */
.mistcloud { left: 4%; bottom: -4%; height: 30vh; aspect-ratio: 304 / 277; background-image: url(/assets/fx/shin/mist.webp); opacity: .7; }
.shinhand { right: 6%; top: 2%; height: 22vh; aspect-ratio: 479 / 355; background-image: url(/assets/fx/shin/hand.webp); filter: drop-shadow(0 0 16px #e8e4ff); animation-delay: .2s; }
.wisps { right: 24%; bottom: 2%; height: 20vh; aspect-ratio: 290 / 237; background-image: url(/assets/fx/shin/wisps.webp); opacity: .85; animation-delay: .35s; }
/* Akane */
.bigeye { left: 50%; top: 2%; height: 22vh; aspect-ratio: 800 / 244; translate: -50% 0; background: url(/assets/fx/akane/eye.webp) left center / 46% auto no-repeat, url(/assets/fx/akane/eye.webp) right center / 46% auto no-repeat; filter: drop-shadow(0 0 30px #ff3b5c); animation: eyein .8s ease-out both; }
@keyframes eyein { from { opacity: 0; transform: scaleY(0) } 60% { transform: scaleY(1.1) } }
.cring { right: 8%; bottom: 3%; height: 18vh; aspect-ratio: 234 / 172; background-image: url(/assets/fx/akane/ring.webp); filter: drop-shadow(0 0 14px #ff3b5c); animation-delay: .3s; }
.band {
  position: absolute; left: -10%; right: -10%; top: 26%; height: 48%; overflow: hidden; transform: skewY(-5deg); animation: slide 2.4s cubic-bezier(.2, .8, .2, 1) forwards;
  background: linear-gradient(100deg, color-mix(in srgb, var(--c) 55%, #000), #000 75%);
}
.band img { position: absolute; left: 8%; top: -40%; width: 60%; height: 180%; object-fit: cover; filter: invert(1); mix-blend-mode: screen; opacity: .9; transform: skewY(5deg); }
.band img.alter { scale: -1 1; filter: grayscale(1) invert(1) contrast(1.1) !important; } /* an Alter: the negative */
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

/* ---- Mio: a wall of pink-orange flames rising from the bottom ---- */
.flame {
  bottom: -4vh; width: var(--w); height: var(--h); translate: -50% 0; transform-origin: 50% 100%;
  border-radius: 50% 50% 45% 45% / 70% 70% 30% 30%;
  background: radial-gradient(ellipse at 50% 85%, #fff3c4 0 12%, #ffb020 28%, #ff3d7a 58%, transparent 72%);
  filter: blur(2px); mix-blend-mode: screen; animation: lick .5s ease-in-out var(--d) infinite alternate, risein .5s ease-out var(--d) both;
}
@keyframes lick { from { transform: scale(1, .85) skewX(-4deg) } to { transform: scale(.9, 1.1) skewX(4deg) } }
@keyframes risein { from { opacity: 0; height: 0 } }
.heat { inset: auto 0 0 0; height: 45%; background: linear-gradient(to top, rgba(255, 61, 122, .45), transparent); animation: risein .6s ease-out both; }

/* ---- Haru: vines curling in from the corners, petals drifting across ---- */
.vines { position: absolute; inset: 0; width: 100%; height: 100%; }
.vines path { fill: none; stroke: #2fbf6a; stroke-width: .7; stroke-linecap: round; filter: drop-shadow(0 0 1.5px #4dff9b); stroke-dasharray: 200; stroke-dashoffset: 200; animation: grow 1.4s ease-out .1s forwards; }
.vines path:nth-child(n + 3) { stroke-width: .45; animation-delay: .5s; }
@keyframes grow { to { stroke-dashoffset: 0 } }
.petal { top: -6vh; width: 14px; height: 10px; border-radius: 60% 10% 60% 10%; background: linear-gradient(135deg, #fff, #ffd1e8); box-shadow: 0 0 6px rgba(255, 209, 232, .7); animation: drift 2.2s linear var(--d) both; }
.petal:nth-child(4n) { background: linear-gradient(135deg, #c8ffdc, #2fbf6a); }
@keyframes drift { from { transform: translate(0, 0) rotate(0) scale(var(--s)) } to { transform: translate(var(--dx), 115vh) rotate(var(--r)) scale(var(--s)) } }

/* ---- Kaito: a golden crown rising behind the name, rays and lightning ---- */
.rays { inset: -50%; background: repeating-conic-gradient(from 0deg, rgba(255, 207, 74, .16) 0 6deg, transparent 6deg 18deg); animation: spin 6s linear infinite, risein .6s both; -webkit-mask: radial-gradient(circle, #000 20%, transparent 60%); mask: radial-gradient(circle, #000 20%, transparent 60%); }
.rays.white { background: repeating-conic-gradient(from 0deg, rgba(244, 242, 251, .12) 0 5deg, transparent 5deg 15deg); }
@keyframes spin { to { rotate: 360deg } }
.crown { position: absolute; left: 50%; top: 1%; height: 23vh; width: auto; translate: -50% 0; opacity: .9; filter: drop-shadow(0 0 30px #ffb020); animation: crownup 1.2s cubic-bezier(.2, 1.4, .4, 1) .2s both; }
.crown path, .crown circle { fill: none; stroke: #ffcf4a; stroke-width: 2.5; stroke-linejoin: round; }
.crown circle { fill: #ffcf4a; }
@keyframes crownup { from { opacity: 0; transform: translateY(40px) scale(.7) } }
.bolt { width: 6px; height: 60vh; top: -5vh; background: linear-gradient(#fff6c8, #ffb020); clip-path: polygon(40% 0, 100% 0, 55% 40%, 90% 40%, 20% 100%, 45% 52%, 0 52%); filter: drop-shadow(0 0 12px #ffb020); opacity: 0; animation: strike .5s ease-out both; }
.bolt.b1 { left: 22%; width: 7vw; animation-delay: .35s; } .bolt.b2 { left: 70%; width: 5vw; animation-delay: .8s; }
@keyframes strike { 0% { opacity: 0 } 15% { opacity: 1 } 30% { opacity: .3 } 45% { opacity: 1 } 100% { opacity: 0 } }

/* ---- Jun: dice tumbling across, cards flung everywhere ---- */
.die {
  left: -10vw; width: 9vh; height: 9vh; border-radius: 14%; background: linear-gradient(135deg, #fff, #d8d8e4); box-shadow: 0 10px 30px rgba(0, 0, 0, .5), inset 0 0 0 2px #fff;
  animation: tumble 1.6s cubic-bezier(.3, .6, .4, 1) var(--d) both;
}
.die i { width: 18%; height: 18%; border-radius: 50%; background: #111; }
.die i:nth-child(1) { left: 16%; top: 16%; } .die i:nth-child(2) { right: 16%; top: 16%; } .die i:nth-child(3) { left: 41%; top: 41%; }
.die i:nth-child(4) { left: 16%; bottom: 16%; } .die i:nth-child(5) { right: 16%; bottom: 16%; }
@keyframes tumble { from { transform: translate(0, 0) rotate(0) scale(var(--s)) } to { transform: translate(125vw, var(--y)) rotate(var(--r)) scale(var(--s)) } }
.card { width: 5vh; height: 7.4vh; border-radius: 6px; background: linear-gradient(135deg, #fff, #ececf6); border: 2px solid #fff; box-shadow: inset 0 0 0 4px #8a8aa0, 0 6px 16px rgba(0, 0, 0, .5); animation: fling 1.4s cubic-bezier(.2, .7, .4, 1) var(--d) both; }
.card:nth-child(2n) { box-shadow: inset 0 0 0 4px #c4141c, 0 6px 16px rgba(0, 0, 0, .5); }
@keyframes fling { from { opacity: 0; transform: translate(0, 0) rotate(0) scale(.3) } 15% { opacity: 1 } to { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(1) } }

/* ---- Yuki: frost creeping in from the edges, snow falling ---- */
.frost { inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(143, 240, 255, .25) 70%, rgba(230, 250, 255, .55)); animation: risein 1s ease-out both; }
.flake {
  top: -4vh; width: 14px; height: 14px; opacity: .9;
  background:
    linear-gradient(90deg, transparent 45%, #fff 45% 55%, transparent 55%),
    linear-gradient(30deg, transparent 47%, #fff 47% 53%, transparent 53%),
    linear-gradient(150deg, transparent 47%, #fff 47% 53%, transparent 53%);
  filter: drop-shadow(0 0 4px #8ff0ff); animation: snow var(--t) linear var(--d) both;
}
@keyframes snow { from { transform: translate(0, 0) rotate(0) scale(var(--s)) } to { transform: translate(var(--dx), 110vh) rotate(240deg) scale(var(--s)) } }

/* ---- Ren: a giant clock behind everything, hands spinning ---- */
/* painted art: public/assets/fx/ren/ (clock face, hands, gears, pocket watch) */
.clock {
  position: absolute; left: 50%; top: 50%; width: min(92vh, 82vw); aspect-ratio: 1; translate: -50% -50%;
  background: url(/assets/fx/ren/clock.webp) center / contain no-repeat; filter: drop-shadow(0 0 40px rgba(255, 74, 61, .45));
  animation: clockin .8s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes clockin { from { opacity: 0; transform: scale(1.4) rotate(-30deg) } }
.hand { left: 50%; top: 50%; background: center / contain no-repeat; filter: drop-shadow(0 0 10px #ff4a3d); }
.hand.hr { height: 30%; aspect-ratio: 63 / 270; translate: -50% -89%; transform-origin: 50% 89%; background-image: url(/assets/fx/ren/hand-hour.webp); animation: whirl 2.4s cubic-bezier(.3, 0, .2, 1) both; }
.hand.mn { height: 44%; aspect-ratio: 58 / 357; translate: -50% -83%; transform-origin: 50% 83%; background-image: url(/assets/fx/ren/hand-minute.webp); animation: whirl .6s linear infinite; }
@keyframes whirl { from { rotate: 0deg } to { rotate: 720deg } }
/* gears turning in the corners, behind the clock */
.gear { width: min(46vh, 34vw); aspect-ratio: 328 / 264; background: url(/assets/fx/ren/gears.webp) center / contain no-repeat; opacity: .55; animation: gearturn 6s linear infinite; }
.gear.g1 { left: -6%; bottom: -10%; }
.gear.g2 { right: -6%; top: -12%; animation-direction: reverse; }
@keyframes gearturn { to { rotate: 360deg } }
/* the pocket watch, swinging on its chain from the top edge */
.watch {
  right: 12%; top: -4%; height: min(42vh, 34vw); aspect-ratio: 270 / 272; z-index: 1;
  background: url(/assets/fx/ren/watch.webp) center / contain no-repeat; transform-origin: 82% 0%;
  filter: drop-shadow(0 0 16px rgba(255, 74, 61, .5)); animation: watchswing 1.6s ease-in-out infinite alternate, watchin .6s cubic-bezier(.3, 1.4, .5, 1) both;
}
@keyframes watchswing { from { rotate: -10deg } to { rotate: 10deg } }
@keyframes watchin { from { opacity: 0; translate: 0 -40% } }

/* ---- Sena: cracks race across the screen, then it shatters ---- */
.crack { left: 50%; top: 50%; width: var(--l); height: 2px; transform-origin: 0 50%; rotate: var(--a); background: linear-gradient(90deg, #fff, #9fb8ff 40%, transparent); filter: drop-shadow(0 0 6px #4a7dff); clip-path: inset(0 100% 0 0); animation: crackout .4s ease-out var(--d) forwards; }
@keyframes crackout { to { clip-path: inset(0 0 0 0) } }
.shard { left: 50%; top: 50%; width: 22px; height: 26px; background: linear-gradient(135deg, rgba(255, 255, 255, .9), rgba(159, 184, 255, .7) 50%, rgba(74, 125, 255, .6)); clip-path: polygon(50% 0, 100% 75%, 15% 100%); filter: drop-shadow(0 0 6px #4a7dff); opacity: 0; animation: burst 1.2s cubic-bezier(.2, .7, .4, 1) var(--d) both; }
@keyframes burst { from { opacity: 1; transform: translate(-50%, -50%) scale(var(--s)) } to { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)) scale(var(--s)) } }

/* ---- Noa: violet strings dropping from above, swaying, each with a little weight ---- */
.string { top: 0; width: 1.5px; height: var(--h); background: linear-gradient(to bottom, transparent, #b06bff 30%, #e6d2ff); box-shadow: 0 0 8px #b06bff; transform-origin: 50% 0; animation: dropdown .7s cubic-bezier(.2, .8, .2, 1) var(--d) both, swing var(--sw) ease-in-out var(--d) infinite alternate; }
.string b { position: absolute; left: 50%; bottom: -5px; width: 9px; height: 9px; translate: -50% 0; border-radius: 50%; background: #e6d2ff; box-shadow: 0 0 10px #b06bff; }
@keyframes dropdown { from { clip-path: inset(0 0 100% 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes swing { from { rotate: -4deg } to { rotate: 4deg } }

/* ---- Kyo: rows of iron chain whip across the screen in blood-red light ---- */
.redglow { inset: 0; background: radial-gradient(ellipse at center, rgba(209, 0, 44, .3), transparent 70%); animation: risein .5s both; }
.chainrow {
  left: -10%; right: -10%; height: 6.5vh;
  background: url(/assets/fx/kyo/chain.webp) 0 50% / auto 100% repeat-x; /* the painted chain (public/assets/fx/kyo) */
  filter: drop-shadow(0 0 8px #d1002c) drop-shadow(0 4px 6px rgba(0, 0, 0, .8)); opacity: .9; transform: skewY(-5deg);
  animation: whip .7s cubic-bezier(.2, .8, .2, 1) var(--d) both, rattle .12s steps(2) calc(var(--d) + .7s) 6;
}
@keyframes whip { from { translate: calc(var(--dir) * 110%) 0 } }
/* once taut, the chains rattle against each other */
@keyframes rattle { 50% { translate: calc(var(--dir) * 4px) 1px } }
/* padlocks slam shut above and below the band, with the snap's sparks */
.biglock {
  width: min(21vh, 16vw); aspect-ratio: 255 / 355; translate: -50% -50%; z-index: 1; /* above and below the band, clear of the art */
  background: url(/assets/fx/kyo/lock.webp) center / contain no-repeat;
  filter: drop-shadow(0 0 30px #d1002c) drop-shadow(0 10px 20px rgba(0, 0, 0, .8));
  animation: biglock .55s cubic-bezier(.3, 1.6, .5, 1) calc(.75s + var(--t)) both;
}
.biglock b {
  position: absolute; inset: -12% -22% -8% -8%; opacity: 0;
  background: url(/assets/fx/kyo/lock-snap.webp) center / contain no-repeat;
  animation: locksnap .45s ease-out calc(1s + var(--t));
}
@keyframes biglock { from { opacity: 0; transform: scale(2.4) rotate(-14deg) } 70% { transform: scale(.94) } }
@keyframes locksnap { 0% { opacity: 1; transform: scale(1.2) } 100% { opacity: 0; transform: scale(1) } }

/* ---- Shion: green fog, venom dripping from the top, bubbles rising ---- */
.fog { inset: 0; background: radial-gradient(ellipse at 50% 100%, rgba(198, 255, 61, .35), rgba(79, 122, 0, .15) 45%, transparent 75%); animation: risein .8s both; }
.drip { top: 0; width: 1.2vw; height: var(--h); border-radius: 0 0 50% 50%; background: linear-gradient(to bottom, #4f7a00, #c6ff3d); box-shadow: 0 0 10px #c6ff3d; transform-origin: top; animation: dripdown 1.2s ease-in var(--d) both; }
@keyframes dripdown { from { transform: scaleY(0) } }
.bubble { bottom: -4vh; width: 2.4vh; height: 2.4vh; border-radius: 50%; background: radial-gradient(circle at 35% 35%, rgba(240, 255, 200, .95), rgba(198, 255, 61, .5) 50%, transparent 70%); border: 1px solid rgba(198, 255, 61, .7); animation: bubblerise var(--t) ease-in var(--d) both; }
@keyframes bubblerise { from { transform: translate(0, 0) scale(var(--s)); opacity: 0 } 15% { opacity: 1 } to { transform: translate(var(--dx), -110vh) scale(var(--s)); opacity: 0 } }

@media (prefers-reduced-motion: reduce) { .motif { display: none; } }
</style>

/* Game audio.
   - Sound effects are synthesised with the Web Audio API (no files, no licences).
     Each character's moves, captures and ultimates have their own flavour.
   - Music is optional: put tracks at public/assets/music/<name>.mp3 (home, mio, haru, kaito, jun, yuki, ren, sena, noa, shion, kyo).
     A missing track simply stays silent.
   Browsers only allow audio after the player has interacted with the page, so the audio
   context is created/resumed on the first pointer or key press. */

const KEY = 'bizarre-chess:muted'
let ctx = null
let master = null
let muted = false
try { muted = localStorage.getItem(KEY) === '1' } catch { /* storage unavailable: default to sound on */ }

const listeners = new Set()
export const isMuted = () => muted
export function onMuteChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function setMuted(m) {
  muted = m
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05)
  music.applyMute()
  listeners.forEach(fn => fn(m))
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.55
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
/* ---------- recorded samples ----------
   Real recordings for a few moves, loaded once the audio is unlocked. Each sample is a file of several takes
   (start, end in seconds); a random take plays each time, so it never repeats exactly. Until a file has loaded
   (or if it can't be), the synthesized sound is used instead. */
const SAMPLES = {
  // Kyo's movement: iron chain rattles (freesound community, "chain"), the 12 strongest takes
  // Kyo's capture: chains wrap the piece and lock tight (kuzu420, "chain locker"), its three lock-ups
  lock: { url: '/assets/sfx/kyo-lock.mp3', vol: 1, takes: [[0.64, 1.9], [3.38, 4.3], [4.5, 5.86]] },
  chain: { url: '/assets/sfx/kyo-chain.mp3', vol: 0.95, takes: [[0.1, 0.78], [1.64, 2.14], [2.68, 3.1], [3.6, 4.24], [4.86, 5.24], [7.12, 7.94], [8.8, 9.18], [9.82, 10.12], [13.46, 13.92], [14.6, 15.22], [15.78, 16.36], [18.24, 18.62]] },
}
const buffers = {}
function loadSamples() {
  const c = ac()
  if (!c) return
  for (const [name, s] of Object.entries(SAMPLES)) {
    if (buffers[name] !== undefined) continue
    buffers[name] = null // loading
    fetch(s.url).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(buf => { buffers[name] = buf }).catch(() => { buffers[name] = false })
  }
}
/** Play a random take of a loaded sample; false if it isn't ready (so the caller can synthesize instead). */
function playSample(name, delay = 0) {
  const buf = buffers[name], s = SAMPLES[name], c = ctx
  if (!buf || !c || !master) return false
  const [a, b] = s.takes[Math.floor(Math.random() * s.takes.length)]
  const src = c.createBufferSource(), g = c.createGain(), t = c.currentTime + delay, len = b - a
  src.buffer = buf
  g.gain.setValueAtTime(s.vol, t)
  g.gain.setValueAtTime(s.vol, t + Math.max(0, len - 0.08))
  g.gain.linearRampToValueAtTime(0, t + len) // fade the tail so takes never click
  src.connect(g); g.connect(master)
  src.start(t, a, len)
  return true
}

// unlock audio on the first interaction
if (typeof window !== 'undefined') {
  const unlock = () => { ac(); loadSamples(); music.resume() }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

/* ---------- building blocks ---------- */
function tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.25, attack = 0.005, slideTo, delay = 0, cutoff } = {}) {
  const c = ac(); if (!c || muted) return
  const t = c.currentTime + delay
  const osc = c.createOscillator(), g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let out = g
  if (cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; g.connect(f); out = f }
  osc.connect(g); out.connect(master)
  osc.start(t); osc.stop(t + dur + 0.05)
}

let noiseBuf = null
function noise({ dur = 0.2, vol = 0.2, freq = 1200, q = 1, kind = 'bandpass', sweepTo, delay = 0, attack = 0.003 } = {}) {
  const c = ac(); if (!c || muted) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = c.currentTime + delay
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  src.buffer = noiseBuf; src.loop = true
  f.type = kind; f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f); f.connect(g); g.connect(master)
  src.start(t); src.stop(t + dur + 0.05)
}
const chord = (freqs, opts = {}) => freqs.forEach((f, i) => tone({ ...opts, freq: f, delay: (opts.delay ?? 0) + i * (opts.stagger ?? 0) }))

/* ---------- moves ---------- */
const MOVES = {
  // a soft wooden click
  default: () => { noise({ dur: 0.05, vol: 0.22, freq: 1800, q: 2 }); tone({ freq: 180, dur: 0.09, vol: 0.12 }) },
  // Mio: an airy float with a little chime
  skip: () => { noise({ dur: 0.35, vol: 0.08, freq: 700, sweepTo: 2600, q: 0.7 }); tone({ freq: 988, dur: 0.35, vol: 0.06, delay: 0.25 }) },
  // Kaito: a fast whoosh and a heavy landing
  charge: () => { noise({ dur: 0.22, vol: 0.16, freq: 400, sweepTo: 3000, q: 0.8 }); tone({ freq: 90, slideTo: 45, dur: 0.22, vol: 0.32, delay: 0.24 }); noise({ dur: 0.12, vol: 0.18, freq: 300, delay: 0.24 }) },
  // Noa: a plucked string as the piece is lifted, another as it lands
  puppet: () => { tone({ freq: 392, type: 'triangle', dur: 0.4, vol: 0.14 }); tone({ freq: 294, type: 'triangle', dur: 0.5, vol: 0.12, delay: 0.5 }) },
  // Ren: tick, tock
  // Haru: a soft rustle of leaves and a gentle chime as it grows
  grow: () => { noise({ dur: 0.4, vol: 0.09, freq: 2200, sweepTo: 1200, q: 0.6 }); chord([523, 784], { dur: 0.5, vol: 0.05, stagger: 0.08, type: 'sine', delay: 0.3 }) },
  // Sena: a cold glassy slide and a crisp ting
  glide: () => { noise({ dur: 0.3, vol: 0.07, freq: 5000, sweepTo: 7000, q: 2 }); tone({ freq: 2637, dur: 0.6, vol: 0.05, delay: 0.28 }) },
  // Jun: a coin flip, then a clatter of chips
  flip: () => { tone({ freq: 1400, slideTo: 2200, dur: 0.25, vol: 0.05, type: 'triangle' }); for (let i = 0; i < 4; i++) noise({ dur: 0.02, vol: 0.18, freq: 3200 - i * 300, q: 5, delay: 0.42 + i * 0.05 }) },
  // Shion: a wet, bubbling slither
  ooze: () => { noise({ dur: 0.5, vol: 0.1, freq: 500, sweepTo: 900, q: 1.2, kind: 'lowpass' }); for (let i = 0; i < 4; i++) tone({ freq: 300 + Math.random() * 300, dur: 0.06, vol: 0.05, type: 'sine', delay: 0.15 + i * 0.11 }) },
  // Kyo: a recorded chain rattle (synthesized until it has loaded), then a heavy iron thud as the piece slams down
  drag: () => {
    if (!playSample('chain')) for (let i = 0; i < 6; i++) noise({ dur: 0.03, vol: 0.16, freq: 2400 + Math.random() * 1200, q: 4, delay: i * 0.06 })
    tone({ freq: 60, slideTo: 35, dur: 0.35, vol: 0.4, delay: 0.42 }); noise({ dur: 0.18, vol: 0.2, freq: 260, delay: 0.42 })
  },
  // Shin & Akane: a soft breath of mist, then a low shimmer as the piece re-forms
  mist: () => { noise({ dur: 0.7, vol: 0.07, freq: 900, sweepTo: 400, q: 0.4, kind: 'lowpass', attack: 0.15 }); chord([622, 932], { dur: 0.6, vol: 0.035, stagger: 0.1, type: 'sine', delay: 0.45 }) },
  // Akane: a soft, high glint
  blink: () => { tone({ freq: 1760, slideTo: 2640, dur: 0.12, vol: 0.05, type: 'sine' }); tone({ freq: 2640, dur: 0.25, vol: 0.04, type: 'sine', delay: 0.25 }) },
  // Yuki: a hush of snow and a tiny chime
  snow: () => { noise({ dur: 0.6, vol: 0.05, freq: 6000, q: 0.5, attack: 0.15 }); chord([2093, 2637], { dur: 0.4, vol: 0.03, stagger: 0.07, type: 'sine', delay: 0.5 }) },
  // Rai: a sharp electric crack
  bolt: () => { noise({ dur: 0.12, vol: 0.2, freq: 5000, q: 1.5 }); tone({ freq: 1800, slideTo: 300, dur: 0.18, vol: 0.06, type: 'sawtooth' }); noise({ dur: 0.08, vol: 0.12, freq: 2500, q: 3, delay: 0.2 }) },
  // Erika: a soft patter and a drip as it lands
  rain: () => { noise({ dur: 0.5, vol: 0.06, freq: 4000, q: 0.6, attack: 0.1 }); tone({ freq: 1400, slideTo: 700, dur: 0.12, vol: 0.06, type: 'sine', delay: 0.35 }) },
  // Melati: a plucked gold thread and a light chime
  weave: () => { tone({ freq: 660, type: 'triangle', dur: 0.4, vol: 0.08 }); chord([988, 1319], { dur: 0.5, vol: 0.035, stagger: 0.08, type: 'sine', delay: 0.35 }) },
  // AI-0: digital blips
  glitch: () => { for (let i = 0; i < 4; i++) tone({ freq: 400 + Math.random() * 1600, dur: 0.04, vol: 0.06, type: 'square', delay: i * 0.05 }); tone({ freq: 1760, dur: 0.08, vol: 0.05, type: 'square', delay: 0.3 }) },
  time: () => { noise({ dur: 0.025, vol: 0.25, freq: 4200, q: 6 }); noise({ dur: 0.025, vol: 0.22, freq: 2600, q: 6, delay: 0.18 }); tone({ freq: 660, dur: 0.5, vol: 0.05, delay: 0.3 }) },
}
export const move = style => (MOVES[style] ?? MOVES.default)()

/* ---------- landing marks ---------- */
export function trail(kind) {
  if (kind === 'ice') chord([1319, 1760, 2093], { dur: 0.6, vol: 0.05, stagger: 0.04 }) // glassy frost chime
  if (kind === 'bloom') chord([659, 880, 1047], { dur: 0.7, vol: 0.035, stagger: 0.06, type: 'sine', delay: 0.2 })
  if (kind === 'crack') { tone({ freq: 70, slideTo: 40, dur: 0.3, vol: 0.3 }); noise({ dur: 0.25, vol: 0.15, freq: 500, q: 0.6 }) }
}

/* ---------- captures ---------- */
const CAPTURES = {
  capture: () => { noise({ dur: 0.18, vol: 0.32, freq: 700, q: 0.8 }); tone({ freq: 130, slideTo: 60, dur: 0.22, vol: 0.2 }) },
  burn: () => { noise({ dur: 0.9, vol: 0.18, freq: 500, sweepTo: 1800, q: 0.5 }); noise({ dur: 0.6, vol: 0.1, freq: 3000, q: 3, delay: 0.1 }) },
  freeze: () => { chord([2093, 2637, 3136], { dur: 0.3, vol: 0.05, stagger: 0.03 }); noise({ dur: 0.25, vol: 0.25, freq: 5000, q: 1.2, delay: 0.75 }) },
  yank: () => { tone({ freq: 220, type: 'triangle', dur: 0.2, vol: 0.18 }); noise({ dur: 0.35, vol: 0.12, freq: 800, sweepTo: 4000, delay: 0.15 }) },
  sand: () => { noise({ dur: 1.2, vol: 0.12, freq: 2500, sweepTo: 600, q: 0.4, kind: 'lowpass', attack: 0.2 }) },
  knockout: () => { tone({ freq: 80, slideTo: 40, dur: 0.18, vol: 0.4 }); noise({ dur: 0.1, vol: 0.3, freq: 900 }); tone({ freq: 1320, dur: 0.5, vol: 0.07, delay: 0.06 }) },
  // Kyo: a recorded chain lock-up as the chains wrap the piece (synthesized crush until it has loaded)
  crush: () => { if (!playSample('lock', 0.3)) CAPTURES.crushSynth() },
  crushSynth: () => { for (let i = 0; i < 4; i++) noise({ dur: 0.03, vol: 0.14, freq: 2600, q: 4, delay: i * 0.05 }); tone({ freq: 90, slideTo: 40, dur: 0.3, vol: 0.35, delay: 0.25 }); noise({ dur: 0.2, vol: 0.25, freq: 1500, q: 0.8, delay: 0.3 }) },
  dissolve: () => { noise({ dur: 0.9, vol: 0.12, freq: 1200, sweepTo: 300, q: 0.6 }); for (let i = 0; i < 5; i++) tone({ freq: 400 + Math.random() * 500, dur: 0.08, vol: 0.04, type: 'sine', delay: 0.1 + i * 0.12 }) },
  wilt: () => { tone({ freq: 440, slideTo: 220, dur: 0.9, vol: 0.06, type: 'sine' }); noise({ dur: 0.8, vol: 0.06, freq: 1500, sweepTo: 600, q: 0.5, delay: 0.2 }) },
  shatter: () => { noise({ dur: 0.04, vol: 0.3, freq: 6000, q: 1 }); chord([2349, 3136, 3520], { dur: 0.4, vol: 0.05, stagger: 0.02, delay: 0.03 }); noise({ dur: 0.35, vol: 0.18, freq: 4500, q: 1, delay: 0.06 }) },
  cardflip: () => { noise({ dur: 0.06, vol: 0.2, freq: 2500, q: 1.5 }); noise({ dur: 0.05, vol: 0.15, freq: 1800, q: 1.5, delay: 0.12 }); tone({ freq: 330, slideTo: 165, dur: 0.4, vol: 0.06, type: 'triangle', delay: 0.15 }) },
  // Shin & Akane: the captured piece fades into mist with a falling sigh
  vanish: () => { noise({ dur: 1.1, vol: 0.1, freq: 1600, sweepTo: 250, q: 0.5, kind: 'lowpass', attack: 0.1 }); tone({ freq: 466, slideTo: 233, dur: 0.9, vol: 0.04, type: 'sine', delay: 0.1 }) },
  poof: () => { noise({ dur: 0.3, vol: 0.18, freq: 900, sweepTo: 300, q: 0.6 }); chord([1568, 2093], { dur: 0.4, vol: 0.04, stagger: 0.06, delay: 0.1 }) },
}
export const capture = kind => (CAPTURES[kind] ?? CAPTURES.capture)()

/* ---------- moments ---------- */
// a heartbeat when a king is in check
/** You lost a piece (tier 1 pawn … 4 queen): a thud that gets heavier, then for a queen a falling minor chord over a heartbeat. */
export function loss(tier = 1) {
  tone({ freq: 120 - tier * 15, slideTo: 45, dur: 0.25 + tier * 0.08, vol: 0.22 + tier * 0.06 })
  if (tier >= 2) noise({ dur: 0.2 + tier * 0.05, vol: 0.12 + tier * 0.03, freq: 240, q: 0.7, kind: 'lowpass' })
  if (tier >= 3) tone({ freq: 55, dur: 0.9, vol: 0.18, type: 'sine', delay: 0.08 }) // a low drone under it
  if (tier >= 4) {
    chord([392, 311, 262, 196], { dur: 1.1, vol: 0.05, stagger: 0.16, type: 'triangle', delay: 0.25 }) // G Eb C G: falling
    tone({ freq: 62, dur: 0.16, vol: 0.42, delay: 0.9 }); tone({ freq: 58, dur: 0.2, vol: 0.34, delay: 1.12 }) // heartbeat
  }
}
export function check() { tone({ freq: 62, dur: 0.16, vol: 0.4 }); tone({ freq: 58, dur: 0.2, vol: 0.32, delay: 0.22 }) }
export function ready() { chord([660, 990], { dur: 0.5, vol: 0.07, stagger: 0.08 }) } // an ultimate meter just filled
export function ui() { noise({ dur: 0.03, vol: 0.12, freq: 2400, q: 3 }) }

// each ultimate's opening sting, by who fired it
const STINGS = {
  mio: () => { chord([523, 659, 784, 1047], { dur: 0.9, vol: 0.07, stagger: 0.07, type: 'triangle' }); noise({ dur: 1, vol: 0.1, freq: 600, sweepTo: 2500, q: 0.5 }) },
  kaito: () => { chord([110, 165, 220], { dur: 1, vol: 0.12, type: 'sawtooth', cutoff: 900 }); tone({ freq: 55, slideTo: 40, dur: 0.6, vol: 0.4 }) },
  yuki: () => chord([1047, 1319, 1568, 2093, 2637], { dur: 1.6, vol: 0.045, stagger: 0.09 }),
  ren: () => { for (let i = 0; i < 6; i++) noise({ dur: 0.02, vol: 0.2, freq: 3600, q: 6, delay: i * (0.22 - i * 0.025) }); tone({ freq: 98, dur: 2, vol: 0.25, delay: 0.85, type: 'triangle' }) },
  noa: () => chord([311, 330, 466, 494], { dur: 1.4, vol: 0.07, stagger: 0.12, type: 'triangle' }),
  haru: () => { chord([392, 494, 587, 784, 988], { dur: 1.3, vol: 0.06, stagger: 0.1, type: 'sine' }); noise({ dur: 0.9, vol: 0.06, freq: 1800, sweepTo: 4000, q: 0.6 }) },
  sena: () => { chord([1568, 1661, 2349], { dur: 1, vol: 0.05, stagger: 0.03 }); tone({ freq: 82, slideTo: 62, dur: 1.2, vol: 0.3, type: 'triangle', delay: 0.3 }) },
  shion: () => { for (let i = 0; i < 6; i++) tone({ freq: 300 + i * 90, slideTo: 500 + i * 120, dur: 0.18, vol: 0.05, type: 'sine', delay: i * 0.12 }); noise({ dur: 0.9, vol: 0.07, freq: 900, sweepTo: 300, q: 0.7, delay: 0.3 }) },
  kyo: () => { tone({ freq: 55, slideTo: 41, dur: 1.6, vol: 0.4, type: 'sawtooth', cutoff: 400 }); for (let i = 0; i < 5; i++) noise({ dur: 0.08, vol: 0.22, freq: 2600, q: 3, delay: 0.3 + i * 0.11 }); tone({ freq: 82, dur: 1.2, vol: 0.2, type: 'triangle', delay: 0.9 }) },
  jun: () => { for (let i = 0; i < 7; i++) noise({ dur: 0.03, vol: 0.18, freq: 2200 + i * 150, q: 4, delay: i * 0.09 }); chord([659, 880, 1319], { dur: 0.7, vol: 0.07, stagger: 0.05, type: 'triangle', delay: 0.75 }) },
  you: () => { chord([392, 587, 784], { dur: 1.2, vol: 0.08, stagger: 0.1, type: 'triangle' }); tone({ freq: 98, dur: 1, vol: 0.2 }) },
}
export const ultimate = id => (STINGS[id] ?? STINGS.you)()

export function win() { chord([523, 659, 784, 1047, 1319], { dur: 0.9, vol: 0.08, stagger: 0.12, type: 'triangle' }) }
export function lose() { chord([440, 349, 294, 220], { dur: 1.1, vol: 0.08, stagger: 0.18, type: 'triangle' }) }
export function draw() { chord([392, 440], { dur: 1, vol: 0.06, stagger: 0.2, type: 'triangle' }) }

/* ---------- character voices ----------
   When a character speaks, a real clip plays if you've added one at
   public/assets/voice/<character>/<moment>.mp3 (moments: start, capture, lost, check, inCheck, think,
   win, lose, draw, ult, greet). Otherwise they "talk" in synthesised babble: short vowel-like syllables
   in a voice of their own, timed to the length of the line. */
const VOICES = {
  //           pitch  wave        gap(ms) wobble  loud  breath
  mio:   { base: 540, type: 'triangle', gap: 58, vary: 0.22, vol: 0.075, breath: 0 },   // high, bubbly, quick
  kaito: { base: 250, type: 'sawtooth', gap: 46, vary: 0.28, vol: 0.06, breath: 0 },    // punchy and fast
  yuki:  { base: 430, type: 'sine', gap: 88, vary: 0.1, vol: 0.06, breath: 0.25 },      // soft and gentle
  ren:   { base: 165, type: 'triangle', gap: 76, vary: 0.06, vol: 0.08, breath: 0 },    // low and flat
  noa:   { base: 290, type: 'sine', gap: 98, vary: 0.16, vol: 0.055, breath: 0.45 },   // slow, hushed, breathy
  haru:  { base: 330, type: 'sine', gap: 84, vary: 0.14, vol: 0.06, breath: 0.2 },      // soft, a little shy
  sena:  { base: 400, type: 'triangle', gap: 80, vary: 0.05, vol: 0.065, breath: 0.1 }, // crisp and haughty
  shion: { base: 470, type: 'sine', gap: 70, vary: 0.26, vol: 0.06, breath: 0.15 },     // sing-song, teasing
  kyo:   { base: 120, type: 'triangle', gap: 104, vary: 0.04, vol: 0.09, breath: 0 },  // very low, slow, flat
  jun:   { base: 210, type: 'triangle', gap: 52, vary: 0.3, vol: 0.07, breath: 0 },     // quick, sly, swinging
}
const FORMANTS = [800, 1150, 1500, 2300, 2700] // rough a / o / e / i / u colours

/** Babble into any audio context/destination (the game uses the live one; tests can render offline). */
export function renderBabble(c, dest, id, text) {
  const v = VOICES[id] ?? VOICES.mio
  const letters = text.replace(/[^A-Za-z]/g, '').length
  const syllables = Math.max(2, Math.min(16, Math.round(letters / 3)))
  const excited = /!/.test(text), asking = /\?/.test(text)
  const peak = v.vol * 3.2
  let t = c.currentTime + 0.02
  for (let i = 0; i < syllables; i++) {
    const last = i === syllables - 1
    // questions rise at the end, exclamations sit higher overall
    const lift = (excited ? 1.12 : 1) * (asking && last ? 1.25 : 1)
    const f = v.base * lift * (1 + (Math.random() * 2 - 1) * v.vary)
    const dur = (v.gap / 1000) * (0.7 + Math.random() * 0.5)
    const osc = c.createOscillator()
    osc.type = v.type
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.linearRampToValueAtTime(f * (0.94 + Math.random() * 0.1), t + dur)
    // the voice itself, softened (this is what you mostly hear)…
    const body = c.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = Math.min(4000, f * 6)
    // …plus a vowel colour mixed on top, so syllables sound like different vowels
    const vowel = c.createBiquadFilter(); vowel.type = 'bandpass'; vowel.Q.value = 2
    vowel.frequency.value = FORMANTS[Math.floor(Math.random() * FORMANTS.length)]
    const vowelGain = c.createGain(); vowelGain.gain.value = 1.6
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(body); body.connect(g)
    osc.connect(vowel); vowel.connect(vowelGain); vowelGain.connect(g)
    g.connect(dest)
    osc.start(t); osc.stop(t + dur + 0.03)
    if (v.breath) {
      // a breathy edge for the softer voices
      const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain()
      const len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0)
      for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1
      n.buffer = buf; nf.type = 'bandpass'; nf.frequency.value = 3000; nf.Q.value = 0.8
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(peak * v.breath, t + 0.015); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      n.connect(nf); nf.connect(ng); ng.connect(dest); n.start(t); n.stop(t + dur)
    }
    t += v.gap / 1000 * (0.85 + Math.random() * 0.4) + (/[,.…]/.test(text) && i === Math.floor(syllables / 2) ? 0.08 : 0)
  }
}
function babble(id, text) {
  const c = ac(); if (!c || muted) return
  renderBabble(c, master, id, text)
}

const clipState = new Map() // url -> 'ok' | 'missing'
let speaking = null
/** A character says a line: a recorded clip for that moment if there is one, otherwise babble. */
export function voice(id, moment, text) {
  if (muted || !text) return
  const url = `/assets/voice/${id}/${moment}.mp3`
  if (clipState.get(url) === 'missing' || !moment) return babble(id, text)
  speaking?.pause()
  const a = new Audio(url)
  a.volume = 0.9
  speaking = a
  // a missing clip can be reported twice (the error event and the failed play), so fall back only once
  let fellBack = false
  const fallback = () => {
    if (fellBack) return
    fellBack = true
    clipState.set(url, 'missing')
    if (speaking === a) babble(id, text)
  }
  a.addEventListener('error', fallback, { once: true })
  // NotAllowedError = audio not unlocked yet (no click/key press so far): the clip may exist, so don't mark it missing
  a.play().then(() => clipState.set(url, 'ok')).catch(e => { if (e?.name !== 'NotAllowedError') fallback() })
}

/* ---------- music ---------- */
export const music = (() => {
  let el = null, current = null, pending = null
  const VOL = 0.32
  function fadeTo(audio, target, ms, done) {
    const start = audio.volume, t0 = performance.now()
    const step = now => {
      const k = Math.min(1, (now - t0) / ms)
      audio.volume = start + (target - start) * k
      if (k < 1) requestAnimationFrame(step); else done?.()
    }
    requestAnimationFrame(step)
  }
  function play(name) {
    if (name === current) return
    current = name
    const old = el
    if (old) fadeTo(old, 0, 600, () => old.pause())
    el = null
    if (!name) return
    const a = new Audio(`/assets/music/${name}.mp3`)
    a.loop = true; a.volume = 0
    a.addEventListener('error', () => { if (el === a) el = null }) // no track for this one: stay silent
    el = a
    pending = () => { if (el !== a || muted) return; a.play().then(() => fadeTo(a, VOL, 900)).catch(() => {}) }
    pending()
  }
  return {
    play,
    resume() { pending?.() }, // after the first interaction, start whatever should be playing
    applyMute() { if (!el) return; if (muted) el.pause(); else { el.volume = 0; el.play().then(() => fadeTo(el, VOL, 600)).catch(() => {}) } },
  }
})()

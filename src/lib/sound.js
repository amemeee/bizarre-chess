/* Game audio.
   - Sound effects are synthesised with the Web Audio API (no files, no licences).
     Each character's moves, captures and ultimates have their own flavour.
   - Music is optional: put tracks at public/assets/music/<name>.mp3 (home, mio, kaito, yuki, ren, noa).
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
// unlock audio on the first interaction
if (typeof window !== 'undefined') {
  const unlock = () => { ac(); music.resume() }
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
  time: () => { noise({ dur: 0.025, vol: 0.25, freq: 4200, q: 6 }); noise({ dur: 0.025, vol: 0.22, freq: 2600, q: 6, delay: 0.18 }); tone({ freq: 660, dur: 0.5, vol: 0.05, delay: 0.3 }) },
}
export const move = style => (MOVES[style] ?? MOVES.default)()

/* ---------- landing marks ---------- */
export function trail(kind) {
  if (kind === 'ice') chord([1319, 1760, 2093], { dur: 0.6, vol: 0.05, stagger: 0.04 }) // glassy frost chime
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
  poof: () => { noise({ dur: 0.3, vol: 0.18, freq: 900, sweepTo: 300, q: 0.6 }); chord([1568, 2093], { dur: 0.4, vol: 0.04, stagger: 0.06, delay: 0.1 }) },
}
export const capture = kind => (CAPTURES[kind] ?? CAPTURES.capture)()

/* ---------- moments ---------- */
// a heartbeat when a king is in check
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

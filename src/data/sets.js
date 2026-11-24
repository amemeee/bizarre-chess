/* Each owner's piece set: its name, and how its pieces move and capture (shown on the Collection and Characters pages). */
export const SET_NAMES = {
  shin: 'Awakened', akane: 'Awakened', erika: 'Rain Glass', rai: 'Spark', spark: 'Spark', storm: 'Storm', thunder: 'Thunder God', melati: 'Songket', ai: 'Wireframe',
  you: 'Ivory Bone', bone: 'Ivory Bone', dark: 'Burnt Obsidian', awakened: 'Awakened', mio: 'Ember', haru: 'Living Wood', kaito: 'Golden Crown', jun: 'High Roller',
  yuki: 'Glacier', ren: 'Clockwork', sena: 'Shattered Glass', noa: 'Marionette', shion: 'Venom', kyo: 'Black Iron',
}
export const MOVESETS = {
  you: { move: 'Slides across the board and settles with a small bounce. Knights hop.', capture: 'The captured piece is knocked away and shatters.' },
  // your three story stages (bone is also your Free Battle set)
  bone: { move: 'Slides across the board and settles with a small bounce. Knights hop.', capture: 'The captured piece is knocked away and shatters.' },
  dark: { move: 'Slides across the board, its cracks glowing faintly. Knights hop.', capture: 'The captured piece is knocked away and shatters.' },
  awakened: { move: 'Dissolves into mist, drifts across the board and re-forms on its new square.', capture: 'The captured piece blurs and fades away into wisps of mist.' },
  shin: { move: 'Dissolves into mist, drifts across the board and re-forms on its new square.', capture: 'The captured piece blurs and fades away into wisps of mist.' },
  akane: { move: 'Dissolves into crimson mist, drifts across the board and re-forms on its new square.', capture: 'The captured piece blurs and fades away into wisps of crimson mist.' },
  rai: { move: 'Vanishes in a flash and strikes down onto its new square as a bolt of lightning, leaving a scorch mark where it lands.', capture: 'The captured piece is blasted apart in an electric burst.', mark: 'A scorched square with glowing blue cracks that fades over a few moves.' },
  erika: { move: 'Slides in through the rain, landing with a ripple and a splash.', capture: 'The captured piece melts into a raindrop and falls away.', mark: 'Leaves a puddle that dries over a few moves.' },
  melati: { move: 'A gold thread draws its path, and jasmine blooms where it lands.', capture: 'A keris flashes across the captured piece.' },
  ai: { move: 'Glitches out of its square and renders in on the next.', capture: 'The captured piece is deleted into pixels.' },
  mio: { move: 'Floats along a soft, low arc, leaving a pink afterglow and drifting embers.', capture: 'The captured piece flares pink and goes up in a puff of pink fire.' },
  haru: { move: 'Grows up out of its new square with a green glow, while leaves fold away from the old one.', capture: 'The captured piece droops, browns and falls apart into drifting petals.', mark: 'Leaves a patch of moss and tiny flowers that fades over a few moves.' },
  kaito: { move: 'Dashes straight in with an amber speed streak and a slight overshoot.', capture: 'A golden impact flash, then the piece is sent flying off the board.', mark: 'Scorches the square with glowing cracks that cool over a few moves.' },
  jun: { move: 'Tossed like a coin: up, spinning twice, down with a bounce, in a scatter of chips and dice.', capture: 'The captured piece flips over like a card and spins away.' },
  yuki: { move: 'Melts into falling snow and drifts down onto its new square, landing with a burst of ice.', capture: 'The captured piece is knocked away and shatters.', mark: 'Freezes the square solid; the ice melts over a few moves.' },
  ren: { move: 'Crimson afterimages trail behind it, and a clock ticks once where it lands.', capture: 'The captured piece ages and crumbles into falling red sand.' },
  sena: { move: 'A cold, frictionless glide with a thin glass reflection and a blue glint.', capture: 'The captured piece turns to blue glass and bursts into shards.' },
  shion: { move: 'Melts into a puddle of venom, oozes across the board and re-forms on its new square.', capture: 'The captured piece turns sickly green and dissolves into bubbles.', mark: 'Leaves a small puddle of venom that fades over a few moves.' },
  kyo: { move: 'Hauled across by an iron chain and slammed down with a crimson shockwave.', capture: 'Chains wrap the captured piece and crush it into iron shards.' },
  noa: { move: 'Lifted on strings and carried across; her pieces never quite stop swaying.', capture: 'Strings hook the captured piece and yank it off the board.' },
}

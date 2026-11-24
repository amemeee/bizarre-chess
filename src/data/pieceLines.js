import { VOICES } from './pieceVoices'

/* What chess pieces say in their speech bubbles, by mood.
   Each set's pieces speak in their owner's voice (pieceVoices.js); these shared lines fill in around them.
   TYPE_LINES adds lines for one kind of piece; those are picked twice as often as the generic ones. */
export const LINES = {
  afraid: ['Help!', 'Not me!', 'Eep!', 'Cover me!', "I'm too young to be captured!", 'Run!!'],
  nervous: ['Uh oh…', 'Stay back…', 'I have backup… right?', 'Gulp.'],
  panic: ['GUARDS!', 'Protect the king!', 'Get me out of here!', 'Not like this!'],
  shock: ['W-what is that?!', 'Is that… an ultimate?!', 'Oh no.', 'Why me?!'],
  proud: ["Got 'em!", 'Too easy.', "Who's next?", 'Bye bye~', 'Yoink!'],
  smug: ['Heh. I see you.', 'Your move.', "Nice piece. It'd look better captured.", 'Look at me.'],
  sleepy: ['Zzz…', "Wake me when it's my turn…", 'Is it over yet?', '*yawn*'],
  cheer: ['We won!!', 'Victory!', 'GG!', 'Hooray!'],
  sad: ['We lost…', '…', 'Next time.', 'Sniff.'],
  dying: ['Nooo!', 'Avenge me!', 'Tell my family…', 'Argh!', 'I regret nothing!'],
}

export const TYPE_LINES = {
  p: { afraid: ["I'm just a pawn!", 'Why is it always the pawns?!'], dying: ['Pawns have feelings too!'], proud: ['Not bad for a pawn, huh?'] },
  n: { afraid: ['Neeeigh!'], proud: ['Neigh-ce!'], dying: ['Neigh…'] },
  b: { smug: ['Diagonally yours.'], afraid: ["I can't go straight!"] },
  r: { proud: ['Castle crush!'], sleepy: ['Still guarding this corner…'], dying: ['The tower falls!'] },
  q: { afraid: ['Do you know who I am?!'], proud: ['Bow before your queen.'], dying: ['The queen… has fallen…'], smug: ['Checkmate is a lifestyle.'] },
  k: { panic: ['My crown!', 'Somebody DO something!'], cheer: ['Long live me!'], sad: ['My kingdom…'] },
}

const pick = pool => pool[Math.floor(Math.random() * pool.length)] ?? ''

/** A line for a piece in `mood`. `owner` ('you' or a character id) gives it that set's voice. */
export function lineFor(mood, type, owner) {
  const v = VOICES[owner]
  const own = v?.[mood] ?? []
  const typed = v?.types?.[type]?.[mood] ?? []
  if (own.length || typed.length) {
    // almost always the owner's voice; a shared line only now and then
    const voiced = [...own, ...typed, ...typed]
    return Math.random() < 0.9 ? pick(voiced) : pick([...(TYPE_LINES[type]?.[mood] ?? []), ...(LINES[mood] ?? [])]) || pick(voiced)
  }
  const extra = TYPE_LINES[type]?.[mood] ?? []
  return pick([...extra, ...extra, ...(LINES[mood] ?? [])])
}

/* ---- hover reactions ----
   `own` = one of your pieces (a duel), `enemy` = the opponent's (or any piece while spectating).
   Keyed by the piece's current mood; `idle` is the fallback. */
export const HOVER_LINES = {
  own: {
    idle: ['Ready.', 'Your orders?', 'Send me in.', 'At your command.', 'Lead the way.'],
    afraid: ['Please… not this move.', 'Get me out of here!', 'Protect me!'],
    nervous: ['Are we sure about this?', 'I can hold… I think.'],
    panic: ['MOVE ME! NOW!', 'Do something!'],
    sleepy: ["Huh? I'm awake!", 'Five more minutes…'],
    proud: ["Who's next?", 'Point me at one.'],
    smug: ['Watch this.', 'Easy target over there.'],
    shock: ['What was THAT?!'],
  },
  enemy: {
    idle: ['Back off.', 'Eyes on your own pieces.', 'Try me.', 'Hmph.'],
    afraid: ["Don't you dare!", 'Stay away!', 'Not me, not me…'],
    nervous: ["I'm not scared of you.", 'Careful…'],
    panic: ['Leave the crown alone!'],
    sleepy: ['Zzz… what?'],
    proud: ['Come and get me.', 'Next one is yours.'],
    smug: ["You'll regret it.", 'I see your move.'],
    shock: ['W-what are you planning?!'],
  },
}

export const HOVER_TYPE_LINES = {
  own: { k: ['Guard me well.'], q: ['Shall I?'], n: ['Ready to leap.'], p: ['Even pawns can win wars.'], r: ['The walls hold.'], b: ['Diagonals are mine.'] },
  enemy: { k: ['You will not touch the crown.'], q: ['Kneel.'], n: ['You cannot predict me.'], p: ["I'm small, not weak."] },
}

export function hoverLineFor(mood, type, own, owner) {
  const h = VOICES[owner]?.hover
  if (h && Math.random() < 0.8) {
    const lines = h[mood] ?? h.idle
    if (lines?.length) return pick(lines)
  }
  const side = own ? 'own' : 'enemy'
  const byMood = HOVER_LINES[side][mood] ?? HOVER_LINES[side].idle
  // calm pieces sometimes use a line for their piece type
  const typed = (!mood || mood === 'idle') ? HOVER_TYPE_LINES[side][type] ?? [] : []
  const pool = [...byMood, ...typed]
  return pool[Math.floor(Math.random() * pool.length)]
}

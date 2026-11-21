/* Portraits: `img` is one image per character (public/assets/chess/), `focus` is the face position used for cropping.
   `full` is a full-pose image used on the character-select cards.
   `idle` (optional) is a short looping video played in the big preview when the character is selected.
   `motion` (optional): how this character's pieces move ('puppet' = sway, carried by strings, captures yanked away;
     'time' = crimson afterimages along the path, a clock ring on landing, captures crumble to sand;
     'charge' = a straight dash with amber speed streaks, captures knocked flying off the board;
     'skip' = a bouncy hop trailing pink embers, captures go up in a puff of pink fire).
   `trail` (optional): a mark left on squares where this character's pieces land ('ice' = frost, 'crack' = glowing amber cracks).
   `pieces` (optional) names an exclusive piece set in public/assets/pieces/<name>/ used for this character's side.
   `art: 'color'` shows the image as-is; otherwise it's treated as black ink line art and inverted to glow on the dark UI.
   Without an `img` the emoji are shown.
   say.metBeaten / metWon / metAgain greet you by your record against them ({w} = your wins, {l} = your losses). */
export const CHARS = {
  mio: {
    id: 'mio', name: 'Mio', color: '#e0142b', glow: '#ff3d7a', img: '/assets/chess/mio.jpg', pieces: 'ember', motion: 'skip', full: '/assets/chess/mio-full.jpg', art: 'color', focus: '50% 30%', skill: 3, depth: 3, level: 'Easy',
    emoji: { idle: '😊', happy: '😆', angry: '😤', sad: '😢', shock: '😲', ult: '🔥' },
    desc: 'Cheerful beginner. Plays fast and loose.',
    ult: { name: 'Flame Burst', text: 'Burns one of your pieces to ash.', fx: 'burn', shout: 'Burn!' },
    say: {
      start: "Let's have fun! Don't go easy on me~",
      metBeaten: "You've beaten me {w} times... this time I'm ready! Probably!",
      metWon: "Back again? I've won {l} already, hehe~ Let's make it one more!",
      metAgain: "We're even, right? Then this one decides it!",
      capture: ['Got one!', 'Yum, thanks for the piece!', 'Hehe, mine now!'],
      lost: ['Hey! That was my piece!', 'Ouch... rude!', 'Noooo!'],
      check: ['Check! Run, run!'], inCheck: ['Eek! My king!'],
      think: ['Hmm hmm...'],
      win: 'I won?! I actually won!!', lose: "Aww, you're really good... rematch?", draw: 'A draw! Fair enough.',
    },
  },
  kaito: {
    id: 'kaito', name: 'Kaito', color: '#e08a00', glow: '#ffb020', img: '/assets/chess/kaito.jpg', pieces: 'gold', motion: 'charge', trail: 'crack', full: '/assets/chess/kaito-full.jpg', art: 'color', focus: '51% 31%', skill: 5, depth: 4, level: 'Normal',
    emoji: { idle: '😁', happy: '🤣', angry: '😡', sad: '😩', shock: '🤯', ult: '👑' },
    desc: 'Loud and reckless. Attacks first, thinks later.',
    ult: { name: 'Crown Grab', text: 'Promotes one of his pawns straight to a queen.', fx: 'promote', shout: 'Long live the queen!' },
    say: {
      start: "Yo! Let's make this loud!",
      metBeaten: "You again! {w} wins on me? Not today, pal!",
      metWon: "Ha! {l} losses and you're back for more? I love the spirit!",
      metAgain: "Tied up, huh? Let's settle this LOUD!",
      capture: ['HA! Gotcha!', "That one's mine!", 'Too slow!'],
      lost: ['Whoa, hey!', "Okay, that's fair...", 'You sneaky—!'],
      check: ['CHECK! Feel the pressure!'], inCheck: ['Wait wait wait!'],
      think: ['Charge!', "Let's gooo..."],
      win: 'YEAH! Told you I had it!', lose: "Aw man... one more round. Right now!", draw: "A draw?! Nobody wins? Lame!",
    },
  },
  yuki: {
    id: 'yuki', name: 'Yuki', color: '#5b7a99', glow: '#8ff0ff', img: '/assets/chess/yuki.jpg', pieces: 'ice', trail: 'ice', idle: '/assets/chess/yuki-idle.mp4', full: '/assets/chess/yuki-full.jpg', art: 'color', focus: '46% 32%', skill: 7, depth: 6, level: 'Medium',
    emoji: { idle: '🙂', happy: '😌', angry: '🥶', sad: '🥺', shock: '😮', ult: '❄️' },
    desc: 'Calm and patient. Waits for your mistakes.',
    ult: { name: 'Blizzard', text: 'Freezes and shatters two of your pawns.', fx: 'freeze', shout: 'Shatter.' },
    say: {
      start: "Let's play quietly.",
      metBeaten: "You've won {w} times... I've been thinking about why.",
      metWon: "Welcome back. I hope you've learned since last time.",
      metAgain: "Even again. How fitting. Let's play.",
      capture: ["I'll take that.", 'Patience pays.', 'Thank you.'],
      lost: ['Oh... you got me.', 'I see.', 'Careful, now.'],
      check: ['Check.'], inCheck: ['Oh my.'],
      think: ['Let me think...'],
      win: 'Good game.', lose: 'You played beautifully.', draw: 'A peaceful draw.',
    },
  },
  ren: {
    id: 'ren', name: 'Ren', color: '#15171f', glow: '#ff4a3d', img: '/assets/chess/ren.jpg', pieces: 'clockwork', motion: 'time', full: '/assets/chess/ren-full.jpg', art: 'color', focus: '50% 36%', skill: 12, depth: 9, level: 'Hard',
    emoji: { idle: '😐', happy: '😏', angry: '😠', sad: '😔', shock: '😳', ult: '⚡' },
    desc: 'Cold and calculating. Rarely makes mistakes.',
    ult: { name: 'Time Skip', text: 'Freezes time. You lose your next turn.', fx: 'skip', shout: 'Time is mine.' },
    say: {
      start: "Show me what you've got.",
      metBeaten: "{w} wins. I've calculated every one of them. It won't happen again.",
      metWon: "{l} losses and you still return. Interesting.",
      metAgain: "Even. Let's break the tie.",
      capture: ['Predictable.', 'Thank you.', 'Material advantage.'],
      lost: ['...Noted.', 'A lucky trade.', 'Hm. Not bad.'],
      check: ['Check.'], inCheck: ['Tch.'],
      think: ['...'],
      win: 'As expected.', lose: '...Impressive. I underestimated you.', draw: 'A draw. Unsatisfying.',
    },
  },
  noa: {
    id: 'noa', name: 'Noa', color: '#6a3fd0', glow: '#b06bff', img: '/assets/chess/noa.jpg', pieces: 'puppet', motion: 'puppet', full: '/assets/chess/noa-full.jpg', art: 'color', focus: '52% 36%', skill: 18, depth: 12, level: 'Expert',
    emoji: { idle: '😶', happy: '😈', angry: '😾', sad: '🫥', shock: '😦', ult: '🕸️' },
    desc: 'A quiet puppeteer. Your own pieces will turn on you.',
    ult: { name: 'Puppet Strings', text: 'Takes control of one of your knights or bishops.', fx: 'steal', shout: 'Dance for me.' },
    say: {
      start: 'Shall we begin? I already know how this ends.',
      metBeaten: "{w} times you cut my strings... I've been looking forward to this.",
      metWon: "Back to dance again? You do it so well. {l} times now.",
      metAgain: "We're balanced on a thread. Shall we see which way it falls?",
      capture: ['Mine now.', 'Thank you for the gift.', 'Exactly as planned.'],
      lost: ['How bold.', 'Interesting...', 'You bit the string.'],
      check: ['Check. Feel the strings tighten.'], inCheck: ['...Oh?'],
      think: ['Let me pull a thread...', '...'],
      win: 'Every piece was always mine.', lose: 'You cut the strings... Remarkable.', draw: 'A stalemate. How elegant.',
    },
  },
}

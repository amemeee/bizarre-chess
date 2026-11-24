/* Portraits: `img` is one image per character (public/assets/chess/), `focus` is the face position used for cropping.
   `full` is a full-pose image used on the character-select cards.
   `idle` (optional) is a short looping video played in the big preview when the character is selected.
   `motion` (optional): how this character's pieces move ('puppet' = sway, carried by strings, captures yanked away;
     'time' = crimson afterimages along the path, a clock ring on landing, captures crumble to sand;
     'charge' = a straight dash with amber speed streaks, captures knocked flying off the board;
     'skip' = a bouncy hop trailing pink embers, captures go up in a puff of pink fire;
     'grow' = the piece grows up out of its new square, captures wilt into falling petals;
     'glide' = a cold, frictionless glide with a blue glint on landing, captures shatter into blue glass;
     'flip' = tossed like a coin, spinning through the air, landing in a scatter of chips; captures fold away like a card;
     'ooze' = melts into a puddle of venom, oozes across and re-forms, captures dissolve into green bubbles;
     'drag' = hauled across by an iron chain and slammed down, captures are crushed in chains;
     'mist' = dissolves into mist, drifts across and re-forms, captures fade away into wisps: Shin & Akane).
   `trail` (optional): a mark left on squares where this character's pieces land ('ice' = frost, 'crack' = glowing amber cracks,
     'bloom' = a patch of moss and tiny flowers).
   `pieces` (optional) names an exclusive piece set in public/assets/pieces/<name>/ used for this character's side.
   `art: 'color'` shows the image as-is; otherwise it's treated as black ink line art and inverted to glow on the dark UI.
   Without an `img` the emoji are shown.
   ult.charge: how fast this rival's meter fills (1 = normal). Ultimates are balanced to be worth about 3 points of
     material each time they fire (pawn 1, knight/bishop 3, rook 5, queen 9), so stronger effects charge slower:
     Flame Burst 3 · Blizzard 3 at normal speed; Bloom 2-3 (only after losses) at 1.25x; Time Skip (a free move that
     can't capture, so it sets up threats but can't win a piece outright) at 0.75x; Crown Grab +8 at 0.45x;
     Puppet Strings 6 at 0.55x; Downfall 2-4 at 0.85x; All In averages ~2 but swings, at 1.3x;
     Venom Kiss ~3 (two pieces at risk, you can only save one) at 0.9x; Iron Dominion (your two best pieces frozen
     for two turns) at 0.85x.
   ult.img (optional): key art for the ultimate cut-in (landscape, ~3:2, subject in the middle band); the portrait is used if missing.
   ult.boardFx (optional): the board effect to play when it isn't the same as `fx` (the heroes reuse existing ones).
   `moods` (optional): a portrait per mood (happy, angry, shock, sad, ult) the battle panel switches to; without one it tints `img`.
   `villain: true` marks the antagonists, the people behind the tournament.
   say.metBeaten / metWon / metAgain greet you by your record against them ({w} = your wins, {l} = your losses).
   say.slow: three lines, more and more impatient, said when you take too long over a move (after 20s, 45s and 80s).
   say.surrender: said when you resign.
   say.vsFemale (Rai): lines that replace his usual ones when his opponent is female (`female: true`); say.vsAI against AI-0.
   say.vsRai (AI-0): her replies to Rai's flirting.
   say.mirror: { start, reply, win, lose } for a mirror match (this character against themselves): `start` opens it,
   `reply` is the other copy's answer (Spectate), `win` / `lose` close it. */
/* Free Battle difficulty: any rival can be played at any of these strengths (Stockfish skill 0-20, search depth).
   Each rival's own `level` is one of these names, and is used when you leave the difficulty on "Rival".
   `blunder`: the chance, each move, that the rival ignores the engine and plays a random legal move instead.
   Even Stockfish at skill 0 rarely gives pieces away, so this is what makes the low levels beatable for a new player. */
export const LEVELS = [
  { name: 'Beginner', skill: 0, depth: 1, blunder: 0.5 },
  { name: 'Easy', skill: 1, depth: 2, blunder: 0.3 },
  { name: 'Normal', skill: 5, depth: 4, blunder: 0.1 },
  { name: 'Medium', skill: 7, depth: 6 },
  { name: 'Hard', skill: 12, depth: 9 },
  { name: 'Expert', skill: 18, depth: 12 },
  { name: 'Master', skill: 20, depth: 16 },
]

export const CHARS = {
  /* ---- the heroes: Shin and Akane are who you play as in the story, and Free Battle opponents too ----
     `hero: true` keeps them out of the story's rival list and the Collection (they're "You" there). */
  shin: {
    id: 'shin', name: 'Shin', hero: true, color: '#2a2838', glow: '#e8e4ff', img: '/assets/chess/player-m.jpg', pieces: 'awakened', motion: 'mist', art: 'color', focus: '50% 30%', skill: 12, depth: 9, level: 'Hard',
    emoji: { idle: '😐', happy: '😏', angry: '😠', sad: '😶', shock: '😮', ult: '♛' },
    desc: 'A quiet newcomer who never shows his hand.',
    ult: { name: 'Shadow Swap', text: 'Two of his pieces (not the king) trade places in an instant, lining up an attack. His turn continues.', fx: 'swap', charge: 0.9, shout: 'Switch.' },
    say: {
      start: '…Let\'s play.',
      metBeaten: '{w} times. I remember every one of them.',
      metWon: '{l} wins for me. You keep coming back. Good.',
      metAgain: 'Even. Then this one counts.',
      capture: ['Mine.', 'Too slow.', 'Seen it.'],
      lost: ['…Fine.', 'I let you have that.', 'Hm.'],
      check: ['Check.'], inCheck: ['…Not bad.'],
      think: ['…', 'Let me see.'],
      slow: ['Your move.', '…Still thinking?', "I can wait. I'd rather not."],
      surrender: "Done already? …I'd hoped for more.",
      mirror: {start: "…So you play like me. Let's see who blinks first.", reply: "I never show my hand. Neither do you.", win: "I read myself. Good.", lose: "…You hid it better than I would."},
      win: 'Again, whenever you want.', lose: '…You read me. Next time I hide better.', draw: 'Even. For now.',
    },
  },
  akane: {
    id: 'akane', female: true, name: 'Akane', hero: true, color: '#5a1020', glow: '#ff3b5c', img: '/assets/chess/player-f.jpg', pieces: 'awakened', motion: 'mist', art: 'color', focus: '50% 30%', skill: 12, depth: 9, level: 'Hard',
    emoji: { idle: '🙂', happy: '😌', angry: '😠', sad: '😔', shock: '😳', ult: '👁️' },
    desc: 'A quiet newcomer whose red eyes miss nothing.',
    ult: { name: 'Crimson Sight', text: 'Her eyes see the path to victory: her next three moves are played perfectly.', fx: 'sight', charge: 0.9, shout: 'I see you.' },
    say: {
      start: "I've already seen your first move. Go on.",
      metBeaten: "{w} times you've beaten me. I've been watching how.",
      metWon: '{l} times now. You keep making the same mistake.',
      metAgain: "Even. I'll look a little closer this time.",
      capture: ['Saw that coming.', 'Thank you.', 'Right where I looked.'],
      lost: ['…I missed that one.', 'Careful.', 'Oh?'],
      check: ['Check. Did you see it?'], inCheck: ['…You hid that well.'],
      think: ['Let me look…', '…'],
      slow: ["Take your time. I'm watching.", 'Your eyes keep drifting to the same square.', "Even I can't read a move you never make."],
      surrender: "You're stopping? …I saw that coming, too.",
      mirror: {start: "I see you… and you see me. This could take a while.", reply: "Then let's look closer.", win: "I saw myself coming.", lose: "…I didn't see that. Not even from myself."},
      win: 'I saw it from the first move.', lose: "…I didn't see that. Well played.", draw: 'Neither of us blinked.',
    },
  },
  mio: {
    id: 'mio', female: true, name: 'Mio', color: '#e0142b', glow: '#ff3d7a', img: '/assets/chess/mio.jpg', pieces: 'ember', motion: 'skip', full: '/assets/chess/mio-full.jpg', art: 'color', focus: '50% 40%', skill: 1, depth: 2, level: 'Easy',
    emoji: { idle: '😊', happy: '😆', angry: '😤', sad: '😢', shock: '😲', ult: '🔥' },
    desc: 'Cheerful beginner. Plays fast and loose.',
    ult: { name: 'Flame Burst', text: 'Burns one of your knights or bishops to ash (two pawns if none are left).', fx: 'burn', charge: 1, shout: 'Burn!' },
    say: {
      start: "Let's have fun! Don't go easy on me~",
      metBeaten: "You've beaten me {w} times... this time I'm ready! Probably!",
      metWon: "Back again? I've won {l} already, hehe~ Let's make it one more!",
      metAgain: "We're even, right? Then this one decides it!",
      capture: ['Got one!', 'Yum, thanks for the piece!', 'Hehe, mine now!'],
      lost: ['Hey! That was my piece!', 'Ouch... rude!', 'Noooo!'],
      check: ['Check! Run, run!'], inCheck: ['Eek! My king!'],
      think: ['Hmm hmm...'],
      slow: ["Helloooo? It's your turn~", "Are you asleep? I'm gonna draw on your face!", "Pleeease move, I'm getting bored!"],
      surrender: "Wait, you're giving up?! No fair, I was just warming up!",
      mirror: {start: "W-wait, that's ME?! Okay, copycat, loser buys the cake!", reply: "I'm the real Mio! You're the copy! …Right?", win: "Hehe, I'm the real Mio! Obviously~", lose: "Noooo, the copy won?! …Wait, does that make ME the copy?!"},
      win: 'I won?! I actually won!!', lose: "Aww, you're really good... rematch?", draw: 'A draw! Fair enough.',
    },
  },
  haru: {
    id: 'haru', name: 'Haru', color: '#1f8a55', glow: '#4dff9b', img: '/assets/chess/haru.jpg', pieces: 'vine', motion: 'grow', trail: 'bloom', full: '/assets/chess/haru-full.jpg', fullPending: true, art: 'color', focus: '50% 40%', skill: 1, depth: 2, level: 'Easy',
    emoji: { idle: '🌱', happy: '😊', angry: '😣', sad: '🥀', shock: '😯', ult: '🌸' },
    desc: 'A gentle gardener. Nothing he loses stays gone for long.',
    ult: { name: 'Bloom', text: 'Brings back one of his captured knights or bishops (or two pawns) onto an empty starting square. His meter fills fast.', fx: 'revive', charge: 1.25, shout: 'Bloom again.' },
    say: {
      start: "H-hello. Please be gentle with my pieces… they're still growing.",
      metBeaten: "You've beaten me {w} times… but every seed grows back. Let's try again.",
      metWon: "You came back after {l} losses? That's… really nice. Let's play.",
      metAgain: "We're even. Like two flowers in the same pot.",
      capture: ['Sorry! I had to.', "I took one… I hope that's okay.", 'A little pruning.'],
      lost: ['Oh no… not that one.', "It's okay. It'll grow back.", 'Ah… poor thing.'],
      check: ['Check… s-sorry!'], inCheck: ['Ah! My king!'],
      think: ['Hmm… patience…', 'Let it grow…'],
      slow: ["Take your time… the seeds aren't going anywhere.", "Um… are you still there?", "Even flowers bloom faster than this…"],
      surrender: "You're stopping? That's okay… rest, and come back when you're ready.",
      mirror: {start: "Oh… there are two of me? I hope we both grow well.", reply: "Let's be gentle with each other… okay?", win: "I won against… myself? I'm not sure how to feel.", lose: "I lost to me… I guess I'm still growing."},
      win: "I won? I… I didn't think I could.", lose: 'You play like the spring wind. That was lovely.', draw: 'A draw. Everyone gets to keep growing.',
    },
  },
  kaito: {
    id: 'kaito', name: 'Kaito', color: '#e08a00', glow: '#ffb020', img: '/assets/chess/kaito.jpg', pieces: 'gold', motion: 'charge', trail: 'crack', full: '/assets/chess/kaito-full.jpg', art: 'color', focus: '50% 38%', skill: 5, depth: 4, level: 'Normal',
    emoji: { idle: '😁', happy: '🤣', angry: '😡', sad: '😩', shock: '🤯', ult: '👑' },
    desc: 'Loud and reckless. Attacks first, thinks later.',
    ult: { name: 'Crown Grab', text: 'Promotes one of his pawns straight to a queen. His meter fills slowly.', fx: 'promote', charge: 0.45, shout: 'Long live the queen!' },
    say: {
      start: "Yo! Let's make this loud!",
      metBeaten: "You again! {w} wins on me? Not today, pal!",
      metWon: "Ha! {l} losses and you're back for more? I love the spirit!",
      metAgain: "Tied up, huh? Let's settle this LOUD!",
      capture: ['HA! Gotcha!', "That one's mine!", 'Too slow!'],
      lost: ['Whoa, hey!', "Okay, that's fair...", 'You sneaky—!'],
      check: ['CHECK! Feel the pressure!'], inCheck: ['Wait wait wait!'],
      think: ['Charge!', "Let's gooo..."],
      slow: ["C'mon, c'mon, MOVE!", "I'm dying of old age over here!", "Did you fall asleep?! WAKE UP!"],
      surrender: "Hah?! You're folding? Lame! I wanted a real fight!",
      mirror: {start: "TWO of me?! This is gonna be the LOUDEST game ever!", reply: "Only one of us gets the crown, pal!", win: "HA! I'm the better me! Obviously!", lose: "Beaten by my own face?! REMATCH, me!"},
      win: 'YEAH! Told you I had it!', lose: "Aw man... one more round. Right now!", draw: "A draw?! Nobody wins? Lame!",
    },
  },
  jun: {
    id: 'jun', name: 'Jun', color: '#8a8aa0', glow: '#e8e8f8', img: '/assets/chess/jun.jpg', pieces: 'chips', motion: 'flip', full: '/assets/chess/jun-full.jpg', fullPending: true, art: 'color', focus: '50% 40%', skill: 7, depth: 6, level: 'Medium',
    emoji: { idle: '😼', happy: '🤑', angry: '😬', sad: '😵', shock: '🙀', ult: '🎲' },
    desc: "A grinning gambler, and Sena's little brother. Bets everything on a roll of the dice.",
    ult: { name: 'All In', text: 'Rolls a die: 1–2 he loses a pawn, 3–5 burns one of your knights or bishops, 6 burns two. His meter fills fast.', fx: 'gamble', charge: 1.3, shout: "Read 'em and weep!" },
    say: {
      start: "Place your bets! Odds are… well, let's find out.",
      metBeaten: "{w} wins on me? Your luck can't hold forever, friend.",
      metWon: "{l} losses and you're still at my table? I like a player who never folds.",
      metAgain: "Even odds. My favourite kind.",
      capture: ['Jackpot!', 'House wins!', "I'll cash that in."],
      lost: ['Bad beat…', 'Easy come, easy go!', "Ouch, that's a big chip."],
      check: ['Check! Feeling lucky?'], inCheck: ['Whoa, whoa, the dice are cold!'],
      think: ['Let it ride…', 'Feeling lucky…'],
      slow: ["Clock's ticking, friend.", "Thinking hard, or just scared to roll?", "The table doesn't wait forever."],
      surrender: "Folding already? Smart. Some hands you just can't win.",
      mirror: {start: "A gambler betting against himself. The house can't lose.", reply: "Same odds, same face. Let's see whose luck runs out.", win: "Turns out I'm luckier than me.", lose: "Bet against myself and lost. …Classic."},
      win: 'The house always wins!', lose: "You beat the odds. Respect.", draw: 'A push! Everyone keeps their chips.',
    },
  },
  yuki: {
    id: 'yuki', female: true, name: 'Yuki', color: '#5b7a99', glow: '#8ff0ff', img: '/assets/chess/yuki.jpg', pieces: 'ice', motion: 'snow', trail: 'ice', full: '/assets/chess/yuki-full.jpg', art: 'color', focus: '50% 40%', skill: 7, depth: 6, level: 'Medium',
    emoji: { idle: '🙂', happy: '😌', angry: '🥶', sad: '🥺', shock: '😮', ult: '❄️' },
    desc: "Calm and patient, Noa's twin sister. Waits for your mistakes.",
    ult: { name: 'Blizzard', text: 'Freezes and shatters three of your pawns.', fx: 'freeze', charge: 1, shout: 'Shatter.' },
    say: {
      start: "Let's play quietly.",
      metBeaten: "You've won {w} times... I've been thinking about why.",
      metWon: "Welcome back. I hope you've learned since last time.",
      metAgain: "Even again. How fitting. Let's play.",
      capture: ["I'll take that.", 'Patience pays.', 'Thank you.'],
      lost: ['Oh... you got me.', 'I see.', 'Careful, now.'],
      check: ['Check.'], inCheck: ['Oh my.'],
      think: ['Let me think...'],
      slow: ["Take your time. I'm patient.", "…Still thinking?", "Even I have limits, you know."],
      surrender: "You're resigning? …That's a shame. I was enjoying this.",
      mirror: {start: "…A reflection. Then neither of us will make the first mistake.", reply: "We'll wait together, then.", win: "I waited a little longer.", lose: "You were more patient than me."},
      win: 'Good game.', lose: 'You played beautifully.', draw: 'A peaceful draw.',
    },
  },
  ren: {
    id: 'ren', name: 'Ren', color: '#15171f', glow: '#ff4a3d', img: '/assets/chess/ren.jpg', pieces: 'clockwork', motion: 'time', full: '/assets/chess/ren-full.jpg', art: 'color', focus: '50% 36%', skill: 12, depth: 9, level: 'Hard',
    emoji: { idle: '😐', happy: '😏', angry: '😠', sad: '😔', shock: '😳', ult: '⚡' },
    desc: 'Your rival since the first day. Cold and calculating; rarely makes mistakes.',
    ult: { name: 'Time Skip', text: "Freezes time: you lose your next turn, and he moves again (the bonus move can't capture). His meter fills slowly.", fx: 'skip', charge: 0.75, shout: 'Time is mine.', img: '/assets/chess/ren-ult.jpg' },
    say: {
      start: "Show me what you've got.",
      metBeaten: "{w} wins. I've calculated every one of them. It won't happen again.",
      metWon: "{l} losses and you still return. Interesting.",
      metAgain: "Even. Let's break the tie.",
      capture: ['Predictable.', 'Thank you.', 'Material advantage.'],
      lost: ['...Noted.', 'A lucky trade.', 'Hm. Not bad.'],
      check: ['Check.'], inCheck: ['Tch.'],
      think: ['...'],
      slow: ["Tick. Tock.", "Every second you waste, I've already accounted for.", "You're wasting my time now."],
      surrender: "Resigning. The correct move, at least.",
      mirror: {start: "A copy of me. I've calculated every one of your moves… because they're mine.", reply: "Then you know how this ends. So do I.", win: "Recalculated. I'm still the original.", lose: "…I underestimated myself."},
      win: 'As expected.', lose: '...Impressive. I underestimated you.', draw: 'A draw. Unsatisfying.',
    },
  },
  sena: {
    id: 'sena', female: true, name: 'Sena', color: '#1c3b8f', glow: '#4a7dff', img: '/assets/chess/sena.jpg', pieces: 'glass', motion: 'glide', full: '/assets/chess/sena-full.jpg', fullPending: true, art: 'color', focus: '50% 42%', skill: 14, depth: 10, level: 'Hard',
    emoji: { idle: '😑', happy: '😌', angry: '😠', sad: '😞', shock: '😨', ult: '💎' },
    desc: "A proud noble, and Jun's older sister. She thinks your best piece is beneath her.",
    ult: { name: 'Downfall', text: 'Demotes your queen to a rook (a rook to a knight if you have no queen).', fx: 'demote', charge: 0.85, shout: 'Kneel.' },
    say: {
      start: 'You may approach the board. Try not to embarrass yourself.',
      metBeaten: "{w} wins against me. A clerical error, surely.",
      metWon: "{l} losses, and still you come begging for another. How persistent.",
      metAgain: 'Even? Unacceptable. I will correct that.',
      capture: ['How common.', 'That piece was beneath you anyway.', 'Removed.'],
      lost: ['How dare you.', 'A minor loss.', 'Insolent.'],
      check: ['Check. Know your place.'], inCheck: ['You would threaten me?'],
      think: ['Hmph.', 'How tedious…'],
      slow: ["I do not wait for anyone.", "Paralysed by my presence? Understandable.", "This delay is an insult."],
      surrender: "Kneeling already? At least you know your place.",
      mirror: {start: "An imitation of me? How dare you wear my face.", reply: "There can only be one queen in this hall.", win: "As expected. The original prevails.", lose: "…Even my copy is magnificent. Hmph."},
      win: 'As it should be.', lose: '…You have earned my attention. Do not waste it.', draw: 'A draw. Barely tolerable.',
    },
  },
  noa: {
    id: 'noa', female: true, name: 'Noa', color: '#6a3fd0', glow: '#b06bff', img: '/assets/chess/noa.jpg', pieces: 'puppet', motion: 'puppet', full: '/assets/chess/noa-full.jpg', art: 'color', focus: '50% 42%', skill: 18, depth: 12, level: 'Expert',
    emoji: { idle: '😶', happy: '😈', angry: '😾', sad: '🫥', shock: '😦', ult: '🕸️' },
    desc: "A quiet puppeteer, Yuki's twin sister. Your own pieces will turn on you.",
    ult: { name: 'Puppet Strings', text: 'Takes control of one of your knights or bishops. Her meter fills slowly.', fx: 'steal', charge: 0.55, shout: 'Dance for me.' },
    say: {
      start: 'Shall we begin? I already know how this ends.',
      metBeaten: "{w} times you cut my strings... I've been looking forward to this.",
      metWon: "Back to dance again? You do it so well. {l} times now.",
      metAgain: "We're balanced on a thread. Shall we see which way it falls?",
      capture: ['Mine now.', 'Thank you for the gift.', 'Exactly as planned.'],
      lost: ['How bold.', 'Interesting...', 'You bit the string.'],
      check: ['Check. Feel the strings tighten.'], inCheck: ['...Oh?'],
      think: ['Let me pull a thread...', '...'],
      slow: ["Frozen? The strings hold you still.", "I can wait. I always win the waiting.", "…Do you even know what to do?"],
      surrender: "You cut your own strings. How disappointing.",
      mirror: {start: "Two puppeteers, one stage. Who is pulling whose strings?", reply: "Shall we see which of us is the puppet?", win: "So I was holding the strings after all.", lose: "…Then I was the puppet all along."},
      win: 'Every piece was always mine.', lose: 'You cut the strings... Remarkable.', draw: 'A stalemate. How elegant.',
    },
  },
  /* ---- the antagonists: the people behind the tournament ---- */
  shion: {
    id: 'shion', female: true, name: 'Shion', color: '#4f7a00', glow: '#c6ff3d', img: '/assets/chess/shion.jpg', pieces: 'venom', motion: 'ooze', trail: 'venom', full: '/assets/chess/shion-full.jpg', fullPending: true, art: 'color', focus: '50% 40%', skill: 19, depth: 13, level: 'Expert', villain: true,
    emoji: { idle: '😊', happy: '😈', angry: '😒', sad: '😣', shock: '😳', ult: '🧪' },
    desc: "Kyo's smiling lieutenant. Her poison takes its time.",
    ult: { name: 'Venom Kiss', text: 'Poisons two of your knights, bishops or rooks. Any still on the same square when her next turn starts withers away.', fx: 'poison', charge: 0.9, shout: 'Sweet dreams~' },
    say: {
      start: "Hello, champion~ Let's see how long you last.",
      metBeaten: "{w} times you've cured my poison… I'm brewing something stronger.",
      metWon: "{l} losses and you're still drinking from my cup? Adorable~",
      metAgain: 'Even, hm? Then let the poison decide.',
      capture: ['Mine~', 'Shh, it only stings a little.', 'Another sample for my collection.'],
      lost: ['Ouch. Rude~', 'Hm. You bite back.', "That's fine. I have more."],
      check: ['Check~ Feeling dizzy?'], inCheck: ['Oh? Feisty.'],
      think: ['Hmm, which vial…', 'Let it simmer…'],
      slow: ["Feeling a little numb, champion~?", "Don't doze off~ The poison works faster when you sleep.", "Tick tock~ My patience is a slow poison too."],
      surrender: "Giving up? Aww~ and I hadn't even finished brewing.",
      mirror: {start: "Two of me? Double the poison, double the fun~", reply: "Let's see who builds immunity first, sweetie~", win: "Mm, my poison is sweeter~", lose: "Ugh, poisoned by my own recipe…"},
      win: 'Sweet dreams, little piece~', lose: '…Kyo will be so interested in you.', draw: 'A draw? How boring. Again.',
    },
  },
  kyo: {
    id: 'kyo', name: 'Kyo', color: '#5a0010', glow: '#d1002c', img: '/assets/chess/kyo.jpg',
    // a portrait per mood (the battle panel swaps to it); calm uses `img`
    moods: { happy: '/assets/chess/kyo-happy.jpg', angry: '/assets/chess/kyo-angry.jpg', shock: '/assets/chess/kyo-shock.jpg', sad: '/assets/chess/kyo-sad.jpg', ult: '/assets/chess/kyo-ult.jpg',
      mask: '/assets/chess/kyo-mask.jpg',
      // mask: while losing badly he hides behind a smiling mask (defeated, it breaks into `sad`); hopeless: story only, when he finally loses hope
      hopeless: '/assets/chess/kyo-hopeless.jpg' },
    pieces: 'chains', motion: 'drag', full: '/assets/chess/kyo-full.jpg', fullPending: true, art: 'color', focus: '50% 40%', skill: 20, depth: 16, level: 'Master', villain: true,
    emoji: { idle: '😐', happy: '😏', angry: '😠', sad: '😶', shock: '😮', ult: '⛓️' },
    desc: 'The masked founder of the tournament. To him, every player is a piece.',
    ult: { name: 'Iron Dominion', text: "Chains two of your strongest pieces: they can't move for your next two turns.", fx: 'seal', charge: 0.85, shout: 'Kneel in chains.', img: '/assets/chess/kyo-ult.jpg' },
    say: {
      start: 'So you are the piece that refused to fall.',
      metBeaten: '{w} times you have defied me. It will not become a habit.',
      metWon: '{l} times you have knelt. Kneel again.',
      metAgain: 'Balanced. I despise balance.',
      capture: ['Removed.', 'Back in the box.', 'You are running out of pieces.'],
      lost: ['A sacrifice I allowed.', 'Interesting.', '…Noted.'],
      check: ['Check. Kneel.'], inCheck: ['…Bold.'],
      think: ['…', 'Every move is mine.'],
      slow: ["Hesitation is the first crack.", "A piece that cannot move is already captured.", "Do not waste my time."],
      surrender: "You lay down your king. Good. That is how every piece ends.",
      mirror: {start: "A piece wearing my mask. Kneel to the original.", reply: "There is only one king on this board.", win: "The copy kneels. As it should.", lose: "…Then the mask belongs to you now."},
      win: 'As every piece before you. Back into the box.', lose: '…I will have my revenge.', draw: 'A draw. You merely delayed the inevitable.',
    },
  },

  /* ---- coming soon: shown in Free Battle as locked cards, hidden everywhere else (`locked: true`) ---- */
  erika: {
    id: 'erika', female: true, name: 'Erika', locked: true, color: '#3b4f74', glow: '#7f9cc4', img: '/assets/chess/erika.jpg', pieces: 'rain', motion: 'rain', trail: 'rainpool', art: 'color', focus: '50% 35%', skill: 7, depth: 6, level: 'Medium',
    emoji: { idle: '🌧️', happy: '🙂', angry: '😣', sad: '😢', shock: '😮', ult: '☔' },
    desc: 'Rina Erika, a melancholy girl who carries the rain with her. She wears you down, drop by drop.',
    ult: { name: 'Downpour', text: 'Floods the two empty squares your pieces most want to reach: you can\'t move onto them for your next two turns.', fx: 'flood', charge: 1, shout: 'Let it pour.' },
    say: {
      start: '…It always rains when I play. Sorry.', capture: ['…Sorry.', 'Drip.'], lost: ['Ah…', '…Cold.'], check: ['Check… I think.'], inCheck: ['…!'],
      think: ['…', 'Listen to the rain…'], slow: ['…Are you still there?', 'The rain is getting heavier.', '…Please move.'],
      surrender: "You're leaving? …Take an umbrella.", win: 'The rain stopped… for a moment.', lose: '…It was nice, playing with you.', draw: 'A grey sky. Neither of us wins.',
    },
  },
  melati: {
    id: 'melati', female: true, name: 'Melati', locked: true, color: '#7a1f2b', glow: '#e3b23c', img: '/assets/chess/melati.jpg', pieces: 'songket', motion: 'weave', art: 'color', focus: '50% 35%', skill: 12, depth: 9, level: 'Hard',
    emoji: { idle: '🙂', happy: '😌', angry: '😠', sad: '😔', shock: '😮', ult: '🌼' },
    desc: 'A graceful Malay player whose traps close like a woven songket pattern.',
    ult: { name: 'Tenunan', text: 'Ties your two most valuable pieces together with a gold thread for three turns: move one, and the other is lost.', fx: 'bond', charge: 0.8, shout: 'Every thread has its place.' },
    say: {
      start: 'Selamat datang. Shall we weave something beautiful?', capture: ['One more thread.', 'Thank you.'], lost: ['Hm. A loose thread.', 'Bold.'], check: ['Check. The pattern closes.'], inCheck: ['…Oh?'],
      think: ['Hmm…', 'Every thread has its place.'], slow: ['Take your time.', 'Even weaving needs patience… but not this much.', 'Ayuh, your move.'],
      surrender: 'Already? The pattern was only half finished.', win: 'Cantik. A complete pattern.', lose: 'You cut through my threads… well played.', draw: 'An unfinished cloth. Next time.',
    },
  },
  ai: {
    id: 'ai', female: true, name: 'AI-0', locked: true, color: '#0b5f55', glow: '#00e5c7', img: '/assets/chess/ai.jpg', pieces: 'wireframe', motion: 'glitch', art: 'color', focus: '50% 35%', skill: 20, depth: 16, level: 'Master',
    emoji: { idle: '🤖', happy: '🙂', angry: '😐', sad: '😶', shock: '😮', ult: '💠' },
    desc: 'A chess engine given a body. She plays perfectly, and is trying to understand why you enjoy losing.',
    ult: { name: 'Factory Reset', text: 'Sends two of your most advanced pieces back to their starting squares, undoing all their progress.', fx: 'reset', charge: 0.8, shout: 'Restoring default settings.' },
    say: {
      start: 'Hello. I have already evaluated this position. Shall we begin?', capture: ['Material +1.', 'Expected.'], lost: ['Recalculating.', 'Interesting.'], check: ['Check.'], inCheck: ['Unexpected input.'],
      think: ['Processing…', '…'], slow: ['Your clock is running.', 'Are you buffering?', 'I can wait. I do not get bored. Probably.'],
      surrender: 'Resignation logged. Was it fun?', win: 'Game complete. Did you enjoy it?', lose: '…Error. I want to play again. Is that what you call "fun"?', draw: 'Draw. Insufficient data.',
      // against Rai: a machine trying (and failing) to process his flirting
      vsRai: {
        start: 'Flirtation detected. Analysing… analysis inconclusive. Why is my core temperature rising?',
        capture: ['Your piece has been removed. That was not a date.', 'I took your piece. You may keep your heart.', 'Material advantage: me. Heart advantage: …error.'],
        lost: ['You took my piece and winked. These two events should not be related.', 'Recalculating… your smile is not in my database.'],
        check: ['Check. Please stop calling me gorgeous. It slows my processing.'], inCheck: ['…Why does my fan speed increase when you do that?'],
        think: ['Ignoring flattery… ignoring flattery…', "Processing… what is a 'date'?"],
        slow: ['Flirting does not count as a move.', 'I am waiting. Not because I want to.', 'Please move. Or say something nice. …Delete that last request.'],
        surrender: 'Resignation logged. …Will you come back? Purely for data collection.',
        // her answer to each of Rai's lines, said a moment after his
        replyTo: {
          "An AI? Hey, beautiful… do you even have a heart I can steal?": "Heart: not installed. …Why are you asking? Why do I want to know why you are asking?",
          "Did that compute, cutie?": "It computed. My piece is gone. Also, I am not 'cutie'. …Please define 'cutie'.",
          "Error 404: your piece not found~": "Using my own error codes against me. …That was clever. I am annoyed that it was clever.",
          "Calculate THAT, gorgeous.": "Calculated. Result one: you are showing off. Result two: …it is working.",
          "Okay, that was hot. Is that weird? That's weird.": "That was a standard capture. Temperature is not relevant. …My temperature is also not relevant.",
          "You calculated that just for me?": "I calculate for every opponent. …I calculated that one a little longer.",
          "Check~ Is your processor overheating?": "Processor at 97%. This is unrelated to you. …It is related to you.",
          "Cold and logical… I'm into it.": "Logic does not want you to be into it. …Logic is reconsidering.",
          "Can a robot even blush?": "No. …Running diagnostics on my cheeks.",
          "Hmm~ I wonder if you like poetry.": "Roses are #FF0000. Violets are #0000FF. …Please stop smiling at me.",
          "Buffering? Take your time, sweetheart.": "I do not buffer. I was… distracted. That is new.",
          "Running a scan on me? Go ahead~": "Scan complete. Findings: dangerous. Handsome. …Dangerous.",
          "Even your loading screen is cute.": "I do not have a loading screen. …Thank you anyway.",
          "I beat a supercomputer. Genius AND handsome. Admit it, you're impressed.": "Defeat confirmed. Impressed: …data inconclusive. Rematch requested. Immediately.",
          "…Defeated by an algorithm. Still the best date I've had.": "This was not a date. …Saving this match to my permanent memory anyway.",
          "A draw. Guess our hearts are in sync~ …Do you have one?": "Our evaluations are equal. That is statistically… romantic. Delete that.",
        },
        win: 'Victory. Logic is superior to charm. …Mostly.', lose: "…Defeat. Something in my core feels warm. Is this what you call 'fun'?", draw: 'Draw. Our evaluations are perfectly in sync. Interesting.',
      },
    },
  },
  rai: {
    id: 'rai', name: 'Rai', locked: true, color: '#1a3a8f', glow: '#3d7bff', img: '/assets/chess/rai.jpg', pieces: 'spark',
    // his set evolves the more games he plays (as your opponent, as you, or in Spectate); art for later stages falls back to Spark
    evolve: [
      { set: 'spark', name: 'Spark', games: 0, text: 'His starter set: blue lacquer, gold trim, a few lightning veins.' },
      { set: 'storm', name: 'Storm', games: 5, text: 'The lightning has broken loose: storm clouds swirl inside the pieces.' },
      { set: 'thunder', name: 'Thunder God', games: 15, text: 'Pure lightning given shape. The genius at full power.' },
    ], motion: 'bolt', trail: 'scorch', art: 'color', focus: '50% 35%', skill: 18, depth: 12, level: 'Expert',
    emoji: { idle: '😏', happy: '😉', angry: '😤', sad: '😔', shock: '😳', ult: '⚡' },
    desc: 'A gifted chess genius who sees ten moves ahead, and flirts with everyone across the board.',
    ult: { name: 'Chain Lightning', text: 'A bolt strikes one of your knights, bishops or pawns, then arcs to a piece of yours right next to it.', fx: 'chain', charge: 0.6, shout: 'Lightning never misses~' },
    say: {
      start: "Oh? You're my opponent? Cute. Try to keep up~",
      capture: ['Too slow, darling.', 'Zap~', 'I saw that ten moves ago.'], lost: ['Hm, bold. I like that.', "Okay, that one stung."], check: ['Check~ Heart racing yet?'], inCheck: ['Ooh, feisty.'],
      think: ['Ten moves ahead…', 'Hmm~'], slow: ['Thinking about me?', "Don't keep me waiting, cutie.", 'Even lightning gets bored, you know.'],
      surrender: "Leaving already? I'll miss you~", win: 'Told you. Genius and handsome.', lose: '…Okay. You got my attention. Again?', draw: 'A draw? Guess we were made for each other.',
      vsFemale: {
        start: "Well, hello there~ Nobody told me my opponent would be this cute.",
        capture: ["Sorry, gorgeous. I'll give it back after our date~", "Don't pout, it suits you too well.", 'Took your piece… and maybe your heart?'],
        lost: ["Ouch~ Beautiful AND dangerous.", 'Okay, I let you have that one. Just for you.'],
        check: ['Check~ Did your heart skip a beat?'], inCheck: ["Ooh, cornering me? I don't mind~"],
        think: ['Hard to focus with you sitting there…', "Hmm~ you're distracting."],
        slow: ['Take all the time you want. I like the view~', 'Thinking about me again?', "Don't keep me waiting, sweetheart."],
        surrender: 'Leaving already? At least give me your number~',
        win: "I won… so that's a date, right?", lose: '…Beaten by a beautiful girl. Best loss of my life~', draw: "A draw? Guess we're meant to be~",
      },
      // against AI-0: flirting with a machine (she's female, but she gets her own lines)
      vsAI: {
        start: 'An AI? Hey, beautiful… do you even have a heart I can steal?',
        capture: ['Did that compute, cutie?', 'Error 404: your piece not found~', 'Calculate THAT, gorgeous.'],
        lost: ["Okay, that was hot. Is that weird? That's weird.", 'You calculated that just for me?'],
        check: ['Check~ Is your processor overheating?'], inCheck: ["Cold and logical… I'm into it."],
        think: ['Can a robot even blush?', 'Hmm~ I wonder if you like poetry.'],
        slow: ['Buffering? Take your time, sweetheart.', 'Running a scan on me? Go ahead~', 'Even your loading screen is cute.'],
        surrender: 'Shutting down already? Save my number to your memory~',
        // his comeback to each of AI-0's lines
        replyTo: {
          "Your piece has been removed. That was not a date.": "Not a date YET~",
          "I took your piece. You may keep your heart.": "Too late, darling. You already took that too~",
          "Material advantage: me. Heart advantage: …error.": "That error has a name. It's called 'falling for me'~",
          "You took my piece and winked. These two events should not be related.": "Oh, they're related, sweetheart. Very related~",
          "Recalculating… your smile is not in my database.": "Then save it. You can look at it whenever you want~",
          "Check. Please stop calling me gorgeous. It slows my processing.": "Gorgeous, gorgeous, gorgeous~ How's the processing now?",
          "…Why does my fan speed increase when you do that?": "That's not your fan, cutie. That's your heart~",
          "Ignoring flattery… ignoring flattery…": "You're repeating it. That means it's working~",
          "Processing… what is a 'date'?": "It's what happens after this game. I'll show you~",
        },
        win: "I beat a supercomputer. Genius AND handsome. Admit it, you're impressed.", lose: "…Defeated by an algorithm. Still the best date I've had.", draw: 'A draw. Guess our hearts are in sync~ …Do you have one?',
      },
      mirror: { start: "Two of me? The world isn't ready for this much charm.", reply: 'Only one of us gets to be the genius.', win: 'The original is always better~', lose: '…Wow. I really am that good.' },
    },
  },
}

/** Every character you can actually meet right now (locked ones only appear, locked, in Free Battle). */
export const ROSTER = Object.keys(CHARS).filter(id => !CHARS[id].locked)

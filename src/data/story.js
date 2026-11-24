/* Story mode: the Bizarre Chess tournament. You play as your own character (male or female, with the name you
   chose); Ren is your rival from the first day, turning up between matches until you finally face him.
   Each chapter has an intro scene, then the duel, then a win or lose scene.
   Lines are { who, text, face? }: `face` (optional) picks one of that character's `moods` portraits for the line. `who` is a character id, 'player' (you), or 'narrator'. `{name}` is replaced by your name.
   `set` is the piece set you play that chapter with. Your pieces change as you climb:
   plain bone (chapters 1-3) → dark (4-6, once you stop holding back) → awakened, a set of your own (7-10). */
export const SETS = {
  bone: { name: 'Bone', text: 'A plain, worn set. Every newcomer starts with one.' },
  dark: { name: 'Dark', text: 'The bone has blackened, cracked through like burnt stone. You have stopped holding back.' },
  awakened: { name: 'Awakened', text: 'Your pieces are no longer borrowed. They answer to you alone.' },
}

export const CHAPTERS = [
  {
    id: 'mio', title: 'The Café Girl', set: 'bone',
    intro: [
      { who: 'narrator', text: 'Every year, the Bizarre Chess tournament draws the strangest players in the city.' },
      { who: 'narrator', text: '{name} signed up with nothing but a worn set of bone pieces.' },
      { who: 'ren', text: "Bone pieces. A beginner's set. …You won't last three rounds." },
      { who: 'player', text: "Then watch round one." },
      { who: 'narrator', text: 'The first match is in a small café on the edge of town.' },
      { who: 'mio', text: "Oh! You're {name}? My first opponent! I'm Mio. I play fast and loose, so don't blink!" },
      { who: 'mio', text: "If I win, you're buying the next round of cake. Deal?" },
    ],
    win: [
      { who: 'mio', text: "Aww… you're really good. Okay, okay, I'll buy the cake." },
      { who: 'mio', text: "Next is Haru, in the greenhouse. He's sweet… but whatever you take from him just grows back." },
    ],
    lose: [
      { who: 'mio', text: "I won?! Hehe~ Come back when you're ready, {name}. I'll save you a seat!" },
    ],
  },
  {
    id: 'haru', title: 'The Gardener', set: 'bone',
    intro: [
      { who: 'narrator', text: 'A glass greenhouse, warm and green. Vines curl around an old chessboard.' },
      { who: 'haru', text: "Oh! You're {name}, the one Mio told me about. I'm Haru. I… I take care of things here." },
      { who: 'haru', text: "If you take my pieces, I'll just help them grow back. Is that okay? Let's play." },
    ],
    win: [
      { who: 'haru', text: "You won… That's okay. Losing is how seeds learn to grow." },
      { who: 'haru', text: "Kaito is next. Please be careful. He's so loud the flowers shake." },
    ],
    lose: [
      { who: 'haru', text: "I won? Um… thank you for playing, {name}. Come back when you've grown a little!" },
    ],
  },
  {
    id: 'kaito', title: 'The Golden Rebel', set: 'bone',
    intro: [
      { who: 'narrator', text: 'An underground hall, loud with cheering. A boy in a loosened tie is standing on a table.' },
      { who: 'kaito', text: "YO! You're the newbie who beat Mio AND Haru? Then you're worth my time!" },
      { who: 'kaito', text: "Here's the deal: I crown my pawns, I crush your king. Simple!" },
      { who: 'kaito', text: '…Bone pieces, huh? Cute. Mine are solid gold.' },
    ],
    win: [
      { who: 'kaito', text: "Ugh… fine! You got me. But one day I'll grab that crown for real." },
      { who: 'ren', text: 'Three rounds. …I miscounted. It will not happen again.' },
      { who: 'kaito', text: "Next up is Jun. Don't bet against him… he cheats with luck itself." },
    ],
    lose: [
      { who: 'kaito', text: 'HA! Told you! Go cool off and come back for round two!' },
    ],
  },
  {
    id: 'jun', title: 'The Gambler', set: 'dark',
    intro: [
      { who: 'narrator', text: "That night, {name} couldn't sleep, replaying every match, every wasted move, every piece let go too easily." },
      { who: 'narrator', text: 'By morning, the bone pieces had turned black, cracked through like burnt stone.' },
      { who: 'player', text: "…So this is what happens when I stop holding back." },
      { who: 'narrator', text: 'A smoky back room. Dice rattle across green felt. Someone deals {name} a seat.' },
      { who: 'jun', text: "Well, well. The newcomer everyone's betting on. Nice set… it wasn't that colour yesterday, was it?" },
      { who: 'jun', text: "One roll of my dice can wreck your whole board… or mine. That's what makes it fun!" },
      { who: 'jun', text: "My big sister says gambling is beneath our family. That's exactly why I love it." },
    ],
    win: [
      { who: 'jun', text: "You beat the odds. Ha! I'd bet on you myself next time." },
      { who: 'jun', text: "Yuki's next. She never gambles. She just waits for you to slip." },
      { who: 'jun', text: "And if you get past her… you'll meet my sister, Sena. Tell her I said hi. She'll hate that." },
    ],
    lose: [
      { who: 'jun', text: 'The house always wins! Buy back in whenever you like.' },
    ],
  },
  {
    id: 'yuki', title: 'The Patient Frost', set: 'dark',
    intro: [
      { who: 'narrator', text: 'Snow falls past a tall library window. Someone has been waiting here for a long time.' },
      { who: 'yuki', text: "So you're {name}. Sit. Let's play quietly." },
      { who: 'yuki', text: "I don't rush. I wait… for the one mistake you'll make." },
    ],
    win: [
      { who: 'yuki', text: "You didn't make it. The mistake. …You played beautifully." },
      { who: 'yuki', text: 'Sena is next. She guards the way to the final table. She does not lose. She does not even consider it.' },
      { who: 'yuki', text: 'And at the final table… my sister, Noa. We were born minutes apart, but she plays with people, not pieces. Be careful.' },
    ],
    lose: [
      { who: 'yuki', text: "There it was. Your mistake. Come back when you've found it." },
    ],
  },
  {
    id: 'sena', title: 'The Glass Noble', set: 'dark',
    intro: [
      { who: 'narrator', text: 'A palace hall of blue glass. Every reflection shows a girl on a throne.' },
      { who: 'sena', text: 'So the commoner with the burnt pieces climbed this high. I am Sena. You may kneel.' },
      { who: 'player', text: 'Your brother says hi.' },
      { who: 'sena', text: '…Jun lost to you, then. Of course he did. He bets; I do not. Sit.' },
    ],
    win: [
      { who: 'sena', text: '…You have earned my attention. Do not waste it.' },
      { who: 'sena', text: "Noa waits at the final table. Even I don't play with her. Whatever you do… don't let her pull your strings." },
      { who: 'sena', text: '…And do not tell Jun about this. He will never let me forget it.' },
    ],
    lose: [
      { who: 'sena', text: 'As it should be. Return when you are worthy of this hall.' },
    ],
  },
  {
    id: 'noa', title: 'The Puppeteer', set: 'awakened',
    intro: [
      { who: 'ren', text: "Six wins. You've stopped surprising me, {name}. Now you just annoy me." },
      { who: 'ren', text: 'Win this one. Then you play me. No one else gets to beat you.' },
      { who: 'narrator', text: 'Walking into the theatre, {name} feels the dark pieces shift in their box, as if waking.' },
      { who: 'narrator', text: 'On the board, they are no longer burnt stone. They are something new, and entirely their own.' },
      { who: 'player', text: '…These are mine now.' },
      { who: 'noa', text: "There you are. I've watched you climb every step… like a marionette on its way to the stage." },
      { who: 'noa', text: "My sister let you through? Yuki always was the gentle one. I'm the twin who pulls the strings." },
    ],
    win: [
      { who: 'noa', text: 'You cut every string… How remarkable.' },
      { who: 'noa', text: 'Ren is waiting for you in the clock tower. He has been waiting since the first day.' },
    ],
    lose: [
      { who: 'noa', text: "Every piece was always mine. Come back, little puppet. I'll be waiting." },
    ],
  },
  {
    id: 'ren', title: 'The Rival', set: 'awakened',
    intro: [
      { who: 'narrator', text: 'A clock tower. Every gear turns in perfect time. Ren is already seated.' },
      { who: 'ren', text: 'Since the café, I have calculated every game you played. Every mistake. Every lucky move.' },
      { who: 'ren', text: "I have seen every move you'll make, {name}. Show me what you've got." },
      { who: 'player', text: "You calculated the bone set. You didn't calculate this one." },
    ],
    win: [
      { who: 'ren', text: '…Impressive. I underestimated you. That won\'t happen twice.' },
      { who: 'ren', text: "But this tournament is wrong. Noa's strings, Sena's guard… someone arranged all of it." },
      { who: 'ren', text: 'Go. Find out who. And then come back, so I can beat you properly.' },
    ],
    lose: [
      { who: 'ren', text: 'As expected. Recalculate, and try again.' },
    ],
  },
  /* ---- act two: the people behind the tournament ---- */
  {
    id: 'shion', title: 'The Poisoned Smile', set: 'awakened',
    intro: [
      { who: 'narrator', text: 'The theatre lights die. Someone claps slowly in the dark, a glass vial swinging from one finger.' },
      { who: 'shion', text: "Congratulations, {name}~ Too bad the tournament was never real." },
      { who: 'shion', text: "Kyo built this whole table to find the strongest player… and break them. I'm just here to soften you up~" },
    ],
    win: [
      { who: 'shion', text: 'Ahaha… you actually cured all of it. Kyo is going to love you.' },
      { who: 'shion', text: "He's waiting at the real final table. Don't keep the king waiting~" },
    ],
    lose: [
      { who: 'shion', text: "Shh, shh… let the poison work. Come back when you've built some immunity~" },
    ],
  },
  {
    id: 'kyo', title: 'The Black King', set: 'awakened',
    intro: [
      { who: 'narrator', text: 'Beneath the city, a hall of black iron. Chains hang from the ceiling over a single board.' },
      { who: 'kyo', text: 'So you are the piece that refused to fall.' },
      { who: 'kyo', text: 'Every rival you beat was mine. Every move you made, I allowed. Now kneel… or break.' },
      { who: 'player', text: 'My pieces stopped being yours a long time ago.' },
    ],
    win: [
      { who: 'kyo', face: 'hopeless', text: '…I will have my revenge.' },
      { who: 'narrator', text: 'The crack in his mask spreads. Pieces of it fall away onto the board.' },
      { who: 'kyo', face: 'hopeless', text: 'Then the board is yours, {name}. Play well. I will be watching.' },
    ],
    lose: [
      { who: 'kyo', text: 'As every piece before you. Back into the box.' },
    ],
  },
]

export const ENDING = [
  { who: 'narrator', text: "The chains fall from the ceiling one by one. Kyo's mask lies cracked on the board." },
  { who: 'shion', text: 'Ehh?! You beat HIM? …I think I like you even more now~' },
  { who: 'narrator', text: 'Upstairs, the theatre lights come back on. Everyone is waiting.' },
  { who: 'mio', text: "{name}!! You did it!! Cake's on me. Again." },
  { who: 'haru', text: 'You did it… the whole garden is cheering for you.' },
  { who: 'kaito', text: "Champion, huh? Enjoy it while it lasts. I'm coming for that crown!" },
  { who: 'jun', text: "Called it! I had all my chips on you from the start. Right, sis?" },
  { who: 'sena', text: 'Do not call me that in public. …Hmph. I suppose you may call yourself champion. For one year.' },
  { who: 'yuki', text: '…Congratulations. The snow feels quieter tonight.' },
  { who: 'noa', text: "No strings on you anymore. Next year, then. Yuki and I will weave something new." },
  { who: 'kyo', face: 'hopeless', text: 'Enjoy your crown, champion. Every king falls eventually.' },
  { who: 'ren', text: 'Champion. …Fine. Enjoy it. Next year, I will have calculated you.' },
  { who: 'player', text: "Next year, I'll be waiting, Ren." },
  { who: 'narrator', text: 'Thank you for playing Bizarre Chess.' },
]

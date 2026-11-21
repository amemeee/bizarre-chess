/* Story mode: the Bizarre Chess tournament, one chapter per rival, in order.
   Each chapter has an intro scene, then the duel, then a win or lose scene.
   Lines are { who, text }: `who` is a character id, or 'narrator'. */
export const CHAPTERS = [
  {
    id: 'mio', title: 'The Café Girl',
    intro: [
      { who: 'narrator', text: 'Every year, the Bizarre Chess tournament draws the strangest players in the city.' },
      { who: 'narrator', text: 'Rumour says its final table belongs to a puppeteer, and that no one who sits there leaves quite the same.' },
      { who: 'narrator', text: 'Your first match is in a small café on the edge of town.' },
      { who: 'mio', text: "Oh! You're my first opponent? Yay! I'm Mio. I play fast and loose, so don't blink!" },
      { who: 'mio', text: "If I win, you're buying the next round of cake. Deal?" },
    ],
    win: [
      { who: 'mio', text: "Aww… you're really good. Okay, okay, I'll buy the cake." },
      { who: 'mio', text: "Hey, be careful with Kaito next. He's loud, he's reckless… and he never stops charging." },
    ],
    lose: [
      { who: 'mio', text: "I won?! Hehe~ Come back when you're ready. I'll save you a seat!" },
    ],
  },
  {
    id: 'kaito', title: 'The Golden Rebel',
    intro: [
      { who: 'narrator', text: 'An underground hall, loud with cheering. A boy in a loosened tie is standing on a table.' },
      { who: 'kaito', text: "YO! You beat Mio? Then you're worth my time!" },
      { who: 'kaito', text: "Here's the deal: I crown my pawns, I crush your king. Simple!" },
    ],
    win: [
      { who: 'kaito', text: "Ugh… fine! You got me. But one day I'll grab that crown for real." },
      { who: 'kaito', text: "Next is Yuki. She's quiet. Too quiet. Don't let her wait you out." },
    ],
    lose: [
      { who: 'kaito', text: 'HA! Told you! Go cool off and come back for round two!' },
    ],
  },
  {
    id: 'yuki', title: 'The Patient Frost',
    intro: [
      { who: 'narrator', text: 'Snow falls past a tall library window. Someone has been waiting here for a long time.' },
      { who: 'yuki', text: "So you're the one climbing the table. Sit. Let's play quietly." },
      { who: 'yuki', text: "I don't rush. I wait… for the one mistake you'll make." },
    ],
    win: [
      { who: 'yuki', text: "You didn't make it. The mistake. …You played beautifully." },
      { who: 'yuki', text: "Ren is next. He has already calculated how you'll lose. Prove him wrong." },
    ],
    lose: [
      { who: 'yuki', text: "There it was. Your mistake. Come back when you've found it." },
    ],
  },
  {
    id: 'ren', title: 'The Clockwork Strategist',
    intro: [
      { who: 'narrator', text: 'A clock tower. Every gear turns in perfect time.' },
      { who: 'ren', text: "Four matches. Statistically, you shouldn't have made it this far." },
      { who: 'ren', text: "I've seen every move you'll make. Show me what you've got." },
    ],
    win: [
      { who: 'ren', text: "…Impressive. I underestimated you. That won't happen twice." },
      { who: 'ren', text: "Noa is waiting at the final table. Whatever you do… don't let her pull your strings." },
    ],
    lose: [
      { who: 'ren', text: 'As expected. Recalculate, and try again.' },
    ],
  },
  {
    id: 'noa', title: 'The Puppeteer',
    intro: [
      { who: 'narrator', text: 'The final table stands in an empty theatre. Violet threads glint in the dark.' },
      { who: 'noa', text: "There you are. I've watched you climb every step… like a marionette on its way to the stage." },
      { who: 'noa', text: 'Shall we begin? I already know how this ends.' },
    ],
    win: [
      { who: 'noa', text: 'You cut every string… How remarkable.' },
      { who: 'noa', text: 'Then the final table is yours. For now.' },
    ],
    lose: [
      { who: 'noa', text: "Every piece was always mine. Come back, little puppet. I'll be waiting." },
    ],
  },
]

export const ENDING = [
  { who: 'narrator', text: 'The theatre lights come up. The threads fall slack.' },
  { who: 'mio', text: "You did it!! Cake's on me. Again." },
  { who: 'kaito', text: "Champion, huh? Enjoy it while it lasts. I'm coming for that crown!" },
  { who: 'yuki', text: '…Congratulations. The snow feels quieter tonight.' },
  { who: 'ren', text: "A result I didn't predict. Well played." },
  { who: 'noa', text: "Next year, then. I'll weave something new." },
  { who: 'narrator', text: 'Thank you for playing Bizarre Chess.' },
]

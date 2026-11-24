/* Each set's pieces talk like their owner (and look like their set).
   Per owner: lines by mood (afraid, nervous, panic, shock, proud, smug, sleepy, cheer, sad, dying),
   `hover` lines by mood for when the pointer rests on one of their pieces (`idle` is the fallback),
   and `types` for a few lines only one kind of piece says.
   Anything missing falls back to the shared lines in pieceLines.js. */
export const VOICES = {
  /* You: Ivory Bone. Loyal skeleton soldiers in bone armour, with a dry sense of humour. */
  you: {
    afraid: ["I've already died once, I'd rather not again!", 'My bones are rattling!', 'Cover me, I have no skin in this!'],
    nervous: ['I feel it in my marrow…', 'Steady… steady…', "This doesn't feel right in my bones."],
    panic: ['To the king! Bones to the king!', 'Shield the crown!', 'Rally! RALLY!'],
    shock: ['Spirits preserve us!', 'What sorcery is that?!'],
    proud: ['Bone-crushing.', 'Another one for the ossuary.', 'Rest in pieces.'],
    smug: ['I have a bone to pick with you.', 'Nothing gets under my skin. I have none.', 'Steel nerves. Bone, actually.'],
    sleepy: ['Resting… in peace…', 'Wake me for the charge…', '*creak*'],
    cheer: ['For the Bone Crown!', 'Victory, eternal!', 'We stand! Well, most of us.'],
    sad: ['Back to the crypt…', 'We fought well.', 'Not our finest hour.'],
    dying: ['Back to dust…', 'I regret… only my posture.', 'Bury me with my sword!', 'Not my good bones!'],
    hover: {
      idle: ['Orders, commander?', 'At your command, bones and all.', 'Point the way.', 'Ready to serve.'],
      afraid: ['Commander, please, not that square!', 'I can feel them watching!'],
      panic: ['MOVE ME, COMMANDER!'],
      proud: ['Send me again!', 'Who is next for the crypt?'],
      sleepy: ["I'm up! I'm up! …Were we marching?"],
    },
    types: {
      k: { panic: ['My mask! Protect the mask!'], cheer: ['Long live the Bone Crown!'] },
      q: { proud: ['Kneel before your queen.'], dying: ['My armour… has failed me…'] },
      p: { afraid: ['Just a little skeleton here!'], proud: ['Small bones, big bite!'] },
      n: { proud: ['The bone steed rides!'] },
    },
  },

  /* Mio: Ember. Bright, bubbly café pieces with candles, cake and pink fire. */
  mio: {
    afraid: ['Eek! Too hot, too hot!', "Don't burn me, I'm still baking!", 'Not me, I just got here!'],
    nervous: ['Uh-oh, my candle is flickering…', 'Is something burning? Oh, me.', 'Hehe… stay calm…'],
    panic: ['The king is on fire! Not the fun kind!', 'Everyone, help!! Pretty please!', 'Fire drill! FIRE DRILL!'],
    shock: ['Whaaat?!', 'Somebody spilled the hot chocolate!'],
    proud: ['Order up!', 'Fresh out of the oven!', 'Served hot!', 'Yummy!'],
    smug: ['Too sweet to lose~', 'Cute AND dangerous!', "Want a slice? You'll have to catch me!"],
    sleepy: ['Sugar crash…', 'Five more minutes in the warm oven…', 'Mmh… cake…'],
    cheer: ['Party time!!', 'Cake for everyone!', 'We did it, yay!!'],
    sad: ['My candle went out…', 'Aww…', 'No dessert today…'],
    dying: ['My frosting!', 'Puff!', "Save me a slice…", 'I was so sweet!'],
    hover: {
      idle: ['Hi hi!', 'Want something sweet?', 'Careful, I sparkle!', 'Hehe~'],
      afraid: ['Not me! Pick someone less cute!'],
      proud: ['Next one, coming right up!'],
      smug: ['Bet you can\'t catch me~'],
    },
    types: {
      k: { panic: ['My candles! My crown candles!'] },
      q: { proud: ['The queen of the café!'], smug: ['Ribbon and fire, darling.'] },
      p: { proud: ['Small but spicy!'], dying: ['My little candle…'] },
      n: { proud: ['Gallop gallop, hot hot!'] },
    },
  },

  /* Haru: Living Wood. Gentle, polite tree pieces that grow back. */
  haru: {
    afraid: ['Please don\'t prune me…', "I'm only a sapling!", 'My leaves are shaking…'],
    nervous: ['Root yourself… root yourself…', 'Is it autumn already?', 'Oh dear…'],
    panic: ['The heartwood is in danger!', 'Everyone, grow faster!', 'Protect the old tree!'],
    shock: ['Goodness!', 'What a storm!'],
    proud: ['Sorry! It had to be done.', 'A little pruning.', 'Nature takes its course.'],
    smug: ['Slow and steady grows the forest.', 'I have deep roots.', 'I can wait. Trees are patient.'],
    sleepy: ['Photosynthesizing…', 'Mm… sunlight…', 'Just… soaking… up… rain…'],
    cheer: ['We bloomed!', 'Spring is here!', 'Thank you, everyone!'],
    sad: ['We\'ll grow back.', 'Winter came early.', 'A seed for next time.'],
    dying: ['I\'ll grow back…', 'Plant me somewhere nice…', 'Return to the soil…', 'Leaf me be…'],
    hover: {
      idle: ['Oh, hello.', 'Mind the roots.', 'Lovely weather.', 'I\'m growing.'],
      afraid: ['P-please be gentle…'],
      proud: ['Sorry about that, by the way.'],
      sleepy: ['Hm? Oh, I was just growing.'],
    },
    types: {
      k: { panic: ['My blossom! Protect the blossom!'], cheer: ['The old tree stands!'] },
      p: { afraid: ["I'm just a little seed!"], proud: ['Even seeds can win!'] },
      b: { smug: ['Still in bud. For now.'] },
      r: { sleepy: ['Hollow and happy…'] },
    },
  },

  /* Kaito: Golden Crown. Loud, reckless, over-the-top gold. */
  kaito: {
    afraid: ['WHOA WHOA WHOA!', 'Hey! Not the gold!', 'Okay, okay, maybe retreat?!'],
    nervous: ["I'm fine! I'm FINE!", 'Totally not sweating gold here…', 'Heh… heh…'],
    panic: ['PROTECT THE CROWN!! IT\'S EXPENSIVE!!', 'EVERYBODY CHARGE!!', 'NOT LIKE THIS!!'],
    shock: ['WHAT?!', 'NO WAY!'],
    proud: ['TOO SLOW!', 'YEAH! GOLD MEDAL!', 'GET WRECKED!', 'HA! Next!'],
    smug: ['Pure gold, baby.', 'Shiny AND strong!', 'Try and stop me!'],
    sleepy: ['Charging up… zzz…', 'Five more minutes then FULL SPEED…'],
    cheer: ['WE ARE THE CHAMPIONS!', 'GOLD! GOLD! GOLD!', 'TOLD YOU!'],
    sad: ['Tarnished…', 'Aw, man…', 'Rematch. NOW.'],
    dying: ['I WAS SOLID GOLD!', 'Worth it!', 'Avenge me, LOUDLY!', 'Not my shine!'],
    hover: {
      idle: ['YO!', 'Hands off the gold!', 'Ready to charge!', 'You want some?!'],
      afraid: ["D-don't touch me, I'm expensive!"],
      proud: ['Who\'s NEXT?!'],
      smug: ['Bet you wish YOU were gold.'],
    },
    types: {
      k: { panic: ['MY CROWN! IT\'S REAL GOLD!'], cheer: ['ALL HAIL KING ME!'] },
      q: { proud: ['Long live the queen! ME!'] },
      p: { proud: ['Watch me become a QUEEN!'] },
    },
  },

  /* Jun: High Roller. Casino-chip pieces who talk in bets and odds. */
  jun: {
    afraid: ['Bad odds, bad odds!', 'I fold! I FOLD!', "I'm not betting on me right now…"],
    nervous: ['The house is getting nervous…', 'Feeling unlucky…', "Don't look at my hand…"],
    panic: ['Protect the jackpot!', "Somebody call security!", 'We\'re about to go bust!'],
    shock: ['Snake eyes?!', 'Who rigged this table?!'],
    proud: ['Jackpot!', 'House wins!', 'Cash out!', 'Read \'em and weep!'],
    smug: ['I like these odds.', 'Place your bets.', 'Lady Luck likes me better.'],
    sleepy: ['Slow night at the table…', 'Wake me when the stakes go up…'],
    cheer: ['Big win! BIG WIN!', 'Drinks on the house!', 'The house always wins!'],
    sad: ['Busted…', 'Lost the pot.', 'Can I buy back in?'],
    dying: ['Cashed out…', 'Bad beat!', 'I went all in…', 'Snake eyes…'],
    hover: {
      idle: ['Feeling lucky?', 'Care to wager?', 'Odds are in my favour.', 'Shuffle up.'],
      afraid: ['Hey, I\'m not part of the bet!'],
      proud: ['Double or nothing?'],
      smug: ['You can\'t bluff me.'],
    },
    types: {
      k: { panic: ['Not the high roller!'], cheer: ['The house wins it all!'] },
      p: { afraid: ['I\'m just a single chip!'], proud: ['Roll the dice, baby!'] },
      n: { proud: ['Dark horse wins!'] },
    },
  },

  /* Yuki: Glacier. Calm, quiet, cold. */
  yuki: {
    afraid: ['I might crack…', 'It\'s getting warm…', 'Please… stay cool.'],
    nervous: ['A thaw is coming…', 'Hold still. Breathe.', 'Calm… calm…'],
    panic: ['The king is melting!', 'Freeze them! Quickly!', 'Hold the line… hold the ice…'],
    shock: ['…Oh.', 'That was cold.'],
    proud: ['Shatter.', 'Chill out.', 'Frozen solid.', 'On ice.'],
    smug: ['Patience is a cold thing.', 'I can wait all winter.', 'You will slip.'],
    sleepy: ['Hibernating…', 'So… quiet…', 'Snow falls…'],
    cheer: ['A perfect winter.', 'Quietly, we win.', 'Snowfall of victory.'],
    sad: ['Melted…', 'Spring always comes.', 'Mm.'],
    dying: ['Melting…', 'I cracked…', 'Spring came too soon…', 'Just water now…'],
    hover: {
      idle: ['…', 'Cold, isn\'t it?', 'Quiet, please.', 'I am waiting.'],
      afraid: ['Don\'t… touch… I\'ll crack.'],
      proud: ['Next.'],
      smug: ['Your mistake is coming.'],
    },
    types: {
      k: { panic: ['My crown is thawing!'], cheer: ['The glacier stands.'] },
      q: { smug: ['Ice queen. Literally.'] },
      p: { afraid: ["I'm just a snowflake!"] },
    },
  },

  /* Ren: Clockwork. Precise, ticking, calculating. */
  ren: {
    afraid: ['Miscalculation detected.', 'This was not in the schedule.', 'Tick-tick-tick-tick!'],
    nervous: ['Timing is off…', 'Recalculating…', 'A gear is slipping.'],
    panic: ['Critical failure! Protect the mainspring!', 'All gears to the king!', 'Time is running out!'],
    shock: ['Time anomaly!', 'That was… unscheduled.'],
    proud: ['Calculated.', 'Right on schedule.', 'Precision.', 'Tick. Done.'],
    smug: ['I have already seen this move.', 'Every second is accounted for.', 'Predictable.'],
    sleepy: ['Tick… tock…', 'Power saving…', 'Winding down…'],
    cheer: ['Perfect timing.', 'As calculated.', 'Clockwork victory.'],
    sad: ['Out of time.', 'A rounding error.', 'Recalibrating.'],
    dying: ['My gears…', 'Time… stops…', 'Unwinding…', 'Out of time…'],
    hover: {
      idle: ['Tick.', 'On schedule.', 'Do not touch the gears.', 'Calculating…'],
      afraid: ['Your hand is not in my calculations.'],
      proud: ['Next target acquired.'],
      smug: ['I already know your move.'],
    },
    types: {
      k: { panic: ['The mainspring! Protect the mainspring!'], cheer: ['Time is mine.'] },
      p: { proud: ['A small gear, a big turn.'] },
      n: { proud: ['Calculated leap.'] },
    },
  },

  /* Sena: Shattered Glass. Proud, cold nobility; fragile, and furious about it. */
  sena: {
    afraid: ['Unhand me, peasant!', 'Do you know what I am worth?!', 'Fragile? How DARE you.'],
    nervous: ['I am not cracking. I am… textured.', 'Mind your manners.', 'This is beneath me.'],
    panic: ['Guards! GUARDS!', 'Protect Her Majesty\'s king!', 'Unacceptable! Unacceptable!'],
    shock: ['How vulgar!', 'Scandalous!'],
    proud: ['Removed.', 'How common.', 'Kneel.', 'Know your place.'],
    smug: ['You may admire me from afar.', 'Polished. Unlike you.', 'Flawless.'],
    sleepy: ['How tedious…', 'Wake me when someone worthy arrives.'],
    cheer: ['As it should be.', 'Victory suits us.', 'Naturally.'],
    sad: ['Shattered…', 'How… humiliating.', 'This never happened.'],
    dying: ['How DARE you!', 'I… shatter…', 'Sweep up the pieces, servant…', 'Unforgivable…'],
    hover: {
      idle: ['Do not touch.', 'You may look.', 'Fingerprints. Ugh.', 'Hmph.'],
      afraid: ['Away from me, commoner!'],
      proud: ['Who is next to kneel?'],
      smug: ['Mirror, mirror… it\'s me.'],
    },
    types: {
      k: { panic: ['My crown is CRACKING!'], cheer: ['The glass throne stands!'] },
      q: { smug: ['A real queen. Unlike yours.'], dying: ['Even glass queens fall…'] },
      p: { afraid: ["I'm crystal! Not cheap glass!"] },
    },
  },

  /* Shion: Venom. Giggling poison vials and thorned glass, sweet and cruel. */
  shion: {
    afraid: ["Don't shake me, I'll spill!", 'Careful, I\'m toxic!', 'Not the glass! Not the glass!'],
    nervous: ['Something is bubbling…', 'Hehe… I feel woozy…', 'Is the cork loose?'],
    panic: ['Protect the queen vial!', 'Everyone, hold your breath!', 'The king is leaking!'],
    shock: ['Who swapped the labels?!', 'Antidote?! Where?!'],
    proud: ['Sweet dreams~', 'One drop is enough.', 'Mm, delicious.', 'Taste test complete~'],
    smug: ['I smell fear. It smells sweet.', 'Go on. Take a sip.', 'You look a little pale~'],
    sleepy: ['Fermenting… zzz…', 'Let it… steep…'],
    cheer: ['A perfect brew!', 'Toast! Poison for everyone~', 'Ahaha, we win~'],
    sad: ['The brew went flat…', 'Spilled…', 'Diluted.'],
    dying: ['Spilled…', 'Shattered, how rude~', 'Hehe… poisoned you anyway…', 'Fizzle…'],
    hover: {
      idle: ['Thirsty?', 'Smell this~', "Don't drink me.", 'Hehe~'],
      afraid: ['Touch me and you\'ll regret it… probably.'],
      proud: ['Next sample, please~'],
      smug: ["You're already poisoned. You just don't know it."],
    },
    types: {
      k: { panic: ['My antidote! WHERE IS MY ANTIDOTE?!'], cheer: ['Long live the poison king~'] },
      q: { smug: ['The deadliest dose.'] },
      p: { afraid: ["I'm just a little drop!"], proud: ['Small dose, big effect~'] },
    },
  },

  /* Kyo: Black Iron. Heavy chained pieces of a tyrant; few words, all of them orders. */
  kyo: {
    afraid: ['The chains… are slipping.', 'Hold. HOLD.', 'Do not fall.'],
    nervous: ['The iron is cold…', 'Steady.', 'Silence.'],
    panic: ['Chain the gates!', 'Defend the Black King!', 'No piece leaves the board alive!'],
    shock: ['Impossible.', '…What?'],
    proud: ['Kneel.', 'Into the box.', 'Removed.', 'Chained.'],
    smug: ['You move because we allow it.', 'Every square is ours.', 'Iron does not bend.'],
    sleepy: ['…', 'The chains rest.'],
    cheer: ['The board is ours.', 'All pieces kneel.', 'Dominion.'],
    sad: ['Broken chains…', 'Rust.', '…'],
    dying: ['The chain… breaks…', 'Iron… rusts…', 'Remember… the Black King…', 'Unchained…'],
    hover: {
      idle: ['Kneel.', 'You are being watched.', 'Do not touch the iron.', '…'],
      afraid: ['Away.'],
      proud: ['Who kneels next?'],
      smug: ['Your pieces were always ours.'],
    },
    types: {
      k: { panic: ['The Black King does not fall!'], cheer: ['Bow to the Black King.'] },
      q: { proud: ['Chained and broken.'] },
      p: { proud: ['Even iron pawns crush.'] },
    },
  },

  /* Noa: Marionette. Eerie, giggling puppets on strings. */
  noa: {
    afraid: ['The strings are pulling me…', "I don't want to dance!", 'Who is holding my strings?'],
    nervous: ['She is watching…', 'My strings feel tight…', 'Hehe… heh…'],
    panic: ['Cut the strings! CUT THEM!', 'The stage is collapsing!', 'Not the king\'s strings!'],
    shock: ['A new act?!', 'The curtain moved…'],
    proud: ['Dance with me.', 'One more puppet.', 'Strings attached.', 'Join the show.'],
    smug: ['Everyone dances eventually.', 'I see your strings too.', 'The show must go on.'],
    sleepy: ['Hanging around…', 'Strings… slack…', 'Waiting for my cue…'],
    cheer: ['Bravo! Bravo!', 'Encore!', 'The final curtain is ours.'],
    sad: ['The show is over…', 'Strings cut…', 'Curtain.'],
    dying: ['My strings…', 'Curtain call…', 'Exit, stage left…', 'Hehe… cut…'],
    hover: {
      idle: ['Hehe…', 'Do you see the strings?', 'Dance with us.', 'Shh… the show.'],
      afraid: ["Don't pull. Please don't pull."],
      proud: ['Who wants to be a puppet next?'],
      smug: ['Your pieces will dance for her too.'],
    },
    types: {
      k: { panic: ['Who is pulling MY strings?!'], cheer: ['The puppet king reigns!'] },
      q: { smug: ['She moves me. I move you.'] },
      p: { afraid: ['Little puppet, little strings!'] },
    },
  },
}

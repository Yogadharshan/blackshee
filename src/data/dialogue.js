// All spoken lines, keyed. Easy to edit in the final minutes.
// [speaker, ...] where speaker is a name string or null to reuse last.
export const DIALOGUE = {
  elder: [
    ['Elder Sheep', 'Welcome, little one. You have a strange quiet about you.'],
    ['Elder Sheep', 'The Old Shrine has been silent for years. It waits for five Memories.'],
    ['Elder Sheep', 'The Old Bell. The Red Flower. The Wooden Toy. The Old Ribbon. The Photograph.'],
    ['Elder Sheep', 'Bring all five home. Then the seal breaks.'],
    ['Elder Sheep', 'I would tell you more, but I mostly remember grass.'],
  ],
  elder_after: [
    ['Elder Sheep', 'Still waiting. Finish what you started.'],
  ],
  baabara: [
    ['Baaabara', 'The flowers. The FLOWERS. They are the color of the sun and I cannot have them.'],
    ['Baaabara', 'Bring me three flowers. Not four. Not two. THREE. I will... treasure them.'],
  ],
  baabara_need: [
    ['Baaabara', 'Three flowers. Still missing one or two. The universe tests me.'],
  ],
  baabara_done: [
    ['Baaabara', 'Oh. Oh, they are PERFECT. You understand me.'],
    ['Baaabara', 'Here. Take this one. It was never mine to keep.'],
    ['Baaabara', 'A Red Flower. Someone used to leave flowers like this on that fence.'],
    ['Baaabara', 'I do not know who. I only know the fence looked emptier after.'],
    ['Baaabara', 'I keep it because forgetting feels worse. You should carry it instead.'],
    ['Baaabara', 'Also, it is a flower, not a snack. I have lost three.'],
  ],
  baabara_after: [
    ['Baaabara', 'The flowers are watered. I watered them. ...Do not look at the water level.'],
  ],
  rock: [
    ['Rock Sheep', 'Do you see my rock? My very important rock. It is THE rock.'],
    ['Rock Sheep', 'It went missing. Find it. It is unmistakably, vitally, legally a rock.'],
  ],
  rock_after: [
    ['Rock Sheep', 'You found it! My rock! ...Odd. It is a slightly different rock.'],
    ['Rock Sheep', 'I will not think about this further. Thank you, friend.'],
  ],
  lonely: [
    ['Lonely Sheep', 'Everyone walks around me. They do not mean it. Probably.'],
    ['Lonely Sheep', 'You are the only one who stopped. Thank you.'],
    ['Lonely Sheep', 'I heard the shrine hums when you get close. That means something. Probably.'],
  ],
  farm: [
    ['Farm Sheep', 'My friend Bo peeped and then vanished into the trees. Classic Bo.'],
    ['Farm Sheep', 'He is hiding behind the tree line, I can FEEL it. Make him come out.'],
  ],
  farm_after: [
    ['Farm Sheep', 'You talked to him?! He said hi back? I am SO moved.'],
  ],
  bo: [
    ['Bo', 'Oh no. I have been found.'],
    ['Bo', 'Baaaaah. Fine. I will go back. Tell them I was... checking the perimeter.'],
  ],
  meadow: [
    ['Meadow Sheep', 'The grass tastes better over this fence. It always does.'],
    ['Meadow Sheep', 'I miss someone. I am not sure who.'],
    ['Meadow Sheep', 'I graze here anyway. In case.'],
  ],
  suspicious: [
    ['Suspicious Sheep', 'The village is watching you. No. I am watching you. No.'],
    ['Suspicious Sheep', 'The gate to the shrine is as sealed as my feelings.'],
  ],
  suspicious_secret: [
    ['Suspicious Sheep', 'Oh, that tree down south?'],
    ['Suspicious Sheep', 'There is nothing behind it.'],
    ['Suspicious Sheep', '...'],
    ['Suspicious Sheep', 'Definitely nothing. Do not both stand near it. Especially not together. All at once.'],
  ],
  // --- The five Memories -------------------------------------------------
  // Shape per beat: ordinary object -> a recollection -> uncertainty -> the
  // player forms the meaning -> one small comedy beat. No theme statements,
  // no names, no family, nothing legendary. See story_beats.js for the stages.
  memory_bell: [
    ['', 'An Old Bell. Chipped, quiet, far too small to be important.'],
    ['', 'It sits on a shelf. Someone still dusts it.'],
    ['', '"I think that belonged to someone," a sheep remembers. Then frowns.'],
    ['', '"Or maybe it was a spoon. No. A bell. Definitely a bell."'],
    ['', 'Nobody can say who. Only that the shelf is always clean.'],
  ],
  memory_toy: [
    ['', 'A Wooden Toy. Lopsided. Hand-cut. One corner chewed smooth.'],
    ['', '"Somebody made that," a sheep says. "For a lamb who is not here now."'],
    ['', '"They made it wrong," another insists. "The wheels never turned."'],
    ['', '"The wheels turned fine," the first says. "You remember it wrong."'],
    ['', 'Neither of them backs down. The toy says nothing.'],
    ['', 'It is, on reflection, an excellent toy.'],
  ],
  memory_ribbon: [
    ['', 'An Old Ribbon. Faded. Tied once, maybe. Kept, certainly.'],
    ['', 'Someone wore it somewhere that mattered. Nobody agrees where.'],
    ['', '"Someone tied a ribbon to the fence every spring," a sheep remembers.'],
    ['', '"No," says another. "That was a different ribbon. ...Probably."'],
    ['', 'It is not on the fence now. Someone put it here instead.'],
    ['', 'You wonder how many springs passed before anyone noticed.'],
  ],
  memory_photo: [
    ['', 'A Photograph. Bent at one corner, held together by habit.'],
    ['', 'A row of sheep, squinting into the sun. One is half out of frame.'],
    ['', 'At the edge: a small bell, a ribbon, a flower. Arranged, not accidental.'],
    ['', 'The half-out-of-frame sheep looks ordinary. Bored, even.'],
    ['', 'Like someone who never guessed they would be the one kept.'],
    ['', 'It is a bad photograph. It is the best thing you have found.'],
  ],
  memory_flower_reward: [
    ['', 'You received the Red Flower.'],
    ['', 'It smells like a garden someone else kept.'],
  ],
  // --- Distributed NPC recollections of Baa (Phase 3) --------------------
  // One fragment per NPC (see data/npc_fragments.js): object, habit, helped,
  // place, incorrect. Ordinary, unnamed, no family. The player assembles Baa.
  frag_object: [
    ['Rock Sheep', '...Wait. Before the rock. Someone gave me a thing once.'],
    ['Rock Sheep', 'A little carved bird. Lopsided. They seemed proud of it.'],
    ['Rock Sheep', 'I do not remember the face. I remember the bird was terrible.'],
  ],
  frag_habit: [
    ['Meadow Sheep', 'Someone used to stand at that fence every evening. Just watching.'],
    ['Meadow Sheep', 'We never spoke. They seemed busy being curious at nothing.'],
    ['Meadow Sheep', 'Sometimes the low light made one shape look like two.'],
    ['Meadow Sheep', 'Probably just the light. I never asked.'],
  ],
  frag_helped: [
    ['Lonely Sheep', 'Someone sat with me once. When everyone else walked around me.'],
    ['Lonely Sheep', 'They did not say anything. They just stayed until it was better.'],
    ['Lonely Sheep', 'I cannot remember their face. Only that I stopped feeling see-through.'],
  ],
  frag_place: [
    ['Farm Sheep', 'This fence kept falling down. Nobody ever fixed it.'],
    ['Farm Sheep', 'Then one morning it was up. No note. No one taking credit.'],
    ['Farm Sheep', 'I have always assumed it was the wind. The wind here is very capable.'],
  ],
  frag_incorrect: [
    ['Suspicious Sheep', 'That fence? They fixed it. I watched them do it myself.'],
    ['Suspicious Sheep', 'It was a Tuesday. Or winter. One of those.'],
    ['Suspicious Sheep', 'Do not let anyone tell you it was the wind. That is a lie sheep tell.'],
  ],
  flower_pickup: [['', 'A flower. It does not know it was picked yet.']],
  rock_pickup: [['', 'A rock. A very important rock. Extremely. Legally.']],
  gate_sealed: [['', 'The shrine is still sealed. Something is missing.']],
  gate_open: [['', 'The seal is gone. The shrine is open.']],
  shrine_altar: [
    ['', 'The five Memories rest at the altar. The shrine remembers them all.'],
    ['', 'A voice, softer than wool: "You are different. You always were.'] ,
    ['', '"That was never something to fix. It was something to find."'],
  ],
  // Phase 4 — the Forgotten Baa. Recognition before explanation; the five
  // Memories are the anchors, the Photograph carries the weight, the family
  // line stays minimal. PROVISIONAL wording (handout §10 "exact wording is not
  // locked"): the recognition beats come from the handout, adapted to singular
  // so no twin/plural clue is introduced here. No stage-5/twin beat fires.
  baa_encounter: [
    ['', 'The five Memories rest at the altar, and the air goes very still.'],
    ['THE FORGOTTEN BAA', 'WHO ARE YOU?'],
    ['', 'The voice is old and tired. It does not sound like a monster.'],
    ['THE FORGOTTEN BAA', 'The bell...'],
    ['THE FORGOTTEN BAA', 'The flower...'],
    ['THE FORGOTTEN BAA', 'The toy...'],
    ['THE FORGOTTEN BAA', 'The ribbon.'],
    ['THE FORGOTTEN BAA', '...The photograph.'],
    ['', 'The half-out-of-frame sheep. You have carried that photograph a while now.'],
    ['', 'The voice goes quiet for a long time.'],
    ['THE FORGOTTEN BAA', '...You came back.'],
    ['', 'You do not understand yet. Something in your chest does.'],
    ['THE FORGOTTEN BAA', '...your wool.'],
    ['THE FORGOTTEN BAA', 'My grandchild.'],
    ['', 'For a while, nothing is said. The shrine lets it stay quiet.'],
  ],
  // Phase 5 — the quiet aftermath. ONE piece of evidence (a cropped detail in
  // the Photograph the player already carries), no explanation. PROVISIONAL
  // wording: it deliberately says nothing about who/where/why, and never uses
  // the words "twin", "brother", "sister" or "another Black Sheep" directly.
  // Fired only after the recognition beat above is complete.
  baa_reveal: [
    ['THE FORGOTTEN BAA', '...Wait.'],
    ['', 'The voice has stopped looking at you. It is looking past you.'],
    ['', 'You lift the photograph again. At the very edge, half cropped away,'],
    ['', 'there is a second shape. Dark wool, like yours.'],
    ['', 'You have looked at this photograph many times. You never saw it.'],
    ['', 'The voice says nothing more. Whatever it knows, it keeps.'],
  ],
  // --- Phase 6 immediate consequences (one per option) -------------------
  // Small, authored, equal in reward, never good/evil. PROVISIONAL wording:
  // the design lock supplies intent, not final prose (design lock §15).
  choice_flowers_careful: [
    ['Baaabara', 'You carried them the long way. You set them down like they mattered.'],
    ['Baaabara', '...I noticed. I notice everything. It is my whole personality.'],
  ],
  choice_flowers_efficient: [
    ['Baaabara', 'Efficient. Three flowers. Delivered.'],
    ['Baaabara', 'They are still the right color, so I will allow it.'],
  ],
  choice_friend_search: [
    ['Farm Sheep', 'Thank you. Really. Nobody else even looked up.'],
    ['Farm Sheep', 'Bo is going to be so embarrassed. Good.'],
  ],
  choice_friend_question: [
    ['Farm Sheep', '...Huh.'],
    ['Farm Sheep', 'I had not thought about it like that. Give me a minute.'],
  ],
  choice_rock_respect: [
    ['Rock Sheep', 'Exactly.'],
  ],
  choice_rock_practical: [
    ['Rock Sheep', 'Yes. It is a rock.'],
  ],
  choice_memory_investigate: [
    ['', 'The corner is worn differently from the rest. Rubbed thin, the way a thumb keeps returning.'],
  ],
  choice_memory_move_on: [
    ['', 'The photograph goes back into your things.'],
  ],
  // --- Phase 6 later callbacks (two choices, design lock §9) -------------
  farm_callback_search: [
    ['Farm Sheep', 'You really do not give up easily, do you?'],
  ],
  farm_callback_question: [
    ['Farm Sheep', 'I have been thinking about what you said. About Bo.'],
  ],
  rock_callback_respect: [
    ['Rock Sheep', 'You came back for it. Because I said it mattered.'],
  ],
  rock_callback_practical: [
    ['Rock Sheep', 'You brought it back anyway. For a rock.'],
  ],
  ending: [
    ['', 'The black sheep stands before the shrine, finally not alone with being different.'],
    ['', 'Somewhere, a bell does not ring. A ribbon holds its color. A photograph stays smiling.'],
  ],
  sign1: [['Sign', 'DO NOT ENTER.']],
  sign2: [['Sign', 'You already read this.']],
  sign3: [['Sign', 'Why are you doing this?']],
  sign4: [['Sign', '...']],
  sign5: [['Sign', 'Fine. One day these sheep will learn to read. It is not today.']],
  hidden: [
    ['Hidden Sheep', 'You found the place nobody was supposed to look.'],
    ['Hidden Sheep', 'Please do not tell the judges.'],
    ['Hidden Sheep', 'Take this dust as a souvenir. It is plot dust. Very valuable.'],
  ],
  mountkeeper: [
    ['Mount Keeper', 'Every great adventurer needs a mount.'],
    ['Mount Keeper', 'We have sheep.'],
    ['Mount Keeper', "You're a sheep."],
    ['Mount Keeper', 'Please do not overthink this.'],
    ['Mount Keeper', 'Go speak to the Elder first. A hero needs a quest. Then come back for your steed.'],
  ],
  mountkeeper_gift: [
    ['Mount Keeper', 'Ah, a REAL hero of legend! Or at least: a sheep with a quest.'],
    ['Mount Keeper', 'Excellent. THIS is the Mount Sheep™. It is also a sheep.'],
    ['Mount Keeper', 'Get on its back. Do not unpack that sentence.'],
    ['Mount Keeper', 'Press M to mount. It looks at the world from up there.'],
  ],
  mountkeeper_after: [
    ['Mount Keeper', 'The Mount Sheep™ looks up to you. Metaphorically. Mostly.'],
  ],
  tree1: [['Tree', "It's a tree."]],
  tree2: [['Tree', 'Still a tree.']],
  tree3: [['Tree', 'You are becoming very familiar with this tree.']],
  tree_reveal: [['', '*rustle*'], ['', 'A hidden path appeared.']],
  tree_open: [['Tree', 'The way is open. There was definitely nothing here before.']],
  sixth1: [
    ['The Sheep Who Knows Too Much', 'Oh.'],
    ['The Sheep Who Knows Too Much', 'You found this.'],
    ['The Sheep Who Knows Too Much', "That's inconvenient."],
  ],
  sixth2: [['The Sheep Who Knows Too Much', 'Please leave.']],
  sixth3: [['The Sheep Who Knows Too Much', "I'm serious."]],
  sixth4: [['The Sheep Who Knows Too Much', 'Fine. Do you want the thing or not?']],
  sixth_grant: [
    ['The Sheep Who Knows Too Much', 'Here. Take it. It caused all the weirdness.'],
    ['THE SIXTH MEMORY.', 'This memory has not happened yet.'],
    ['', 'Do not ask what that means. I do not know either.'],
  ],
  sixth_after: [['The Sheep Who Knows Too Much', 'You already have it. Congratulations. Please go.']],
  shrine_altar_six: [
    ['', 'The five Memories rest at the altar. Five.'],
    ['', 'A voice, quieter now: "...why do you have six?"'],
    ['', 'A pause. "That was not supposed to happen."'],
    ['', 'The voice softens: "Then again, neither were you."'],
  ],
};
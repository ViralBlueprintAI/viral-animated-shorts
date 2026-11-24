# Sound effect prompts (ElevenLabs Sound Effects, model v2)

Generated in the user's own ElevenLabs account in Chrome (Sound Effects > prompt box; duration fixed, "Auto" off).
Every prompt gives 4 variants; download the 2 best as WAV 48 kHz, then pick with `python audio/sfx_hits.py sfx/`.
Short, concrete prompts work best: the object, the action, the surface, "no music, no voices" for ambiences.

The Dancing Plague used these (name = file name in `example/cues.json`, kept variant in brackets):

2.5 s
- gavel: Single loud wooden gavel bang on a heavy oak table in a stone council hall, short and punchy (2.0 s) [1, 2]
- doors: Heavy double wooden doors are thrown open and bang against stone walls in a medieval hall (1.0 s) [1]
- boil: Liquid in a glass flask suddenly boils violently, fast bubbling and a sharp hiss of steam, cartoon [2]
- sting: Cartoon comedic dramatic sting: one short low orchestral hit with a timpani boom [1]
- coins: A heavy leather purse full of gold coins lands in a hand, coins jingle and clink [2]
- sack: Heavy grain sack dropped onto cobblestones, dull soft thud [1, 2]
- hammer: Single carpenter hammer strike on a wooden plank, sharp knock [1, 2] (cut single strikes out of the take)
- boom: Fast rising whoosh into a deep cinematic boom impact [2 short rise, 3 long rise]
- fall: Cartoon person collapses and falls flat onto cobblestones, soft body thud and a little dizzy twinkle [2]
- stomach: Loud hungry stomach growl, cartoon [1]
- cough: Sick tired man coughs weakly two times [2]
- yawn: A tired man yawning loudly and slowly [1, 2]
- creak: Old wooden front door creaks and swings open quickly [2]
- gasp: A small group of old men gasp in shock at the same time [1]
- whoosh: Fast cartoon whoosh transition [1 slow, 2 fast]
- puff: Short cartoon steam puff pop [2]
- pop: Short soft cartoon bubble pop, character appears [1]

3 s
- clock: Fast ticking clock, time passing quickly [2]
- crane: Slow airy whoosh rising like wind [1]
- curse: Evil magic curse swirl, eerie glittering shimmer with a whoosh and low rumble [2]

4 s
- ominous: Deep ominous low drone swell, dark legend, horror rumble [1]
- bell: Single ring of a small chapel bell in the countryside, warm, long tail [2]
- torch: Burning torches crackling at night [2]

6 s
- clog: One person dancing a fast jig in wooden shoes on cobblestones, tapping and shuffling, no music [1]
- steps: A small group of people walking slowly on a dirt road, calm footsteps, no voices [2]

8 s
- crowd: Large crowd dancing and stomping their feet on cobblestones in a town square, shuffling, no music, no voices [1, 2]
- night: Quiet medieval town at night, crickets, distant dog bark, no voices [1]

How to choose what gets a sound (the viral-short way):
- Every cut that moves in time or place: a whoosh, its peak on the cut.
- Every key word that lands a fact or a joke: an impact (boom, sting, gavel) exactly on the word.
- Every prop action you see: its foley (purse lands, sack drops, hammer hits, door opens, flask boils).
- Every scene: one quiet ambience bed (crowd, torches, night, footsteps) far under the voice.
- Comedy beats get cartoon sounds (stomach growl, pop, puff, yawn). Keep it sparse around the narrator's best lines.

---
name: viral-animated-shorts
description: Make a 55-75 s vertical animated history/story short in the viral "2D cartoon cast in a colourful 3D ink world" style (bean-head cards, painted 3D town with black ink lines, lens blur, gliding cameras, interiors, deep-blue nights with lit windows), voiced with ElevenLabs and rendered in the browser with three.js. Use when the user asks for an animated short, a cartoon history short, "a video like the dancing plague short", or says "use the viral animated shorts skill".
---

# Viral animated shorts (2D cast, 3D ink world)

Worked example: **The Dancing Plague** (Strasbourg 1518), 72 s, 35 shots. Its full source is in `engine/src/` (the `s_*.ts`
files are the story; everything else is the engine). Start every new short by copying the example and replacing the story.

Rules that always apply:
- Story, script, characters and voice are always the user's own. Study the look of viral shorts, never copy their scripts,
  characters, shots or frames, and never name a reference channel in the video, title or description.
- English voice-over, no on-screen captions unless the user asks.
- Every fact in the script is checked against a source before the voice is made. The jokes are true facts.
- The user approves the script before the voice is generated, and approves the stills before the final render.

## Pipeline

### 1. Story
- One true, little-known story with a paradox you can say in one sentence ("A city tried to stop a dancing plague by
  hiring a band."). If it does not fit one sentence, pick another.
- It must be visual: people doing things, cause and effect you can show. Write the facts and sources at the top of
  `example/script.md` style notes.

### 2. Script (measured on the 11 newest viral shorts in this style, Nov 2026)
1. **Hook** (0-3 s): the paradox stated as fact. No intro.
2. **"You see,"** within 3-9 s (7 of 11 shorts), then straight into the scene: place, a named everyman, what is going on.
   Do NOT save "You see" for the explanation at the end; that was the most common mistake in our first draft.
3. **Escalation**, 4-6 beats: every attempt to fix it makes it worse. Short in-character lines, one or two deadpan jokes.
4. **Mystery question** at about 40 s ("So what was making a whole city dance?").
5. **The real reason**, about 15 s, starting with "Well, ..." and one everyday comparison ("the same way one yawn
   spreads across a room").
6. **Ironic last line**; the video ends on its last word.
- About 220 words for 70 s. Plain spoken English, contractions, sentences around 13 words.
- `references/you_see_timeline.png` shows the measurement.

### 3. Voice
- ElevenLabs text to speech, one storytelling voice, Eleven v4, stability ~50, similarity ~75. Generate in the user's own
  browser account and download the mp3.
- Cut only true silences (gaps > 0.25 s down to ~0.2 s), then `atempo=1.05`. Never speed up the whole read more than 5 %.
- Word timings: `python audio/align.py voice_final.wav words.json` (faster-whisper). Whisper can be 0.4 s off on single
  words: check every word you key an animation to against the waveform (`python audio/envelope.py voice_final.wav 28 30`).
- To change one sentence later, regenerate it with the sentence before and after as context, cut it out at the pauses and
  splice it in at the same place (`audio/splice.py`). The rest of the timing, and all shots, stay as they are.
- To replace the WHOLE voice after the short is built (new plan, new voice, better take), generate a new full read of the
  same text and run `python audio/realign.py words.json voice_final.wav new_read.mp3 voice_new.wav --tempo 1.05`. It cuts
  the new read at the shared pauses, takes the phrase edges from the waveform and stretches every phrase onto its old
  place (tested: phrases within ~10 ms, stretch 0.96-1.12). No shot needs re-timing; still check the keyed words.

### 4. Shot plan and continuity (write this BEFORE any code)
- A new shot every 2-3 s, a hard cut only on big jumps (place or time), everything else glides.
- Every sentence is illustrated literally. Props carry the joke (the purse flies to the band on "hire musicians").
- **Continuity table**: for every shot write location, time of day, who is there and what they hold. A scene that moves
  into a room stays in that room until the story leaves it (council calls the doctors -> verdict -> cure all happen in
  the chamber; only then cut to the market where the decision is carried out). Characters never jump between places
  without a cut that motivates it.
- Visual reactions land 0-3 frames before their word.

### 5. Build (engine/src)
- `s_story.ts`: shot list (`L`), cameras (`CAMS`), crossfades, flash, kicks (impact shakes), lens table (`DOF`).
- `s_world.ts`: the town (houses, hero buildings, props), light per shot, the night windows.
- `s_rooms.ts`: interiors. Build them 200 m under the map (`RY`) so nothing of the town reaches their shots. Shells do
  not cast shadows, furniture does; windows are bright emissive panes with additive light shafts.
- `s_cast.ts`: who stands where, doing what, per shot (cards, crowds, effects). `s_people.ts`: outfits.
- Engine files (`toon.ts` characters, `build.ts`, `paint.ts`, `cast.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`, `lights.ts`)
  are shared; change them only for new poses, faces or looks.

Composition rules that made the biggest difference:
- Characters BIG in frame. Medium shots with 2-3 characters reacting to each other beat wide shots of one small figure.
- Never film a flat facade square-on behind the cast; angle along the street or the building so it recedes.
- Use interiors for private or official moments (a family at a bare table, a council chamber).
- A shocked bystander in the foreground (over the shoulder) sells a reaction better than a wide shot.
- Night is deep royal blue with warm light sources: about half the windows lit, lantern and candle pools. A night frame
  needs highlights (p98 luma >= 0.85); a flat lavender night means the light sources are missing.
- Vertical frames are narrow (horizontal FOV ~ 0.56 x vertical): check that everyone you need is inside the frame.
- Billboard cards seen from below fill the frame: for feet or legs use a long lens (fov ~26) from 3-4 m.
- Inserts for key objects: a flask, an empty bowl, a purse. Draw them as effect cards (`fxFlaskHot`, `fxPurse`).

### 6. Review like a director
- Stills, two per shot: `python engine/stills.py 0.4 <frames> out/still_` and a labelled contact sheet.
- Lay them next to contact sheets of viral shorts you studied (keep those private). Write a numbered fix list per shot
  (framing, acting, continuity, light, timing) and fix it before any full render.
- Measure, do not guess: luma mean/std/p2/p98 and saturation per frame (`scripts/stats.py`).

### 7. Music, sound effects and mix
- ONE continuous instrumental track under the whole short, no song changes. ElevenLabs Music, 1:20, instrumental,
  prompt in `audio/music_prompt.txt`. Make two versions and keep the one with the steadiest level.
- Real sound effects, generated in the user's ElevenLabs account (Sound Effects, model v2, "Auto" duration off):
  - Write the cue list from the shot plan and `words.json`: a whoosh on every time/place jump (its peak on the cut),
    an impact on every key word (boom, sting, gavel), foley for every prop action you show (purse lands, sack drops,
    door opens, flask boils), cartoon sounds on comedy beats (stomach growl, pop, yawn), one quiet ambience per scene.
  - One short, concrete prompt per sound (`audio/sfx_prompts.md` has all 27 we used). 2.5 s for hits, 3-4 s for
    swells, 6-8 s for ambiences. Each prompt gives 4 variants; keep the best 2 as WAV 48 kHz.
  - `python audio/sfx_hits.py sfx/` prints length, peak, onsets and level of every file and draws a spectrogram sheet:
    pick the variant whose shape fits (one clean hit, one rise into one impact, a steady bed) and note its hit time.
  - Write `cues.json` (see `example/cues.json`, 78 cues): sample, time, its hit point, level in dB against the narrator.
    Levels that sound like the viral shorts: key impacts -1..-6 LU under the voice, foley -8..-12, whooshes -10..-12,
    small sounds -12..-15, ambiences -15..-25.
- `python audio/sfxmix.py cues.json`: music 10 LU under the voice and ducked while he talks, ambiences ducked less,
  effects barely ducked so impacts stay punchy, master to -14 LUFS with a -1 dB true peak (stereo).
- Licence check before publishing: on the ElevenLabs free plan the voice, music and effects are not licensed for
  commercial use and need "elevenlabs.io" credited in the title; a paid plan removes both limits. Tell the user.

### 8. Render
- Preview in any sandbox: `python engine/render.py 0.4 0 2180 out/prev 8801` (software GPU, ~1 h for 72 s with two
  processes; resumable). Pin a copy of `public/` (`PUBDIR=...`) while you keep editing.
- Final on a machine with Chrome and a GPU: `npm install && npm run build && node render.mjs --audio ../mix_final.wav --name my_short`
  (1080 x 1920; about 2 minutes for 72 s on an Apple M5 Pro, longer on older machines).
- QA: no missing, black or frozen frames; the flash frame is pure white; then mux with the master.

## Look values (engine defaults)
- Day: sun 128 deg from the lens axis, elevation 46, warm lit / cool shade. Golden: low backlight, peach sky, violet shade.
  Night: lit [0.4, 0.55, 1.3], shade [0.07, 0.09, 0.3], saturation 1.25, royal-blue sky, lit windows.
- Ink ~3 px at 1080 on the world, plum ink on the cards. Lens blur 8-16 px on medium and close shots, none on wides.
- Camera: smootherstep glides of 18-40 frames, every hold creeps in 0.15-0.35 %/frame, punch-ins on key words, impact
  kicks that flip every frame and die in 7 frames, rolls of 2-4 deg.
- Characters: ~3.5 head heights, bean heads, stick limbs, dot hands, blinks every 0.5-2.3 s, breathing idle.

## Gotchas
- WebGL context loss gives black frames: the canvas pool keeps only small drawings; the render scripts reload on loss.
- Houses that block a camera are left out automatically (sight lines); interiors are built with the sight test off.
- Changing the voice after the shots are timed: splice sentences in at the pauses instead of regenerating the whole read.
- Effects keyed to words drift if you key them to an unchecked transcript; always check against the waveform.
- Chrome blocks a site's second, third ... download until the user allows "multiple downloads" (icon at the right of the
  address bar). Ask the user to allow it for elevenlabs.io, or download one file per page load.

## Files
- `engine/` the browser engine and the example story (`src/s_*.ts`), render and stills scripts.
- `audio/` alignment, waveform check, splice, re-voicing (`realign.py`), sound effect prompts and analysis, the mixer
  (`sfxmix.py`), music prompt.
- `example/` script, word timings, shot/continuity table and the sound cue sheet of The Dancing Plague.
- `references/` our measured style notes and charts (numbers only, no frames of other channels).
- `LICENSE` MIT.

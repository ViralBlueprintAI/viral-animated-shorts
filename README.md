# Viral Animated Shorts - a free Claude skill

Make 55-75 second vertical animated story shorts in the viral style: flat 2D cartoon characters in a colourful 3D
world with black ink outlines, lens blur, gliding cameras, interiors, deep-blue nights with glowing windows, a narrator
and one continuous music track. Everything is rendered in your browser with three.js. No AI video generator.

Worked example: **The Dancing Plague** (Strasbourg 1518), 72 s, 35 shots, made for the Viral Blueprint AI tutorial
"How to Make Viral Animated Shorts With Claude (Full Workflow)".

## What's inside
- `SKILL.md`: the full workflow (story, script formula, voice, continuity table, build, director review, music, render)
  with every rule and number we measured.
- `engine/`: the browser engine plus the example story (`src/s_*.ts`), the Chrome/GPU render script and a headless
  preview renderer.
- `audio/`: word alignment, a waveform checker, sentence splicing, re-voicing a finished short without re-timing it,
  the sound effect prompts and analysis, and the mixer
  (one music track + real sound effects under the voice, -14 LUFS).
- `example/`: the final script with sources, the shot/continuity table and the sound cue sheet (`cues.json`).
- `references/`: our measurement of where "You see," lands in viral shorts, and other numbers.

## Install
1. Copy this folder to `~/.claude/skills/viral-animated-shorts/` (clone it there or unzip it).
2. Install Node 18+, Google Chrome, Python 3 and ffmpeg, then `pip install faster-whisper soundfile pyloudnorm scipy matplotlib`.
3. In `engine/`: `npm install` then `npm run build`.
4. In Claude Code: "Use the viral animated shorts skill and make a short about ...".

You need an ElevenLabs account for the voice, the music and the sound effects. Claude prepares the text and prompts; you
generate and download them in your own browser. On the free plan ElevenLabs output may not be used commercially and must
credit "elevenlabs.io" in the title; check the current terms before you publish.

## Render
- Quick preview (any machine): `python engine/render.py 0.4 0 2180 out/prev 8801`
- Final 1080 x 1920 with your GPU: `cd engine && node render.mjs --audio ../mix_final.wav --name my_short`

## License
MIT, see `LICENSE`. Kenney props are CC0. Story, script, characters and voice of your shorts should always be your own.

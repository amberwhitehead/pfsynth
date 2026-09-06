# Little piano

A Vite + TypeScript piano demo using pfsynth's partial and attack algorithms.

```sh
npm ci
npm run dev
```

Enable sound, then click/touch the keys or play with A W S E D F T G Y H U J K O L P ;.
Space holds sustain; the Sustain button latches it. Arrow keys change octave.
Touch sets strike velocity. Volume changes output gain. Leaving the page releases all notes.

`npm run build` type-checks and creates `dist/`. Serve over HTTPS or localhost
for AudioWorklet support. Node 22.18+ is recommended for Vite; the parity test
uses Node's `--experimental-transform-types` support (tested with Node 24).

### Single-file deployment

The production build emits only `dist/index.html`. JavaScript, CSS, the audio
worklet, the fitted piano parameters, and the MIT license are embedded in it.
It uses system fonts and makes no external asset requests. Upload that one
file to a static HTTPS host. Vite's development server retains separate source
modules for hot reload; `single-file.mjs` bundles the deployment after Vite builds.

## Audio

`src/engine.ts` ports `pf_partial.c` and `pf_attack.c`. It retains all 64
partial slots (with Nyquist cutoff), the fitted Salamander C1–C8 patch,
two velocity layers, stretched tuning, inharmonicity, detuned unisons,
log-interpolated envelopes, the attack resonator bank and filtered noise,
and the continuous sustain damper. The browser host uses 24 voices,
quiet/released voice stealing, a 24-second tail limit and a tanh output
limiter. Una corda and sostenuto are not exposed in this small demo.

Envelope decay uses exponential recurrences between control points,
re-anchored at each block, to avoid a power calculation per partial per sample.
The engine runs in an AudioWorklet; the production site uses no WebAssembly.

`public/salamander.bin` contains fitted parameters, not audio samples.
`src/attack.json` is the original fitted attack data. The native sources in
`vendor/` are retained only as a reproducible comparison reference.

## Verification

```sh
npm test
```

Compares the TypeScript output against the included C reference compiled to
WebAssembly at 44.1 and 48 kHz, across bass, middle and high notes, multiple
velocities, release and sustain. Also checks finite/bounded output, silence
after panic, 24-voice allocation and continuous half-pedal damping.
Rebuild the reference with `npm run build:reference` (Clang and wasm-ld required).
No native compiler is needed to run or build the website.

## Attribution

pfsynth: Copyright © 2026 John O'Laughlin, MIT (see `public/LICENSE.txt`).
Tonal parameters measured from Alexander Holm's Salamander Grand Piano
(CC BY 3.0); attack parameters fitted to Pianoteq 6 (Modartt).
No third-party recordings are redistributed. The original pfsynth source is
preserved outside this demo directory.

## Performance update

The browser host now budgets 12 active voices plus at most two short steal fades.
Released notes fade out after 350 ms without sustain; retirement fades last 40 ms.
Sustained/held voices have a six-second lifetime, also ending with a fade.
This prevents the original damper's quiet residual from consuming the audio
thread for 24 seconds. The partial oscillator loop uses scalar state and the
voice list compacts in place. Tone parity tests cover the initial 550 ms;
separate regression tests cover the intentionally shorter tails.

## How the web part fits together

- `src/main.ts` builds the keyboard and handles mouse, touch, and key events.
  Enable sound creates an `AudioContext` after a user gesture. Each pressed
  key gets an ID so its release stops the right voice. Sliders keep accepting
  note shortcuts while focused; their arrow keys still adjust their values.
- `src/piano-worklet.ts` receives note-on, note-off, sustain, and panic messages
  on the audio thread. It asks `src/engine.ts` to fill each audio block.
- The output passes through a volume gain and an analyser to the speakers.
  The analyser supplies the little waveform display; drawing runs separately
  from audio synthesis.
- `src/fur-elise.ts` contains a short arrangement of Beethoven's opening and
  a cancellable timer-based player. **Ctrl+F** enables audio and starts it;
  Ctrl+F again or Escape stops it. This shortcut replaces browser Find while
  the page has focus. Notes use the same engine and key highlights as manual
  playing. Switching away cancels playback and releases every note.
- `npm run build` checks TypeScript, runs Vite, then runs `single-file.mjs`.
  That last step embeds the worklet, parameter data, scripts, styles, and
  license in `dist/index.html`. Only that HTML file needs deploying.

Use `npm run dev` while editing and `npm test` to check synthesis and voice
cleanup. The current voice limits are in **Performance update** above; the
earlier Audio section describes the original, longer-lived voice settings.

## Latest upstream sync

See [SYNC.md](SYNC.md) for the 2026-09-06 audit against upstream `3c12586`,
the ported restrike/limiter/treble fixes, current behavior, intentional
differences, and verification commands. `node native/check-sync.mjs` detects
changes to the audited upstream files and fitted data. The live output uses
the peak limiter with a 50 ms hold, not the older tanh mentioned above; the
current patch has 30 anchors spanning A0–C8. Live attack trims vary by note.

## Demo shortcuts

- **Ctrl+F**: Für Elise opening.
- **Ctrl+B**: first four bars of Bach's Prelude in C major, BWV 846.
- Press the same shortcut again or **Escape** to stop. Press the other shortcut
  to switch songs. Switching away from the page also cancels playback.

`src/bach-prelude.ts` expands four voicings into the repeated sixteenth-note
pattern. Both songs use the same cancellable `ScorePlayer`, audio engine, and
key highlights. Ctrl+B takes precedence over the browser shortcut while the
page has focus, including when a slider is focused.

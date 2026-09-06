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

# Upstream sync — 2026-09-06

Audited against `olaugh/pfsynth` main at
`3c125864905561b2003e00fe1606c869efe559c3`, fetched during this audit.
The surrounding pfsynth checkout already contains that upstream revision.

The partial/attack C sources, headers, fitted Salamander patch, and attack
data already matched. The sole core-source difference is the intentional
32-bit `seg_end` sentinel in vendored `pf_partial.c`; retain it for wasm32.

Ported missing host fixes:

- `9714b37`: ignore duplicate attacks less than 5 ms apart, fade the previous
  voice exponentially on a real restrike, and hold limiter gain reduction
  for 50 ms before the existing 250 ms release.
- `d8847f1`: interpolate onset trims from the mid-register defaults
  (body −18, knock −22, noise −17 dB) at MIDI 82 to 0 dB at MIDI 92.
- `3c12586`: shorten fast knock modes between half the fundamental and the
  fundamental above MIDI 96, reaching 25% of their original decay at MIDI 102.

Live trims now run per note in the engine, without mutating the loaded patch.
The C reference harness supports both raw and live-trimmed comparisons.
Panic also resets limiter history so the next note starts at normal gain.

## Checks

`node native/check-sync.mjs` checks recorded SHA-256 hashes against the local
upstream files and vendored/data copies, allowing only the documented sentinel
change. Without the surrounding upstream checkout it checks the copies only.
The manifest is an audit checkpoint, not a substitute for fetching upstream.

`npm test` covers raw and live audio at 44.1/48 kHz, A0–C8 representative notes
including the trim transitions, loud-chord limiter hold, duplicate suppression,
restrikes, bounded polyphony, sustain and cleanup. C parity remains within the
0.1% relative RMS threshold (worst observed approximately 0.060%). Comparisons
end before the intentionally different normal release-tail retirement.

`npm run build:reference` rebuilds the C comparison fixture; `npm run build`
checks TypeScript and emits the self-contained `dist/index.html`.

## Intentional differences

This is a small playable TypeScript piano, not a full port of the author's
native player or `docs/` score-following app. It retains the Salamander tone,
12 active voices plus two steal fades, 350 ms release grace plus 40 ms fade,
and six-second maximum voice age. Native defaults use a Pianoteq-fitted tone
and a larger voice budget. The raw reference harness uses 24 voices, whereas
polyphony-cap tests exercise the browser's own limit.

Sympathetic resonance (`d554e39`), una corda, sostenuto, MIDI-file import,
Verovio score following, and native settings controls are not implemented
in this demo. Those are feature differences, not silently synchronized fixes.
The original source and the author's `docs/` app are unchanged by this audit.

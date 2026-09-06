import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {PianoEngine, Patch, MAX_VOICES} from '../src/engine.ts';
const patchBytes = fs.readFileSync(new URL('../public/salamander.bin', import.meta.url));
const patch = new Patch(patchBytes.buffer.slice(patchBytes.byteOffset, patchBytes.byteOffset + patchBytes.length));
const data = JSON.parse(fs.readFileSync(new URL('../src/attack.json', import.meta.url)));
// C's patch parameters are float32.
function f32(value) {return Array.isArray(value) ? value.map(f32) : typeof value === 'number' ? Math.fround(value) : value;}
const attack = Object.fromEntries(Object.entries(data).map(([key,value]) => [key, f32(value)]));
const wasm = new WebAssembly.Module(fs.readFileSync(new URL('./reference.wasm', import.meta.url)));
for (const sr of [44100, 48000]) {
  for (const [note, velocity, sustain] of [[36, .4, false], [60, 80/127, false], [69, .8, true], [96, .9, false]]) {
    const c = new WebAssembly.Instance(wasm, {env: Math}).exports; c.init(sr);
    const engine = new PianoEngine(sr, patch, attack); const output = new Float32Array(128);
    c.sustain(sustain ? 1 : 0); engine.sustain(sustain ? 1 : 0);
    c.on(1, note, velocity); engine.on(1, note, velocity);
    let err = 0, ref = 0, peak = 0;
    for (let block = 0; block < Math.ceil(sr * .55 / 128); block++) {
      if (block === 100) {c.off(1); engine.off(1);}
      if (block === 250) {c.sustain(0); engine.sustain(0);}
      const original = new Float32Array(c.memory.buffer, c.render(), 128); engine.render(output);
      for (let i = 0; i < 128; i++) {
        assert(Number.isFinite(output[i])); assert(Math.abs(output[i]) <= 1);
        err += (output[i] - original[i]) ** 2; ref += original[i] ** 2; peak = Math.max(peak, Math.abs(output[i]));
      }
    }
    const relative = Math.sqrt(err / ref);
    console.log(`${sr} Hz, MIDI ${note}, sustain ${sustain}: relative RMS error ${relative.toExponential(3)}, peak ${peak.toFixed(3)}`);
    assert(peak > .001, 'note must produce sound'); assert(relative < .001, 'port must match C within 0.1% RMS');
  }
}
const engine = new PianoEngine(48000, patch, attack), block = new Float32Array(128);
engine.on(1, NaN, .5); engine.on(1, 60, 0); assert.equal(engine.voices.length, 0);
for (let i = 0; i < 30; i++) engine.on(i, 48 + i, .6);
assert.equal(engine.voices.filter(v => !v.fading).length, MAX_VOICES);
assert(engine.voices.length <= MAX_VOICES + 2);
engine.panic(); engine.render(block); assert(block.every(x => x === 0));
engine.on(1, 60, .6); engine.sustain(1); engine.off(1); assert.equal(engine.voices[0].damping, 1);
engine.sustain(.55); assert(engine.voices[0].damping < 1); engine.panic();
for (const n of [60, 64, 67, 72, 76, 79]) engine.on(n, n, .65);
const start = performance.now(); for (let i = 0; i < 375; i++) engine.render(block);
console.log(`Six-note chord: ${(performance.now() - start).toFixed(0)} ms to render 1000 ms of audio`);
console.log('C parity, finite output, polyphony limit, panic, and half-pedal checks passed.');

// Regression: short notes must not fill the budget with near-silent residuals.
for (const sr of [44100, 48000]) {
  const e = new PianoEngine(sr, patch, attack), out = new Float32Array(128);
  const renderSeconds = seconds => {for (let i = 0; i < Math.ceil(seconds * sr / 128); i++) {e.render(out); assert(out.every(Number.isFinite));}};
  for (let i = 0; i < 40; i++) {e.on(i, 48 + i % 24, .65); renderSeconds(.03); e.off(i); renderSeconds(.03); assert(e.voices.length <= 8);}
  renderSeconds(.5); assert.equal(e.voices.length, 0, 'released notes retire promptly');
  e.sustain(1); e.on(100, 60, .7); e.off(100); renderSeconds(.6);
  assert.equal(e.voices.length, 1, 'sustain outlasts normal release');
  e.sustain(0); renderSeconds(.45); assert.equal(e.voices.length, 0, 'pedal-up retires old voices');
  e.sustain(1);
  for (let i = 0; i < 80; i++) {e.on(i, 48 + i % 24, .7); e.off(i); renderSeconds(.02); assert(e.voices.length <= MAX_VOICES + 2);}
  renderSeconds(6.1); assert.equal(e.voices.length, 0, 'sustained voices have a bounded lifetime');
  e.panic(); e.on(999, 60, .7); renderSeconds(.05); const v = e.voices[0]; v.fade();
  assert.equal(v.fadeLeft, Math.round(.04 * sr)); renderSeconds(.045); assert.equal(e.voices.length, 0);
}
console.log('Dense playing, pedal-up cleanup, sustain lifetime, and fade retirement regressions passed.');

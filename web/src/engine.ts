// Browser port of pfsynth/src/core/pf_partial.c and pf_attack.c (MIT).
// The fitted patch contains parameters, not recorded audio.
export interface AttackPatch {
  mode_hz: number[]; mode_t60: number[]; mode_db: number[]; mode_delay_ms: number[];
  pulse_ms: number; pulse_cycles: number; thump_db: number[][]; noise_db: number[][];
  noise_ms: number[][]; noise_hz: number[][]; thump_mix: number; noise_mix: number;
}
const TAU = 2 * Math.PI;
const DAMP_FLOOR = 10 ** (-45 / 20);
export const MAX_VOICES = 12;
const MAX_FADING_VOICES = 2;
const FADE_SECONDS = .04;
const TIMES = [0, .015, .04, .09, .2, .45, .9, 1.8, 3.6, 6];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const db = (x: number) => Math.pow(10, x / 20);
export class Patch {
  tuning: Float32Array;
  envelopes: Uint8Array;
  phases: Uint8Array;
  constructor(buffer: ArrayBuffer) {
    if (buffer.byteLength !== 21240) throw new Error('Invalid pfsynth patch');
    this.tuning = new Float32Array(30);
    const view = new DataView(buffer);
    for (let i = 0; i < 30; i++) this.tuning[i] = view.getFloat32(i * 4, true);
    this.envelopes = new Uint8Array(buffer, 120, 19200);
    this.phases = new Uint8Array(buffer, 19320, 1920);
  }
  envelope(anchor: number, layer: number, mode: number, point: number) {
    return this.envelopes[((anchor * 2 + layer) * 64 + mode) * 10 + point];
  }
}
class Partial {
  amplitudes: number[] = [];
  re0 = 0; im0 = 0; cr0 = 0; ci0 = 0; re1 = 0; im1 = 0; cr1 = 0; ci1 = 0;
  amp = 0; ratio = 1; damp = 1;
  constructor(patch: Patch, sr: number, midi: number, velocity: number, k: number, f: number, lo: number, hi: number, t: number, vel: number, extra: number) {
    for (let j = 0; j < 10; j++) {
      const a = mix(patch.envelope(lo, 0, k, j), patch.envelope(lo, 1, k, j), vel);
      const b = mix(patch.envelope(hi, 0, k, j), patch.envelope(hi, 1, k, j), vel);
      this.amplitudes.push(db(mix(a, b, t) * .5 - 120) * extra);
    }
    const anchor = t < .5 ? lo : hi, layer = vel < .5 ? 0 : 1;
    const phase = patch.phases[(anchor * 2 + layer) * 64 + k] * TAU / 256;
    for (let u = 0; u < 2; u++) {
      let offset = (u ? 1 : -1) * (.045 + .00032 * f);
      if (midi < 40) offset *= .3;
      const w = TAU * (f + offset) / sr;
      if (u === 0) {this.re0 = Math.cos(phase); this.im0 = Math.sin(phase); this.cr0 = Math.cos(w); this.ci0 = Math.sin(w);}
      else {this.re1 = Math.cos(phase); this.im1 = Math.sin(phase); this.cr1 = Math.cos(w); this.ci1 = Math.sin(w);}
    }
  }
  envelopeAt(t: number, segment: number, sr: number) {
    const e0 = this.amplitudes[segment], e1 = this.amplitudes[segment + 1];
    const duration = TIMES[segment + 1] - TIMES[segment];
    if (t > 6 && e1 > e0) {
      this.amp = e1 * Math.exp(-(t - 6)); this.ratio = Math.exp(-1 / sr);
    } else {
      const slope = Math.log(e1 / e0);
      this.amp = e0 * Math.exp(slope * Math.max(0, (t - TIMES[segment]) / duration));
      this.ratio = Math.exp(slope / (duration * sr));
    }
  }
  next(damping: number) {
    const re0 = this.re0, im0 = this.im0, re1 = this.re1, im1 = this.im1;
    const sum = re0 * .75 + re1 * .25;
    this.re0 = re0 * this.cr0 - im0 * this.ci0;
    this.im0 = re0 * this.ci0 + im0 * this.cr0;
    this.re1 = re1 * this.cr1 - im1 * this.ci1;
    this.im1 = re1 * this.ci1 + im1 * this.cr1;
    const out = sum * this.amp * this.damp;
    this.amp *= this.ratio;
    if (this.damp > DAMP_FLOOR) this.damp *= damping;
    return out;
  }
}
class Attack {
  modes: {a1: number; a2: number; g: number; delay: number; length: number; gain: number; y1: number; y2: number}[] = [];
  noiseGain: number; noiseRate: number; lpA: number; lp1 = 0; lp2 = 0; rng: number; compensation: number;
  constructor(p: AttackPatch, sr: number, midi: number, velocity: number) {
    const key = clamp((midi - 24) / 6, 0, 14), lo = Math.floor(key), hi = Math.min(14, lo + 1);
    const vel = (clamp(velocity * 127, 8, 127) - 48) / 52;
    const table = (t: number[][]) => mix(mix(t[lo][0], t[hi][0], key - lo), mix(t[lo][1], t[hi][1], key - lo), vel);
    const level = db(table(p.thump_db)) * p.thump_mix;
    for (let k = 0; k < p.mode_hz.length; k++) {
      const f = p.mode_hz[k]; if (f <= 0 || f >= sr * .45) continue;
      const R = Math.exp(-6.907755 / (p.mode_t60[k] * sr)), w = TAU * f / sr;
      const length = Math.max(1, Math.floor(p.pulse_ms * .001 * sr), Math.floor(p.pulse_cycles * sr / f));
      this.modes.push({a1: 2 * R * Math.cos(w), a2: R * R, g: (k & 1 ? -1 : 1) * db(p.mode_db[k]) * Math.sin(w), delay: Math.floor(p.mode_delay_ms[k] * .001 * sr), length, gain: level * 2 / length, y1: 0, y2: 0});
    }
    this.noiseGain = db(table(p.noise_db)) * p.noise_mix;
    this.noiseRate = Math.exp(-6.907755 / (Math.max(5, table(p.noise_ms)) * .001 * sr));
    this.lpA = 1 - Math.exp(-TAU * clamp(table(p.noise_hz), 100, sr * .45) / sr);
    const r = (1 - this.lpA) ** 2;
    this.compensation = 1 / Math.sqrt(this.lpA ** 4 * (1 + r) / (1 - r) ** 3);
    this.rng = Math.trunc(midi * 7919 + velocity * 104729) | 1;
  }
  next(age: number, sr: number) {
    let sum = 0;
    for (const m of this.modes) {
      const d = age - m.delay;
      const x = d >= 0 && d < m.length ? m.gain * (.5 - .5 * Math.cos(TAU * (d + .5) / m.length)) : 0;
      const y = m.g * x + m.a1 * m.y1 - m.a2 * m.y2;
      m.y2 = m.y1; m.y1 = y; sum += y;
    }
    let u = 0;
    for (let j = 0; j < 3; j++) {
      this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
      u += (this.rng >>> 8) / 16777216 - .5;
    }
    this.lp1 += this.lpA * (u * 2 - this.lp1); this.lp2 += this.lpA * (this.lp1 - this.lp2);
    sum += this.noiseGain * this.compensation * Math.min(1, age / sr * 1000) * this.lp2;
    this.noiseGain *= this.noiseRate;
    return sum;
  }
}
export class Voice {
  partials: Partial[] = []; attack: Attack; age = 0; held = true; level = 1; damping = 1; segment = -1;
  pedalPosition = 0; releasedFrames = 0; fading = false; finished = false; fadeLeft = 0;
  fade() {if (!this.fading) {this.fading = true; this.fadeLeft = Math.max(1, Math.round(FADE_SECONDS * this.sr));}}
  constructor(public id: number, public midi: number, velocity: number, public sr: number, patch: Patch, attack: AttackPatch) {
    const key = clamp((midi - 24) / 6, 0, 14), lo = Math.floor(key), hi = Math.min(lo + 1, 14), t = key - lo;
    const vel = clamp((velocity * 127 - 48) / 52);
    const extra = velocity * 127 < 48 ? (velocity * 127 / 48) ** 1.5 : velocity * 127 > 100 ? (velocity * 127 / 100) ** 1.3 : 1;
    const f1 = 440 * 2 ** ((midi - 69) / 12) * mix(patch.tuning[lo * 2], patch.tuning[hi * 2], t);
    const B = Math.exp(mix(Math.log(patch.tuning[lo * 2 + 1]), Math.log(patch.tuning[hi * 2 + 1]), t));
    for (let k = 0; k < 64; k++) {
      const h = k + 1, f = f1 * h * Math.sqrt((1 + B * h * h) / (1 + B));
      if (f > sr * .44) break;
      this.partials.push(new Partial(patch, sr, midi, velocity, k, f, lo, hi, t, vel, extra));
    }
    this.attack = new Attack(attack, sr, midi, velocity);
  }
  pedal(position: number) {
    this.pedalPosition = position;
    if (position >= .645) this.releasedFrames = 0;
    const engagement = this.held || this.midi >= 90 ? 0 : clamp((Math.fround(.645) - position) / (Math.fround(.645) - Math.fround(.472))) ** Math.fround(.95);
    this.damping = Math.exp(-engagement * 80 / 8.685889638 / this.sr);
  }
  render(output: Float32Array) {
    let energy = 0;
    for (let i = 0; i < output.length; i++, this.age++) {
      const t = this.age / this.sr;
      // The physical model retains a -45 dB residual; don't spend CPU on it for 24 seconds.
      if (!this.held && this.pedalPosition < .645) this.releasedFrames++;
      if (this.releasedFrames >= this.sr * .35 || t >= 6) this.fade();
      if (this.fading && this.fadeLeft <= 0) {this.finished = true; break;}
      let segment = 0; while (segment < 8 && t > TIMES[segment + 1]) segment++;
      // Re-anchor every block to avoid accumulated drift; otherwise use exact exponential recurrences.
      if (i === 0 || segment !== this.segment || this.age === Math.floor(6 * this.sr) + 1) {
        for (const p of this.partials) p.envelopeAt(t, segment, this.sr);
        this.segment = segment;
      }
      let sum = 0; for (const p of this.partials) sum += p.next(this.damping);
      sum = Math.fround(sum * (t < .004 ? .5 - .5 * Math.cos(Math.PI * t / .004) : 1));
      if (t < 2) sum = Math.fround(sum + this.attack.next(this.age, this.sr));
      if (this.fading) sum *= this.fadeLeft-- / Math.max(1, Math.round(FADE_SECONDS * this.sr));
      output[i] += sum; energy += sum * sum;
    }
    this.level = Math.sqrt(energy / output.length);
  }
}
export class PianoEngine {
  voices: Voice[] = []; pedalPosition = 0; peakEnv = 0;
  constructor(public sr: number, public patch: Patch, public attack: AttackPatch) {}
  on(id: number, note: number, velocity: number) {
    if (!Number.isInteger(note) || note < 24 || note > 108 || !Number.isFinite(velocity) || velocity <= 0 || velocity > 1) return;
    // Fade stolen voices instead of cutting an arbitrary waveform mid-cycle.
    let live = 0, candidate: Voice | undefined, lowest = Infinity;
    for (const v of this.voices) {
      if (v.fading) continue;
      live++;
      const score = v.level + (v.held ? 10 : 0);
      if (score < lowest) {lowest = score; candidate = v;}
    }
    if (live >= MAX_VOICES) candidate?.fade();
    // Bound overlapping steal fades during unusually dense message bursts.
    let fades = 0;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i].fading && ++fades > MAX_FADING_VOICES) this.voices.splice(i, 1);
    }
    const voice = new Voice(id, note, velocity, this.sr, this.patch, this.attack);
    voice.pedal(this.pedalPosition); this.voices.push(voice);
  }
  off(id: number) { for (const v of this.voices) if (v.id === id) {v.held = false; v.pedal(this.pedalPosition);} }
  sustain(value: number) { if (!Number.isFinite(value)) return; this.pedalPosition = clamp(value); for (const v of this.voices) v.pedal(this.pedalPosition); }
  panic() { this.voices = []; this.pedalPosition = 0; }
  render(output: Float32Array) {
    output.fill(0);
    for (const v of this.voices) v.render(output);
    // Compact in place: no new array on every audio callback.
    let kept = 0;
    for (const v of this.voices) {
      if (v.finished) continue;
      if (!v.fading && v.age / this.sr > .5 && v.level < 1e-5) v.fade();
      this.voices[kept++] = v;
    }
    this.voices.length = kept;
    // Master: makeup into a limiter, then the tanh safety. Several ff voices sum past
    // full scale, which slammed the tanh into square-wave buzz on chords; track the
    // peak (instant attack, slow release) and undo only the excess, so a single note
    // reaches the tanh exactly as before while polyphony gets pulled back transparently.
    const release = Math.exp(-1 / (.13 * this.sr));
    for (let i = 0; i < output.length; i++) {
      const x = output[i] * 3, peak = Math.abs(x);
      this.peakEnv = peak > this.peakEnv ? peak : this.peakEnv * release + peak * (1 - release);
      output[i] = Math.tanh(x * (this.peakEnv > 1 ? 1 / this.peakEnv : 1));
    }
  }
}

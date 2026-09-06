import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PianoEngine, Patch, MAX_VOICES} from '../src/engine.ts';
import {sounds} from '../src/presets.ts';
const b=fs.readFileSync(new URL('../public/salamander.bin',import.meta.url));
const patch=new Patch(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));
const attack=JSON.parse(fs.readFileSync(new URL('../src/attack.json',import.meta.url)));
const originalData=JSON.stringify(attack), originalPatch=Buffer.from(patch.envelopes);
const renders=new Map();
for(const sound of Object.keys(sounds)) {
  for(const sr of [44100,48000]) {
    const e=new PianoEngine(sr,patch,attack,true);e.setSound(sound);
    const block=new Float32Array(128), samples=[];
    e.on(1,60,.7);
    for(let i=0;i<Math.ceil(sr/128);i++){e.render(block);for(const x of block){assert(Number.isFinite(x));assert(Math.abs(x)<=1);samples.push(x);}}
    assert(samples.some(x=>Math.abs(x)>.01));if(sr===48000)renders.set(sound,samples);
    const held=e.voices[0];e.setSound('original');assert.equal(held.sound,sound,'held note keeps its timbre');
    e.off(1);for(let i=0;i<Math.ceil(sr/128);i++)e.render(block);
    assert.equal(e.voices.length,0,'release cleanup works for every sound');
    e.setSound(sound);e.setSound('__proto__');assert.equal(e.sound,sound,'invalid sound ignored');
    for(let i=0;i<40;i++){e.on(i,48+i%24,.8);e.render(block);assert(e.voices.length<=MAX_VOICES+2);}
    e.panic();e.render(block);assert(block.every(x=>x===0));assert.equal(e.sound,sound);
  }
}
const reference=renders.get('original');
for(const [sound,samples] of renders){if(sound==='original')continue;let error=0,energy=0;for(let i=0;i<samples.length;i++){error+=(samples[i]-reference[i])**2;energy+=reference[i]**2;}assert(Math.sqrt(error/energy)>.1,`${sound} must produce a distinct waveform`);}
assert.equal(JSON.stringify(attack),originalData);assert(Buffer.from(patch.envelopes).equals(originalPatch));
console.log('All four sounds: distinct output, finite samples, release cleanup, voice budget, switching and immutable patches passed.');

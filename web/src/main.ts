import './style.css';
import workletURL from './piano-worklet.ts?worker&url';
import attackData from './attack.json';
import {ScorePlayer} from './fur-elise';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main>
  <header><a class="wordmark" href="." aria-label="pfsynth home">pf<span>synth</span><i></i></a><span class="edition">THE LITTLE PIANO / 01</span></header>
  <section class="instrument" aria-label="Piano">
    <div class="instrument-top"><div><p class="eyebrow">A MOMENT AT THE KEYS</p><h1>Just play.</h1><p class="intro">A little piano. Room for whatever comes next.</p></div><button id="audio" class="start">Enable sound <span>↗</span></button></div>
    <div class="display"><div class="readout"><span id="status" role="status">Sound is off</span><strong id="note">—</strong></div><canvas id="scope" aria-hidden="true"></canvas><span class="display-label">pfsynth<br>PARTIAL PIANO</span></div>
    <div class="controls"><div class="octave"><span class="label">Octave</span><button id="lower" aria-label="Lower octave">−</button><output id="octave">4</output><button id="higher" aria-label="Higher octave">+</button></div><label class="range">Touch <input id="velocity" type="range" min="20" max="127" value="80"><output id="velocity-value">80</output></label><label class="range">Volume <input id="volume" type="range" min="0" max="100" value="65"></label><button id="sustain" aria-pressed="false"><i></i>Sustain <kbd>SPACE</kbd></button></div>
    <div class="keyboard-wrap"><div id="keyboard" class="keyboard" role="group" aria-label="Piano keys"></div></div>
    <div class="below-keys"><span>Click, touch, or use the letter keys.<br><kbd>CTRL F</kbd> Für Elise · press again or <kbd>ESC</kbd> to stop</span><span><kbd>←</kbd> <kbd>→</kbd> change octave <b>·</b> <kbd>SPACE</kbd> hold sustain</span></div>
  </section>
  <footer><p><span class="live-dot"></span> Synthesized in your browser</p><details><summary>Inside the piano <span>+</span></summary><p>64 inharmonic partials, softly beating strings, a resonant hammer attack, and a continuous damper model. A TypeScript port of pfsynth, running on the audio thread.</p><p>The tonal parameters were measured from Alexander Holm’s Salamander Grand Piano (CC BY 3.0). The attack parameters were fitted to Pianoteq 6 by Modartt. No recordings are played or distributed. pfsynth is © 2026 John O’Laughlin, MIT licensed.</p></details></footer>
</main>`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let octave = 4, nextId = 1, pedalLatched = false, spaceHeld = false;
let context: AudioContext | null = null, node: AudioWorkletNode | null = null, volume: GainNode, analyser: AnalyserNode;
let initializing: Promise<void> | null = null;
const held = new Map<string, {id: number; note: number}>();
const mapping = ['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l','p',';'];
const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const noteName = (midi: number) => names[midi % 12] + (Math.floor(midi / 12) - 1);
const patchPromise = fetch('/salamander.bin').then(r => {if (!r.ok) throw new Error('Piano data could not load'); return r.arrayBuffer();});
// Observe preload errors immediately; retry is performed by the enable button.
patchPromise.catch(() => {});
const demo = new ScorePlayer(enable, (id, score) => {
  const voice = {id: nextId++, note: score.note};
  held.set('demo' + id, voice);
  node?.port.postMessage({type: 'on', ...voice, velocity: score.velocity});
  refreshKeys();
}, id => release('demo' + id), refreshKeys);
function fail(error: unknown) { $('status').textContent = error instanceof Error ? error.message : 'Could not start sound'; $('audio').textContent = 'Retry sound ↗'; }
async function enable() {
  if (node && context) {await context.resume(); return;}
  if (initializing) return initializing;
  initializing = (async () => {
    if (!window.AudioContext || !window.AudioWorkletNode) throw new Error('This browser needs Web Audio and AudioWorklet support.');
    context = new AudioContext({latencyHint: 'interactive'});
    await context.resume();
    $('status').textContent = 'Preparing piano…';
    const patch = await patchPromise.catch(async () => {const r = await fetch('/salamander.bin'); if (!r.ok) throw new Error('Piano data could not load'); return r.arrayBuffer();});
    await context.audioWorklet.addModule(workletURL);
    node = new AudioWorkletNode(context, 'pfsynth-piano', {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: {patch, attack: attackData}});
    node.onprocessorerror = () => {panic(); node?.disconnect(); node = null; void context?.close(); context = null; fail(new Error('Audio stopped. Enable sound to restart.'));};
    volume = context.createGain(); volume.gain.value = Number($<HTMLInputElement>('volume').value) / 100;
    analyser = context.createAnalyser(); analyser.fftSize = 2048;
    node.connect(volume).connect(analyser).connect(context.destination);
    $('audio').textContent = 'Sound enabled ✓'; $('audio').classList.add('enabled'); $('status').textContent = 'Ready when you are';
    syncPedal();
  })().catch(async e => {node = null; await context?.close(); context = null; throw e;}).finally(() => {initializing = null;});
  return initializing;
}
function refreshKeys() {
  const sounding = new Set([...held.values()].map(v => v.note));
  document.querySelectorAll<HTMLButtonElement>('.key').forEach(key => {const down = sounding.has(Number(key.dataset.note)); key.classList.toggle('down', down); key.setAttribute('aria-pressed', String(down));});
  $('note').textContent = sounding.size ? [...sounding].map(noteName).join(' · ') : '—';
  if (node) $('status').textContent = demo.playing ? 'Für Elise · opening' : sounding.size ? (sounding.size > 1 ? 'A little harmony' : 'Let it ring') : 'Ready when you are';
}
function press(source: string, midi: number) {
  if (held.has(source)) return;
  const voice = {id: nextId++, note: midi}; held.set(source, voice); refreshKeys();
  void enable().then(() => {if (held.get(source) === voice) node?.port.postMessage({type: 'on', ...voice, velocity: Number($<HTMLInputElement>('velocity').value) / 127});}).catch(e => {held.delete(source); refreshKeys(); fail(e);});
}
function release(source: string) {const voice = held.get(source); if (!voice) return; node?.port.postMessage({type: 'off', id: voice.id}); held.delete(source); refreshKeys();}
function syncPedal() {const down = pedalLatched || spaceHeld; $('sustain').setAttribute('aria-pressed', String(down)); node?.port.postMessage({type: 'sustain', value: down ? 1 : 0});}
function panic() {demo.stop(); held.clear(); spaceHeld = false; pedalLatched = false; node?.port.postMessage({type: 'panic'}); syncPedal(); refreshKeys();}
function drawKeyboard() {
  let whites = 0;
  $('keyboard').innerHTML = mapping.map((letter, i) => {
    const midi = (octave + 1) * 12 + i, black = [1,3,6,8,10].includes(midi % 12);
    const position = black ? whites - .31 : whites++;
    return `<button class="key ${black ? 'black' : 'white'}" style="--position:${position}" data-note="${midi}" aria-label="${noteName(midi)}, keyboard ${letter}" aria-pressed="false"><span class="key-note">${noteName(midi)}</span><span class="key-letter">${letter.toUpperCase()}</span></button>`;
  }).join('');
  $('keyboard').style.setProperty('--white-count', String(whites));
  $('octave').textContent = String(octave);
  $<HTMLButtonElement>('lower').disabled = octave <= 1; $<HTMLButtonElement>('higher').disabled = octave >= 6;
}
function changeOctave(delta: number) {panic(); octave = Math.min(6, Math.max(1, octave + delta)); drawKeyboard();}
$('audio').addEventListener('click', () => void enable().catch(fail));
$('lower').addEventListener('click', () => changeOctave(-1)); $('higher').addEventListener('click', () => changeOctave(1));
$('sustain').addEventListener('click', () => {pedalLatched = !pedalLatched; syncPedal();});
$('volume').addEventListener('input', () => {if (context && volume) volume.gain.setTargetAtTime(Number($<HTMLInputElement>('volume').value) / 100, context.currentTime, .02);});
$('velocity').addEventListener('input', () => {$('velocity-value').textContent = $<HTMLInputElement>('velocity').value;});
$('keyboard').addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const key = (e.target as HTMLElement).closest<HTMLButtonElement>('.key'); if (!key) return;
  e.preventDefault(); key.setPointerCapture(e.pointerId); press('pointer' + e.pointerId, Number(key.dataset.note));
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('keyboard').addEventListener(event, e => release('pointer' + (e as PointerEvent).pointerId));
// Buttons remain playable with Enter when navigating by Tab.
$('keyboard').addEventListener('keydown', e => {if (e.key === 'Enter' && !e.repeat) {e.preventDefault(); const key = (e.target as HTMLElement).closest<HTMLButtonElement>('.key'); if (key) press('enter', Number(key.dataset.note));}});
$('keyboard').addEventListener('keyup', e => {if (e.key === 'Enter') release('enter');});
window.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (!e.repeat) {if (demo.playing) demo.stop(); else void demo.start().catch(fail);}
    return;
  }
  if (e.key === 'Escape' && demo.playing) {e.preventDefault(); demo.stop(); return;}
  const target = e.target as HTMLElement;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || target.matches('input:not([type="range"]),select,textarea,[contenteditable="true"]')) return;
  // A slider may keep focus after dragging: letters still play, arrows adjust it.
  if (target.matches('input[type="range"]') && e.key.startsWith('Arrow')) return;
  if (e.code === 'Space') {e.preventDefault(); spaceHeld = true; syncPedal(); return;}
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault(); changeOctave(e.key === 'ArrowLeft' ? -1 : 1); return;}
  const i = mapping.indexOf(e.key.toLowerCase()); if (i >= 0) {e.preventDefault(); press('key' + e.code, (octave + 1) * 12 + i);}
});
window.addEventListener('keyup', e => {if (e.code === 'Space') {spaceHeld = false; syncPedal();} release('key' + e.code);});
window.addEventListener('blur', panic); document.addEventListener('visibilitychange', () => {if (document.hidden) panic();});
drawKeyboard();
const canvas = $<HTMLCanvasElement>('scope'), ctx = canvas.getContext('2d')!, samples = new Float32Array(2048);
let lastFrame = 0;
function scope(now: number) {
  requestAnimationFrame(scope); if (now - lastFrame < 32 || document.hidden) return; lastFrame = now;
  const width = canvas.clientWidth, height = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);}
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  if (analyser) analyser.getFloatTimeDomainData(samples);
  ctx.beginPath(); ctx.strokeStyle = '#d0ae71'; ctx.lineWidth = 1.25;
  for (let x = 0; x < width; x++) {const sample = samples[Math.floor(x / width * samples.length)]; const y = height / 2 - sample * height * .75; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);}
  ctx.stroke();
}
requestAnimationFrame(scope);

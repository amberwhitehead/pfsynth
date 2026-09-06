import {Patch, PianoEngine, type AttackPatch} from './engine';
declare const sampleRate: number;
declare class AudioWorkletProcessor {port: MessagePort; constructor(options?: unknown);}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class PianoProcessor extends AudioWorkletProcessor {
  engine: PianoEngine;
  constructor(options: {processorOptions: {patch: ArrayBuffer; attack: AttackPatch}}) {
    super();
    // Per-key live trims are applied at note-on, as in pfplayer.c:key_trims.
    this.engine = new PianoEngine(sampleRate, new Patch(options.processorOptions.patch), options.processorOptions.attack, true);
    this.port.onmessage = ({data}) => {
      if (data.type === 'on') this.engine.on(data.id, data.note, data.velocity);
      if (data.type === 'off') this.engine.off(data.id);
      if (data.type === 'sustain') this.engine.sustain(data.value);
      if (data.type === 'panic') this.engine.panic();
      if (data.type === 'sound') this.engine.setSound(data.value);
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    this.engine.render(outputs[0][0]);
    for (let i = 1; i < outputs[0].length; i++) outputs[0][i].set(outputs[0][0]);
    return true;
  }
}
registerProcessor('pfsynth-piano', PianoProcessor);

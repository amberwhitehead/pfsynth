import {Patch, PianoEngine, type AttackPatch} from './engine';
declare const sampleRate: number;
declare class AudioWorkletProcessor {port: MessagePort; constructor(options?: unknown);}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class PianoProcessor extends AudioWorkletProcessor {
  engine: PianoEngine;
  constructor(options: {processorOptions: {patch: ArrayBuffer; attack: AttackPatch}}) {
    super();
    const attack = options.processorOptions.attack;
    // Ear-tuned onset trims (experiments/attack-ptq/listening-trims.json), same defaults as
    // the native player and demo app: slow body modes, fast knock modes, noise burst.
    attack.slow_mix = (attack.slow_mix ?? 1) * 10 ** (-18 / 20);
    attack.knock_mix = (attack.knock_mix ?? 1) * 10 ** (-22 / 20);
    attack.noise_mix = (attack.noise_mix ?? 1) * 10 ** (-17 / 20);
    this.engine = new PianoEngine(sampleRate, new Patch(options.processorOptions.patch), attack);
    this.port.onmessage = ({data}) => {
      if (data.type === 'on') this.engine.on(data.id, data.note, data.velocity);
      if (data.type === 'off') this.engine.off(data.id);
      if (data.type === 'sustain') this.engine.sustain(data.value);
      if (data.type === 'panic') this.engine.panic();
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    this.engine.render(outputs[0][0]);
    for (let i = 1; i < outputs[0].length; i++) outputs[0][i].set(outputs[0][0]);
    return true;
  }
}
registerProcessor('pfsynth-piano', PianoProcessor);

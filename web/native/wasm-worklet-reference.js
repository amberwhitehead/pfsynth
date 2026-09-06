class PianoProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const instance = new WebAssembly.Instance(options.processorOptions.module, {env: Math});
    this.engine = instance.exports;
    this.engine.init(sampleRate);
    this.samples = new Float32Array(this.engine.memory.buffer, this.engine.render(), 128);
    this.port.onmessage = ({data}) => {
      if(data.type === 'on') this.engine.on(data.id, data.note, data.velocity);
      if(data.type === 'off') this.engine.off(data.id);
      if(data.type === 'sustain') this.engine.sustain(data.value);
      if(data.type === 'panic') this.engine.panic();
    };
  }
  process(inputs, outputs) {
    this.engine.render();
    for(const channel of outputs[0]) channel.set(this.samples);
    return true;
  }
}
registerProcessor('pfsynth-piano', PianoProcessor);

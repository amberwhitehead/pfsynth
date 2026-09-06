// A short arrangement of the public-domain opening of Beethoven's Für Elise.
export type ScoreNote = {note: number; at: number; duration: number; velocity: number};
const melody: [number, number][] = [
  [76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3],
  [60,1],[64,1],[69,1],[71,3],[64,1],[68,1],[71,1],[72,3],
  [64,1],[76,1],[75,1],[76,1],[75,1],[76,1],[71,1],[74,1],[72,1],[69,3],
  [60,1],[64,1],[69,1],[71,3],[64,1],[72,1],[71,1],[69,6],
];
export const furElise: ScoreNote[] = [];
let beat = 0;
for (const [note, length] of melody) {
  furElise.push({note, at: beat * .23, duration: length * .23 * .9, velocity: .64});
  if (length >= 3) {
    const bass = note === 71 ? [40,47,52] : note === 72 ? [48,55,60] : [45,52,57];
    bass.forEach((pitch, i) => furElise.push({note: pitch, at: (beat + i) * .23, duration: .42, velocity: .43}));
  }
  beat += length;
}

export class ScorePlayer {
  playing = false;
  title = 'Für Elise · opening';
  private generation = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private active = new Set<number>();
  constructor(private prepare: () => Promise<void>, private on: (id: number, note: ScoreNote) => void, private off: (id: number) => void, private changed: () => void) {}
  stop() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.length = 0;
    this.playing = false;
    for (const id of this.active) this.off(id);
    this.active.clear(); this.changed();
  }
  async start(score: readonly ScoreNote[] = furElise, title = 'Für Elise · opening') {
    this.stop(); this.title = title; this.playing = true;
    const generation = this.generation;
    this.changed();
    try {await this.prepare();} catch (error) {if (generation === this.generation) this.stop(); throw error;}
    if (generation !== this.generation) return;
    const later = (seconds: number, action: () => void) => this.timers.push(setTimeout(() => {if (generation === this.generation) action();}, seconds * 1000));
    score.forEach((note, id) => {
      later(note.at, () => {this.active.add(id); this.on(id, note);});
      later(note.at + note.duration, () => {this.active.delete(id); this.off(id);});
    });
    later(Math.max(0, ...score.map(n => n.at + n.duration)) + .05, () => this.stop());
  }
}

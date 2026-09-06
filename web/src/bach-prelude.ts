import type {ScoreNote} from './fur-elise';

// J. S. Bach, Prelude in C major, BWV 846: opening four bars (public domain).
// Each five-note voicing unfolds 0,1,2,3,4,2,3,4, twice per bar.
const voicings = [
  [60,64,67,72,76], // C major
  [60,62,69,74,77], // D minor over C
  [59,62,67,74,77], // G7 over B
  [60,64,67,72,76], // C major
];
const pattern = [0,1,2,3,4,2,3,4];
const sixteenth = .19;
export const bachPrelude: ScoreNote[] = voicings.flatMap((voicing, bar) =>
  Array.from({length: 16}, (_, step) => {
    const index = pattern[step % 8];
    return {
      note: voicing[index],
      at: (bar * 16 + step) * sixteenth,
      // Keep the two lower voices under the flowing upper figure.
      duration: sixteenth * (index === 0 ? 7.8 : index === 1 ? 6.8 : .9),
      velocity: index < 2 ? .45 : .57,
    };
  }),
);

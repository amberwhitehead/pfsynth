export const sounds = {
  original: {label: 'Original', description: 'The familiar grand.', tilt: 0, gain: 1, decay: 1, onset: 1, attack: 1, spread: 0, drift: 0, glass: false, release: .35},
  concert: {label: 'Concert D', description: 'A concert grand, from pfsynth’s Pianoteq Steinway D fit.', tilt: 0, gain: 1, decay: 1, onset: 1, attack: 1, spread: 0, drift: 0, glass: false, release: .35},
  felt: {label: 'Felt', description: 'Soft hammers, warm and close.', tilt: -7, gain: .9, decay: .8, onset: 2.2, attack: .25, spread: 0, drift: 0, glass: false, release: .35},
  honky: {label: 'Honky-tonk', description: 'Detuned strings, slightly disreputable.', tilt: 0, gain: .9, decay: .85, onset: 1, attack: 1.1, spread: 7, drift: 3, glass: false, release: .35},
  glass: {label: 'Glass', description: 'A gentle, bell-like shimmer.', tilt: 1, gain: .65, decay: 1.35, onset: 1, attack: .08, spread: .5, drift: 0, glass: true, release: .6},
} as const;
export type Sound = keyof typeof sounds;
export type SoundProfile = typeof sounds[Sound];
export const isSound = (value: unknown): value is Sound => typeof value === 'string' && Object.hasOwn(sounds, value);

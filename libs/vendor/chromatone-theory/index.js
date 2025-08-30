export * from './calculations.js'
export * from './audio.js'
export * from './notes.js'
export * from './tunings.js'
export { default as chords } from './chords.js'
export { default as scales } from './scales.js'

export const tunings = {
  pythagorean: {
    cents: [0, 90, 204, 294, 408, 498, 588, 612, 702, 792, 906, 996, 1110],
  },
  just: {
    cents: [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 1017, 1088],
    values: [
      '1/1',
      '16/15',
      '9/8',
      '6/5',
      '5/4',
      '4/3',
      '45/32',
      '3/2',
      '8/5',
      '5/3',
      '9/5',
      '15/8',
    ],
  },
  et: {
    cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
  },
}

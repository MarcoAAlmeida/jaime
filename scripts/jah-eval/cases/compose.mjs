// "compose" cases: a request to write a piece, with constraints a machine
// can check (mustUse/mustNotUse names, minEvents). See ../README.md for
// the field reference.

export const composeCases = [
  { id: 'four-on-the-floor', kind: 'compose', message: 'give me a simple four on the floor beat', mustUse: ['bd'], minEvents: 4 },
  { id: 'offbeat-hats', kind: 'compose', message: 'add an offbeat hi-hat pattern to go with a four on the floor kick', mustUse: ['bd', 'hh'], minEvents: 8 },
  { id: 'bassline-request', kind: 'compose', message: 'write me a simple bassline using notes', mustUse: ['note'], minEvents: 4 },
  { id: 'minor-chord-pad', kind: 'compose', message: 'write a slow, minor chord pad', mustUse: ['note'], minEvents: 1 },
  {
    id: 'jungle-breakbeat-compose',
    kind: 'compose',
    message: 'give me a jungle breakbeat using the amen break',
    mustUse: ['amen', 'samples'],
    // "jungle" is a genre name, not a real sample or function — a
    // hallucinated `s("jungle")` would be a real mistake to catch.
    mustNotUse: ['jungle'],
    minEvents: 4,
  },
  // `cutoff` is a real, documented synonym for `lpf` (see
  // knowledge-catalog.test.ts's exact-lookup tests) — accepted here for
  // the same reason as chord-progression's expect list above.
  { id: 'filtered-bass', kind: 'compose', message: 'write a bassline with a low-pass filter sweep', mustUse: [['lpf', 'cutoff']], minEvents: 1 },
  { id: 'euclidean-hat-pattern', kind: 'compose', message: 'write a euclidean hi-hat rhythm with 3 hits over 8 steps', mustUse: ['hh'], minEvents: 3 },
  { id: 'reverse-melody', kind: 'compose', message: 'write a short melody and reverse it', mustUse: ['note', 'rev'], minEvents: 1 },
  { id: 'panning-drums', kind: 'compose', message: 'write a drum pattern that pans left and right', mustUse: ['pan'], minEvents: 1 },
  { id: 'reverb-pad', kind: 'compose', message: 'write an ambient pad with reverb', mustUse: ['room'], minEvents: 1 },
]

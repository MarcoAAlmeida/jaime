// "docs" cases: a question about Strudel, with the function names a
// correct answer must mention. See ../README.md for the field reference.
// The first 14 are the questions scripts/jah-prompt-eval.mjs has always
// used for its (formatting-only) prompt comparison; the rest add coverage
// beyond @jah's hand-written cheat-sheet (server/jah/prompt.ts), to reveal
// how much a real documentation index (roadmap Phase 1) would help.

export const docsCases = [
  { id: 'fast-basic', kind: 'docs', message: 'what does .fast do?', expect: ['fast'] },
  { id: 'kick-and-snare', kind: 'docs', message: 'how do I make a kick and snare pattern?', expect: ['s'], code: 'required' },
  { id: 'reverb-basic', kind: 'docs', message: 'how do I add reverb to a pattern?', expect: ['room'] },
  { id: 'four-on-the-floor-docs', kind: 'docs', message: 'give me a simple four on the floor beat', expect: ['s'], code: 'required' },
  { id: 'euclidean-rhythms', kind: 'docs', message: 'how do euclidean rhythms work?', expect: ['euclid'] },
  { id: 'bassline-basic', kind: 'docs', message: 'how can I make a bassline?', expect: ['note'] },
  { id: 'amen-break', kind: 'docs', message: 'how do I use the amen break?', expect: ['samples'] },
  { id: 'jungle-breakbeat', kind: 'docs', message: 'how do I make a jungle breakbeat?', expect: ['s'] },
  { id: 'polyrhythm-basic', kind: 'docs', message: 'what is a polyrhythm and how do I write one?', expect: ['fast'] },
  { id: 'lpf-basic', kind: 'docs', message: 'how do I filter a sound with lpf?', expect: ['lpf'] },
  // Either the simple `note(...)` chord-stacking approach or the dedicated
  // `chord`+`voicing` functions is a genuinely correct answer (found via
  // add-jah-knowledge-retrieval task 6.2's grounded eval run, 2026-09-25:
  // grounding surfaced `chord`/`voicing` and the model correctly switched
  // to them, which the original note-only check then failed).
  { id: 'chord-progression', kind: 'docs', message: 'how do I make a chord progression?', expect: [['note', 'chord']] },
  { id: 'every-other-cycle', kind: 'docs', message: 'how do I make a pattern that changes every other cycle?', expect: ['every'] },
  { id: 'pan-basic', kind: 'docs', message: 'how do I pan a sound left and right?', expect: ['pan'] },
  { id: 'slow-basic', kind: 'docs', message: 'how do I slow a pattern down?', expect: ['slow'] },

  { id: 'lpf-vs-hpf', kind: 'docs', message: 'what is the difference between lpf and hpf?', expect: ['lpf', 'hpf'] },
  { id: 'gain-basic', kind: 'docs', message: 'how do I make a pattern quieter?', expect: ['gain'] },
  { id: 'sometimesby-basic', kind: 'docs', message: 'how do I apply an effect to only some of the events, randomly?', expect: ['sometimesBy'] },
  { id: 'jux-basic', kind: 'docs', message: 'how do I make the left and right channels play differently?', expect: ['jux'] },
  { id: 'bank-basic', kind: 'docs', message: 'how do I switch to a different drum machine sound set?', expect: ['bank'] },
  { id: 'scale-basic', kind: 'docs', message: 'how do I use scale degrees instead of writing out note names?', expect: ['scale'] },
]

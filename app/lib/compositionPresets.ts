// Pre-scripted starter compositions for the Composition Room. Each is a
// complete, self-contained Strudel script (kept verbatim, including its
// author/licence header) that an editor can load into the shared
// document with one click, replacing whatever's there.

import birdsOfAFeather from './compositions/birds-of-a-feather.js?raw'
import caverave from './compositions/caverave.js?raw'
import dinofunk from './compositions/dinofunk.js?raw'

export interface CompositionPreset {
  id: string
  title: string
  /** Author + licence, shown next to the title. */
  credit: string
  code: string
}

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  {
    id: 'birds-of-a-feather',
    title: 'Birds of a Feather (remake)',
    credit: 'saga_3k · CC BY-NC-SA',
    code: birdsOfAFeather.trim(),
  },
  {
    id: 'caverave',
    title: 'Caverave',
    credit: 'Felix Roos · CC BY-NC-SA',
    code: caverave.trim(),
  },
  {
    id: 'dinofunk',
    title: 'Dinofunk',
    credit: 'Felix Roos · CC BY-NC-SA',
    code: dinofunk.trim(),
  },
]

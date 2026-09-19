// Suggests a display name so the join gate never starts empty — a
// user can accept it as-is (click or Enter) or type their own
// (simplify-room-entry). No dependency: two small local word lists.

const ADJECTIVES = [
  'Curious', 'Swift', 'Quiet', 'Bright', 'Gentle', 'Bold', 'Lucky',
  'Sunny', 'Calm', 'Clever', 'Breezy', 'Cosmic', 'Dreamy', 'Fuzzy',
  'Jazzy', 'Mellow', 'Nimble', 'Silver', 'Velvet', 'Wandering',
]

const CREATURES = [
  'Otter', 'Fox', 'Wren', 'Falcon', 'Panda', 'Heron', 'Lynx',
  'Sparrow', 'Badger', 'Dolphin', 'Raven', 'Rabbit', 'Turtle',
  'Cricket', 'Firefly', 'Gecko', 'Owl', 'Seal', 'Squirrel', 'Whale',
]

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function randomDisplayName(): string {
  return `${pick(ADJECTIVES)} ${pick(CREATURES)}`
}

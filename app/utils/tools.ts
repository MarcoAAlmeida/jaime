// The main tools, in the order they appear in the dashboard and docs
// sidebars. `ready` flags whether the tool is real yet or a click-through
// mock.
export interface Tool {
  label: string
  description: string
  icon: string
  to: string
  ready: boolean
}

export const TOOLS: Tool[] = [
  {
    label: 'Composition Room',
    description: 'One shared editor, edited together — with presence, a viewer mode, and a chat panel.',
    icon: 'i-lucide-users',
    to: '/app/composition',
    ready: true
  }
]

// Tools that still work but are being phased out. Kept out of `TOOLS` so
// the landing hero, the features section and the sidebars' main groups
// never feature them — they get low-key links only (landing footer, a
// separate sidebar group, last in the docs quick links).
export const DEMOTED_TOOLS: Tool[] = [
  {
    label: 'JAM',
    description: 'A shared jam room: each player owns one track, types Strudel patterns, everyone locked to the same tempo.',
    icon: 'i-lucide-radio',
    to: '/app/jam',
    ready: true
  }
]

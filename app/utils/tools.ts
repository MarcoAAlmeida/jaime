// The hub's tools, in the order they must appear everywhere they're
// listed (landing page + dashboard sidebar) — Composition Room before
// JAM, per the landing-page and dashboard-shell specs. `ready` flags
// whether the tool is real yet or a Phase-1 click-through mock.
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
    to: '/app/composition-room',
    ready: false
  },
  {
    label: 'JAM',
    description: 'A shared jam room: each player owns one track, types Strudel patterns, everyone locked to the same tempo.',
    icon: 'i-lucide-radio',
    to: '/app/jam',
    ready: true
  }
]

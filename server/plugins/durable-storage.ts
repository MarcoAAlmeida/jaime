// Nitro's cloudflare-durable preset calls this once per Durable Object
// construction (hibernation wake or cold start) — see design.md in
// openspec/changes/add-room-persistence for why it's the only way to
// reach the storage handle given how this preset is wired, and why this
// capture must stay synchronous (no await before it).
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:durable:init', (_durable, { state }) => {
    setDurableStorage(state.storage)
  })
})

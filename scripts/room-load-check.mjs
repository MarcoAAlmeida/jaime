#!/usr/bin/env node
// Basic concurrency check for the shared-Durable-Object design (see
// openspec/changes/add-multi-room-presence/design.md's Risks section):
// every room shares one DO instance's single-threaded event loop, so
// this opens N concurrent connections to one room and times how long
// each takes to receive its room_state — a rough, manual sanity check,
// not part of either automated test suite, matching how
// docs/04-roadmap.md frames this ("basic load test... to see how
// presence broadcast scales before building UI around it").
//
// Usage:
//   node scripts/room-load-check.mjs [count] [baseUrl]
//   node scripts/room-load-check.mjs 50 ws://127.0.0.1:8788
//   node scripts/room-load-check.mjs 50 wss://jaime.marcoalmeida-dev-br.workers.dev

const count = Number(process.argv[2] ?? 20)
const baseUrl = process.argv[3] ?? 'ws://127.0.0.1:8788'
const roomId = `load-check-${Date.now()}`

// Connections are kept open (not closed on room_state) until the caller
// is done with them, so presence stays populated for later connections
// to observe — closing eagerly would mean each connection vanishes from
// the roster the moment it's done being useful.
function connectOne(label) {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const ws = new WebSocket(`${baseUrl}/room?id=${roomId}`)
    const timeout = setTimeout(() => {
      reject(new Error(`connection ${label} timed out waiting for room_state`))
    }, 10_000)

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'room_state') {
        clearTimeout(timeout)
        resolve({ label, ws, ms: performance.now() - start, presence: data.presence.length })
      }
    })
    ws.addEventListener('error', (event) => {
      clearTimeout(timeout)
      reject(new Error(`connection ${label} errored: ${event.message ?? event}`))
    })
  })
}

console.log(`Opening ${count} concurrent connections to ${baseUrl}/room?id=${roomId} ...`)
const started = performance.now()
const results = await Promise.allSettled(
  Array.from({ length: count }, (_, index) => connectOne(index)),
)
const totalMs = performance.now() - started

const succeeded = results.filter(r => r.status === 'fulfilled')
const failed = results.filter(r => r.status === 'rejected')
const latencies = succeeded.map(r => r.value.ms).sort((a, b) => a - b)

console.log(`\n${succeeded.length}/${count} connections received room_state within 10s`)
if (failed.length > 0) {
  console.log(`${failed.length} failed:`)
  for (const f of failed) {
    console.log(`  - ${f.reason.message}`)
  }
}
if (latencies.length > 0) {
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  console.log(`room_state latency: min ${latencies[0].toFixed(0)}ms, p50 ${p50.toFixed(0)}ms, p95 ${p95.toFixed(0)}ms, max ${latencies.at(-1).toFixed(0)}ms`)
}
console.log(`Total wall time for all ${count} connections: ${totalMs.toFixed(0)}ms`)

// Under real network jitter, each connection's own room_state snapshot
// reflects presence at ITS open() moment, not the server's true final
// state — those complete at wildly different times, so no individual
// snapshot reliably captures the full count. Instead, connect one more
// "observer" now that every prior connection's room_state has already
// resolved on the client (and, critically, none of them have closed
// yet): since the server processes open() strictly before that response
// reaches the client, every earlier connection is guaranteed already
// committed to presence by the time this one connects.
const observer = await connectOne('observer').catch(error => ({ error }))
if (observer.error) {
  console.log(`Observer connection failed: ${observer.error.message}`)
}
else {
  console.log(`Observer connection's presence count (connected after all others, before any closed): ${observer.presence} (expected ${succeeded.length + 1})`)
}

for (const r of succeeded) {
  r.value.ws.close()
}
observer.ws?.close()

process.exit(failed.length > 0 || (observer.presence ?? 0) !== succeeded.length + 1 ? 1 : 0)

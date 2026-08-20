/**
 * Computes the standard half-round-trip clock offset estimate:
 * offset = serverTime - (clientSendTime + roundTrip / 2). Assumes
 * serverTime corresponds to the midpoint of the round trip (symmetric
 * one-way latency) — the only estimate possible without already having
 * synchronized clocks. `offset` means serverClock ≈ localClock + offset,
 * so converting a server timestamp to its local equivalent is
 * `serverTimestamp - offset`.
 */
export function computeOffset(clientSendTime: number, serverTime: number, roundTrip: number): number {
  return serverTime - (clientSendTime + roundTrip / 2)
}

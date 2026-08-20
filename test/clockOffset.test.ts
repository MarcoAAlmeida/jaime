import { describe, expect, it } from 'vitest'
import { computeOffset } from '../app/lib/clockOffset'

describe('computeOffset', () => {
  it('matches the half-round-trip formula', () => {
    // Client sends at local t=1000. Server is 500ms ahead of local
    // clock. Round trip takes 100ms, so the server's response is
    // presumed to correspond to local t=1050 (the midpoint).
    // Expected offset: serverTime - (clientSendTime + roundTrip / 2)
    const clientSendTime = 1000
    const roundTrip = 100
    const trueOffset = 500
    const serverTime = clientSendTime + roundTrip / 2 + trueOffset

    expect(computeOffset(clientSendTime, serverTime, roundTrip)).toBe(trueOffset)
  })

  it('returns a negative offset when the server clock is behind', () => {
    const clientSendTime = 2000
    const roundTrip = 40
    const trueOffset = -300
    const serverTime = clientSendTime + roundTrip / 2 + trueOffset

    expect(computeOffset(clientSendTime, serverTime, roundTrip)).toBe(trueOffset)
  })

  it('returns zero when clocks are already aligned and latency is symmetric', () => {
    const clientSendTime = 5000
    const roundTrip = 20
    const serverTime = clientSendTime + roundTrip / 2

    expect(computeOffset(clientSendTime, serverTime, roundTrip)).toBe(0)
  })
})

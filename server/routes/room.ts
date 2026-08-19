import { defineWebSocketHandler } from 'h3'

interface PatternUpdateMessage {
  type: 'pattern_update'
  code: string
}

let currentCode = ''

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe('room')
    peer.send(JSON.stringify({ type: 'room_state', code: currentCode }))
  },
  message(peer, message) {
    let data: PatternUpdateMessage
    try {
      data = message.json<PatternUpdateMessage>()
    }
    catch {
      return
    }
    if (data.type === 'pattern_update' && typeof data.code === 'string') {
      currentCode = data.code
      peer.publish('room', JSON.stringify({ type: 'pattern_update', code: data.code }))
    }
  },
})

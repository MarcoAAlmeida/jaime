interface RoomMessage {
  type: 'room_state' | 'pattern_update'
  code: string
}

let ws: WebSocket | undefined

export function sendPatternUpdate(code: string) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'pattern_update', code }))
  }
}

export default defineNuxtPlugin(() => {
  const { code } = useJamSession()

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${protocol}://${location.host}/room`)

  ws.addEventListener('message', (event) => {
    let data: RoomMessage
    try {
      data = JSON.parse(event.data)
    }
    catch {
      return
    }
    if ((data.type === 'room_state' || data.type === 'pattern_update') && typeof data.code === 'string') {
      code.value = data.code
    }
  })
})

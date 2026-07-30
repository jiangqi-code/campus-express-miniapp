import { SOCKET_BASE_URL } from '@/config'

export interface SocketEventPayload {
  event: string
  data: any
}

type Listener = (payload: SocketEventPayload) => void

class MiniSocket {
  private task: UniApp.SocketTask | null = null
  private token = ''
  private manualClose = false
  private reconnectTimer = 0
  private heartbeatTimer = 0
  private listeners = new Set<Listener>()

  connect(token: string) {
    if (!token) return
    this.token = token
    if (this.task) return
    this.manualClose = false
    this.task = uni.connectSocket({
      url: this.buildUrl(token),
      complete: () => undefined,
    })

    this.task.onOpen(() => {
      this.sendRaw(`40${JSON.stringify({ token })}`)
      this.startHeartbeat()
      this.emit({ event: 'socket:open', data: null })
    })

    this.task.onMessage((message) => {
      this.handleMessage(message.data)
    })

    this.task.onClose(() => {
      this.cleanup()
      this.emit({ event: 'socket:close', data: null })
      if (!this.manualClose) {
        this.reconnectTimer = setTimeout(() => this.connect(this.token), 3000) as unknown as number
      }
    })

    this.task.onError((error) => {
      this.emit({ event: 'socket:error', data: error })
    })
  }

  disconnect() {
    this.manualClose = true
    this.task?.close({})
    this.cleanup()
  }

  pauseHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = 0
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private buildUrl(token: string) {
    const query = `EIO=4&transport=websocket&token=${encodeURIComponent(token)}`
    return SOCKET_BASE_URL.includes('?') ? `${SOCKET_BASE_URL}&${query}` : `${SOCKET_BASE_URL}?${query}`
  }

  private emit(payload: SocketEventPayload) {
    this.listeners.forEach((listener) => listener(payload))
  }

  private sendRaw(data: string) {
    this.task?.send({ data })
  }

  private startHeartbeat() {
    this.pauseHeartbeat()
    this.heartbeatTimer = setInterval(() => this.sendRaw('2'), 20000) as unknown as number
  }

  private handleMessage(raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') {
      this.emit({ event: 'message', data: raw })
      return
    }
    if (raw === '2') {
      this.sendRaw('3')
      return
    }
    if (raw.startsWith('42')) {
      try {
        const parsed = JSON.parse(raw.slice(2))
        const [event, data] = parsed
        this.emit({ event, data })
        return
      } catch {
        this.emit({ event: 'message', data: raw })
        return
      }
    }
    this.emit({ event: 'message', data: raw })
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = 0
    }
    this.pauseHeartbeat()
    this.task = null
  }
}

export const miniSocket = new MiniSocket()

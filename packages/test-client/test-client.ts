import WebSocket from 'ws'
import EventEmitter from 'events'

export type MsgType = 'login' | 'danmu'
export interface SocketData {
  type: MsgType
  platform: string
  roomId: string
  gameModel: number
  data: string
}

const socketData = (msg: Partial<SocketData>) => {
  return JSON.stringify({
    platform: '',
    roomId: '',
    gameModel: 0,
    data: '',
    ...msg,
  })
}

export default class TestClient extends EventEmitter {
  private wsOrigin: string
  private pageHoldOn = false
  ws: WebSocket

  constructor(isDev = false) {
    super()
    let wsOrigin = 'ws://124.70.83.120:8181'
    if (isDev) {
      wsOrigin = 'ws://localhost:8181'
    }
    this.wsOrigin = wsOrigin
    this.ws = new WebSocket(this.wsOrigin)
  }

  /**
   * @param {string}
   * @param {string}
   */
  login(platform: string, roomId: string): void {
    const ws = this.ws
    ws.on('open', () => {
      console.log(`连接成功 ${platform}, ${roomId}`)
      if (!this.pageHoldOn) {
        this.pageHoldOn = true
        ws.send(socketData({ type: 'login', platform, roomId }))
      }
    })
    ws.on('error', console.error)
    ws.on('close', (e) => this.emit('close', e))
    ws.on('message', console.info)
  }

  clientSize(): void {
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify({ type: 'clientSize' }))
    })
    this.ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString('utf8'))
      if (data.type === 'clientSize') {
        console.info(msg)
        this.ws.close()
      }
    })
  }
}

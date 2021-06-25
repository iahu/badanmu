import WebSocket from 'ws'
import EventEmitter from 'events'

export type MsgType = 'login' | 'danmu'

const parseMsg = (data: string) => {
  if (data.startsWith('{') || data.startsWith('[')) {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.error('parseMsg Error', e)
      return null
    }
  } else {
    return data
  }
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
    const ws = new WebSocket(this.wsOrigin)
    this.ws = ws

    ws.on('error', console.error)
    ws.on('close', () => console.log('closed'))
  }

  /**
   * @param {string}
   * @param {string}
   */
  login(platform: string, roomId: string): void {
    const ws = this.ws
    ws.on('open', () => {
      console.log(`连接成功 ${platform}, ${roomId}`)
    })
    ws.on('error', console.error)
    ws.on('close', (e) => this.emit('close', e))
    ws.on('message', (buf) => {
      const data = buf.toString('utf8')
      try {
        const msg = JSON.parse(data)
        if (msg.commonType === 1001) {
          ws.send(JSON.stringify({ type: 'login', platform, roomId }))
        }
      } catch (e) {
        console.log('origin msg', data)
      }
    })
  }

  clientSize(): void {
    this.ws.on('open', () => {
      console.log('ws opened')
    })
    this.ws.on('message', (msg) => {
      const data = parseMsg(msg.toString('utf8'))
      console.log('received ws message', msg)
      if (data.type === 'clientSize') {
        console.info(msg)
        this.ws.close()
      } else {
        console.info(data.toString('utf8'))
      }
    })
  }
}

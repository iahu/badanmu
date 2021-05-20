import WebSocket from 'ws'
import chalk from 'chalk'

const colors = [chalk.bold.red, chalk.bold.blue, chalk.bold.yellow]

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

let index = 0

export class MockUser {
  private colorFormatter: chalk.Chalk
  //页面是否准备完成
  private pageHoldOn = false

  private wsOrigin: string

  constructor(isDev = false) {
    let wsOrigin = 'ws://124.70.83.120:8181'
    if (isDev) {
      wsOrigin = 'ws://localhost:8181'
    }
    this.wsOrigin = wsOrigin
    this.colorFormatter = colors[index]
    index++
  }

  private log(message: string) {
    console.log(this.colorFormatter(message))
  }

  /**
   * @param {string}
   * @param {string}
   */
  login(platform: string, roomId: string) {
    const ws = new WebSocket(this.wsOrigin)
    ws.on('open', () => {
      this.log(`连接成功 ${platform}, ${roomId}`)
      if (!this.pageHoldOn) {
        this.pageHoldOn = true
        ws.send(socketData({ type: 'login', platform, roomId }))
      }
    })
    ws.on('error', console.error)
    ws.on('close', console.log)
    ws.on('message', console.info)
  }
}

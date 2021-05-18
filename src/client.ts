import EventEmiter from 'events'
import WebSocket from 'ws'

export type ID = number | string

export interface UserInfo {
  userName?: string
  userId?: ID
  gender?: number
  avatar?: string
}

export interface Noble {
  // 贵族名称
  name: string
  // 类型
  type: number
  // 等级
  level: number
}

interface Msg {
  type: 'comment' | 'gift' | 'system'
  code: number
  data: string
  playerName: string
  commonType: number

  ts: number
  userInfo?: UserInfo
  nobel?: Partial<Noble>

  [k: string]: any
}

export interface Comment extends Msg {
  type: 'comment'
}

export interface Gift extends Msg {
  type: 'gift'
  giftName: string
  /**
   * 总数 = 连击单位数 x 连击次数
   */
  num: number
  /**
   * 连击单位数，默认为 1
   * @type {number}
   */
  combo: number
  /**
   * 连击次数，默认为 1
   * @type {number}
   */
  comboTimes: number
}

export interface SystemInfo extends Msg {
  type: 'system'
}

export type Message = Comment | Gift | SystemInfo

export type Packet = {
  packetLen: number
  headerLen: number
  ver: number
  op: number
  seq: number
  body: Message[]
}

export default abstract class Client extends EventEmiter {
  roomID: ID
  client?: WebSocket
  constructor(roomID: ID) {
    super()
    if (!roomID) throw Error('no parameter "roomID"')
    this.roomID = roomID
  }

  stop(): void {
    this.client?.close()
  }

  on(event: 'open', listener: () => void): this
  on(event: 'message', listener: (messages: Message[]) => void): this
  on(event: 'error', listener: (error: Error) => void): this
  on(event: 'close', listener: (code: number, reason: string) => void): this
  on(event: 'login', listener: (success: boolean) => void): this
  on(event: 'logout', listener: () => void): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }
}

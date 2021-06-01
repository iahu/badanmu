import WebSocket from 'ws'
import protobuf from 'protobufjs'

import { cookies } from './config'
import { decoeMsg } from './decode'
import { getLiveStreamId, getPageId, getTokenInfo, getWebSocketInfo, makeCookie } from './helper'
import { log2 } from '../log'
import Client, { ID } from '../client'
import login, { SessionInfo } from './login'
import protoJson from './kuaishou.proto.json'

const pb = protobuf.Root.fromJSON(protoJson)
const socketMessagePb = pb.lookupType('SocketMessage')

const pbMap = {
  CS_ENTER_ROOM: {
    key: 200,
    value: pb.lookupType('CSWebEnterRoom'),
  },
  CS_HEARTBEAT: {
    key: 1,
    value: pb.lookupType('CSWebHeartbeat'),
  },
  CS_USER_EXIT: {
    key: 202,
    value: pb.lookupType('CSWebUserExit'),
  },
}

type SendPayload = {
  type: keyof typeof pbMap
  [k: string]: any
}

type ClientOption = {
  token: string
  pageId: string
  liveStreamId: string
}

type WsParams = {
  token: string
  liveStreamId: string
  webSocketUrls: string[]
}

export default class Kuaishou extends Client {
  wsParams?: WsParams
  intervalId?: NodeJS.Timeout
  sessionInfo?: SessionInfo

  constructor(roomID: ID) {
    super('kuaishou', roomID)

    // this.login()

    this.start(roomID)
  }

  login = (): void => {
    login(this.requireLogin).then((session) => {
      console.log('session', session)
      this.sessionInfo = session
    })
  }

  getWsParams = async (roomID: ID): Promise<WsParams> => {
    const defaultCookie = makeCookie(cookies)
    const tokenInfo = await getTokenInfo(defaultCookie)
    if (tokenInfo.errorMsg) {
      log2.log(this.roomInfo(), tokenInfo.errorMsg)
      return Promise.reject('连接失败')
    }

    const mergedCookies = {
      ...cookies,
      ...tokenInfo.cookie,
      userId: tokenInfo.userId,
      'kuaishou.live.web_st': tokenInfo['kuaishou.live.web_st'],
      'kuaishou.live.web.at': tokenInfo['kuaishou.live.web.at'],
    }

    const cookie = makeCookie(mergedCookies)

    const liveStreamId = await getLiveStreamId(roomID, cookie)
    if (!liveStreamId) {
      console.log('没获取到 liveStreamId')
      return Promise.reject('没获取到 liveStreamId')
    }

    const wsInfo = await getWebSocketInfo(liveStreamId, cookie)
    const { webSocketUrls, token } = wsInfo

    if (!(webSocketUrls && token)) {
      console.log('账号异常', wsInfo)
      return Promise.reject('账号异常')
    }

    return { webSocketUrls, token, liveStreamId }
  }

  async start(roomID: ID): Promise<void> {
    // const { webSocketUrls, token, liveStreamId } = await this.getWsParams(roomID)
    //         livestreamid = 'ce2AgAVVXf8'
    const wsParams = {
      liveStreamId: 'ce2AgAVVXf8',
      webSocketUrls: ['wss://live-ws-pg-group8.kuaishou.com/websocket'],
      token:
        'Am9Q+j5IHoQzSy0t1EUrqF0v/P1Z1WAsepy96C+PIIMsftmnoT6m2DzW2abo/uVxdsAXD5I8/S2zgFQjwBmSdVPQ8zHzc566izZby/C737G1OyAzb1tboFddz6O9qbdFgp38wl+3sjvRP1HLckGuoLCSJyXLvfDr/MYHR0eLzV0=',
    }
    const { webSocketUrls, token, liveStreamId } = wsParams
    this.wsParams = wsParams

    this.client = this.createClient({ webSocketUrls, token, liveStreamId })
  }

  requireLogin = (dataUrl: string): void => {
    this.emit('requireLogin', dataUrl)
  }

  createClient = (wsParams: WsParams): WebSocket | undefined => {
    const {
      webSocketUrls: [url],
      token,
      liveStreamId,
    } = wsParams

    if (!(url && liveStreamId && token)) {
      log2.debug(this.roomInfo(), '参数不正常', wsParams)
      return undefined
    }

    const client = new WebSocket(url)
    client.binaryType = 'arraybuffer'
    log2.info(this.roomInfo(), 'ws 创建成功', url)

    client.on('open', () => {
      this.emit('open')
      const pageId = getPageId()
      const payload = { liveStreamId, token, pageId }
      this.ping()
      setTimeout(() => this.send({ type: 'CS_ENTER_ROOM', payload }), 1000)
    })

    client.on('close', (code, reason) => {
      this.intervalId && clearInterval(this.intervalId)
      this.emit('close', code, reason)
      log2.log('client closed', code, reason)
    })
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (data) => {
      const buffer = Buffer.from(data as ArrayBufferLike)
      const msg = decoeMsg(buffer)
      if (!msg) {
        return
      }

      this.requestMsg()

      switch (msg.type) {
        case 'SC_ERROR': {
          log2.error('SC_ERROR', msg)
          this.emit('close', -1, 'SC_ERROR')
          this.client?.close()
          break
        }
        case 'SC_ENTER_ROOM_ACK': {
          log2.debug('SC_ENTER_ROOM_ACK', msg.payload.heartbeatIntervalMs.low)
          this.heartbeat(msg.payload.heartbeatIntervalMs.low)
          break
        }
        case 'SC_FEED_PUSH': {
          log2.log('push msg', msg.payload)
          break
        }
        default:
          log2.debug('unkown msg', msg)
          break
      }
    })

    return client
  }

  send = (payload: SendPayload): void => {
    const { type } = payload
    const { key, value } = pbMap[type]
    let err = value.verify(payload.payload || payload)
    if (err) {
      throw err
    }
    const payloadBuf = value.encode(payload.payload || payload).finish()
    err = socketMessagePb.verify({ payloadType: key, payload: payloadBuf })
    if (err) {
      throw err
    }
    const msgBuf = socketMessagePb.encode({ payloadType: key, payload: payloadBuf }).finish()
    log2.info('will send', msgBuf.byteLength, 'bytes:', JSON.stringify(payload))
    this.client?.send(msgBuf)
  }

  requestMsg = (): void => {
    const payload = this.wsParams
    const pageId = getPageId()

    this.send({ type: 'CS_ENTER_ROOM', payload: { ...payload, pageId } })
  }

  ping = (): void => {
    this.send({ type: 'CS_HEARTBEAT', timestamp: Date.now().valueOf() })
  }

  heartbeat = (interval = 20000): void => {
    if (!this.client) {
      return
    }
    this.ping()
    this.intervalId = setInterval(() => {
      if (!this.client?.CLOSED) {
        this.ping()
      } else if (this.intervalId) {
        clearInterval(this.intervalId)
      }
    }, interval)
  }
}

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

export default class Kuaishou extends Client {
  stream_id?: string
  intervalId?: NodeJS.Timeout
  sessionInfo?: SessionInfo

  constructor(roomID: ID) {
    super(roomID)

    // this.login()

    this.start(roomID).catch((e) => {
      this.emit('error', e)
      this.emit('close', 0, e)
    })
  }

  login = (): void => {
    login(this.requireLogin).then((session) => {
      console.log('session', session)
      this.sessionInfo = session
    })
  }

  async start(roomID: ID): Promise<WebSocket | undefined> {
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
    const pageId = getPageId()

    if (!(webSocketUrls && token)) {
      console.log('账号异常', wsInfo)
      return Promise.reject('账号异常')
    }

    this.client = this.createClient(webSocketUrls[0], {
      token,
      pageId,
      liveStreamId,
    })
    return this.client
  }

  requireLogin = (dataUrl: string): void => {
    this.emit('requireLogin', dataUrl)
  }

  createClient = (url: string, option: ClientOption): WebSocket | undefined => {
    const { pageId, liveStreamId, token } = option
    if (!(url && liveStreamId && token)) {
      log2.debug(this.roomInfo(), '参数不正常', option)
      return undefined
    }

    const client = new WebSocket(url, {
      headers: {
        Cookie: 'userId=1736972579; client_key=65890b29; clientid=3; did=web_0cdd6cd1840f8db9adc2dab65dd82830',
      },
    })
    log2.info(this.roomInfo(), 'ws 创建成功', url)

    const payload = { liveStreamId, token, pageId }
    client.on('open', () => {
      this.emit('open')
      setTimeout(() => {
        this.send({ type: 'CS_ENTER_ROOM', payload })
        this.heartbeat()
      }, 1000)
    })

    client.on('close', (code, reason) => {
      this.intervalId && clearInterval(this.intervalId)
      this.emit('close', code, reason)
      // client.close()
      log2.log('client closed', code, reason)
    })
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (data) => {
      const buffer = Buffer.from(data as ArrayBufferLike)
      const msg = decoeMsg(buffer)
      console.log('msg', buffer.byteLength, msg)
      if (!msg) {
        return
      }

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
          console.log('push msg', msg.payload)
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
    console.log('will send', msgBuf.buffer.byteLength, 'bytes data')
    this.client?.send(msgBuf)
  }

  heartbeat = (interval = 20000): void => {
    if (!this.client) {
      return
    }
    this.intervalId = setInterval(() => {
      if (!this.client?.CLOSED) {
        this.send({ type: 'CS_HEARTBEAT', timestamp: Date.now().valueOf() })
      } else if (this.intervalId) {
        clearInterval(this.intervalId)
      }
    }, interval)
  }
}

import WebSocket from 'ws'
import protobuf from 'protobufjs'

import { PageInfo, getLiveStreamId, getPageId, getTokenInfo, getWebSocketInfo, makeCookie } from './helper'
import { cookies } from './config'
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
  pageInfo?: PageInfo
  sessionInfo?: SessionInfo

  constructor(roomID: ID) {
    super(roomID)

    login(this.requireLogin)
      .then((session) => {
        console.log('session', session)
        this.sessionInfo = session
        return session
      })
      .then(() => this.start(roomID))
      .catch((e) => {
        this.emit('error', e)
        this.emit('close', 0, e)
      })
  }

  async start(roomID: ID): Promise<WebSocket | undefined> {
    const session = this.sessionInfo || ({} as SessionInfo)
    const defaultCookie = makeCookie({
      ...cookies,
      passToken: session.passToken,
      'kuaishou.live.web_st': session['kuaishou.live.web_st'],
      'kuaishou.live.web.at': session['kuaishou.live.web.at'],
      userId: session.userId,
    })
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
    console.log('payload', payload)
    client.on('open', () => {
      this.emit('open')
      this.send({ type: 'CS_ENTER_ROOM', payload })
      setTimeout(() => this.heartbeat(), 20000)
    })

    client.on('close', (has_error, reason) => {
      this.intervalId && clearInterval(this.intervalId)
      this.emit('close', has_error, reason)
    })
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (msg) => this.emit('message', msg as any))

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
    this.client?.send(msgBuf.slice().buffer)
  }

  heartbeat = (): void => {
    this.intervalId = setInterval(() => {
      this.send({ type: 'CS_HEARTBEAT', timestamp: Date.now().valueOf() })
    }, 20000)
  }
}

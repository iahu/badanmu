import WebSocket from 'ws'
import protobuf from 'protobufjs'

import {
  PageInfo,
  getLiveDetail,
  getLiveStreamId,
  getPageId,
  getPageInfo,
  getTokenInfo,
  getWebSocketInfo,
  makeCookie,
  parseCookie,
} from './helper'
import { cookies } from './config'
import { log2 } from '../log'
import Client, { ID } from '../client'
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

  constructor(roomID: ID) {
    super(roomID)

    this.start(roomID).catch((e) => {
      this.emit('error', e)
      this.emit('close', 0, e)
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
      did: tokenInfo.cookie.did,
      passToken: tokenInfo.passToken,
      userId: tokenInfo.userId,
      'kuaishou.live.web_st': tokenInfo['kuaishou.live.web_st'],
      'kuaishou.live.web.at': tokenInfo['kuaishou.live.web.at'],
    }
    const cookie = makeCookie(tokenInfo.cookie)

    // const pageInfo = await getPageInfo(roomID)
    // const { cookie } = pageInfo
    // const pageCookies = parseCookie(pageInfo.cookie)
    const streamCookie = makeCookie({
      did: mergedCookies.did,
      userId: mergedCookies.userId,
      'kuaishou.live.web_st': mergedCookies['kuaishou.live.web_st'],
    })

    const liveDetail = await getLiveDetail(roomID, cookie)
    console.log('what', liveDetail)

    const liveStreamId = await getLiveStreamId(roomID, streamCookie)
    console.log('liveStreamId', liveStreamId)
    if (!liveStreamId) {
      console.log('没获取到 liveStreamId')
      // return Promise.reject('没获取到 liveStreamId')
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

    const client = new WebSocket(url)
    log2.info(this.roomInfo(), 'ws 创建成功', url)

    const payload = { liveStreamId, token, pageId }
    client.on('open', () => {
      this.emit('open')
      this.send({ type: 'CS_ENTER_ROOM', payload })
      this.heartbeat()
    })

    client.on('close', (has_error, reason) => this.emit('close', has_error, reason))
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (msg) => this.emit('message', msg as any))

    return client
  }

  send = (payload: SendPayload): void => {
    const { type } = payload
    const { key, value } = pbMap[type]
    const payloadBuf = value.encode(payload.payload || payload).finish()
    const msgBuf = socketMessagePb.encode({ payloadType: key, payload: payloadBuf }).finish()

    this.client?.send(msgBuf.buffer)
  }

  heartbeat = (): void => {
    this.intervalId = setInterval(() => {
      this.send({ type: 'CS_HEARTBEAT', timestamp: Date.now().valueOf() })
    }, 30000)
  }
}

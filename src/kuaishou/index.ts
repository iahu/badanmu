import WebSocket from 'ws'
import protobuf from 'protobufjs'

import { PageInfo, WebSocketInfo, getPageInfo, getWebSocketInfo } from './helper'
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

export default class Kuaishou extends Client {
  stream_id?: string
  intervalId?: NodeJS.Timeout
  pageInfo?: PageInfo

  constructor(roomID: ID) {
    super(roomID)

    this.start(roomID)
  }

  async start(roomID: ID): Promise<WebSocket | undefined> {
    const pageInfo = await getPageInfo(roomID, this.requireLogin)

    if (!(pageInfo.liveStreamId && pageInfo.cookie)) {
      log2.info('参数不正常', pageInfo)
      return
    }

    const wsInfo = await getWebSocketInfo(pageInfo)

    this.client = this.createClient(pageInfo, wsInfo)
    return this.client
  }

  requireLogin = (dataUrl: string): void => {
    this.emit('requireLogin', dataUrl)
  }

  createClient = (pageInfo: PageInfo, wsInfo: WebSocketInfo): WebSocket | undefined => {
    const { pageId, liveStreamId } = pageInfo
    const { webSocketUrls, token } = wsInfo
    if (!(webSocketUrls && liveStreamId && token)) {
      log2.debug('参数不正常', wsInfo)
      return undefined
    }

    const client = new WebSocket(webSocketUrls[0])
    log2.info('ws 创建成功', webSocketUrls[0])

    const payload = { liveStreamId, token, pageId }
    client.on('open', () => {
      this.emit('open')
      this.send({ type: 'CS_ENTER_ROOM', payload })
      this.heartbeat()
    })

    client.on('close', (has_error, reason) => this.emit('close', has_error, reason))
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (msg) => this.emit('message', msg))

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

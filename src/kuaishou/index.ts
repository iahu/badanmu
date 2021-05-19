import WebSocket from 'ws'
import fetch from 'node-fetch'
import protobuf from 'protobufjs'

import { WebSocketInfo, getPageId, getWebSocketInfo } from './helper'
import { cookie } from './config'
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
  pageId: string

  constructor(roomID: ID) {
    super(roomID)

    this.pageId = getPageId()

    this.getLiveStreamId(roomID)
      .then((stream_id) => {
        this.stream_id = stream_id
        return stream_id
      })
      .then(getWebSocketInfo)
      .then(this.createClient)
  }

  createClient = (wsInfo: WebSocketInfo): WebSocket => {
    const { webSocketUrls, liveStreamId, token } = wsInfo
    const client = new WebSocket(webSocketUrls[0])
    const payload = { liveStreamId, token, pageId: this.pageId }

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

  getLiveStreamId = (roomID: ID): Promise<string> => {
    return fetch(`https://live.kuaishou.com/u/${roomID}`, {
      headers: {
        Cookie: cookie,
      },
      method: 'GET',
    })
      .then((t) => t.text())
      .then((html) => {
        const match = html.match(/live-stream-id="(\w+)"/)
        if (match) {
          return match[1]
        }
        return ''
      })
  }
}

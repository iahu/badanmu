import { Writer } from 'protobufjs'
import fetch from 'node-fetch'

import { cookie } from './config'

export const getPageId = (len = 16): string => {
  const seed = '-_zyxwvutsrqponmlkjihgfedcba9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA'

  let token = ''
  for (let r = len; r--; ) token += seed[(64 * Math.random()) | 0]

  return [token, Date.now()].join('_')
}

type EncodePayload = {
  token: string
  liveStreamId: string
  reconnectCount: number
  lastErrorCode: number
  expTag: string
  attach: string
  pageId: string
}

export const encode = (payload: EncodePayload, writer: Writer): Writer => {
  if (!writer) writer = Writer.create()
  if (payload.token) writer.uint32(10).string(payload.token)
  if (payload.liveStreamId) writer.uint32(18).string(payload.liveStreamId)
  if (payload.reconnectCount) writer.uint32(24).uint32(payload.reconnectCount)
  if (payload.lastErrorCode) writer.uint32(32).uint32(payload.lastErrorCode)
  if (payload.expTag) writer.uint32(42).string(payload.expTag)
  if (payload.attach) writer.uint32(50).string(payload.attach)
  if (payload.pageId) writer.uint32(58).string(payload.pageId)

  return writer
}

export type WebSocketInfo = {
  liveStreamId: string
  token: string
  webSocketUrls: string[]
  __typename: 'WebSocketInfoResult'
}

export const getWebSocketInfo = (liveStreamId: string): Promise<WebSocketInfo> => {
  return fetch('https://live.kuaishou.com/live_graphql', {
    headers: {
      accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
      'content-type': 'application/json',
      'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      cookie,
    },
    // referrer: 'https://live.kuaishou.com/u/KPL704668133',
    // referrerPolicy: 'unsafe-url',
    body: `{"operationName":"WebSocketInfoQuery","variables":{"liveStreamId":"${liveStreamId}"},"query":"query WebSocketInfoQuery($liveStreamId: String) {\\n  webSocketInfo(liveStreamId: $liveStreamId) {\\n    token\\n    webSocketUrls\\n    __typename\\n  }\\n}\\n"}`,
    method: 'POST',
    // mode: 'cors',
  })
    .then((t) => t.json())
    .then((t) => ({ ...t.data.webSocketInfo, liveStreamId }))
}

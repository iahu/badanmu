import fetch from 'node-fetch'
import { Writer } from 'protobufjs'

const token = (len = 16) => {
  let n: string
  let r: number
  for (n = '-_', r = 36; r--; ) n += r.toString(36)
  for (let r = 36; r-- - 10; ) n += r.toString(36).toUpperCase()

  let e = ''
  for (r = len; r--; ) e += n[(64 * Math.random()) | 0]
  return e
}

export const pageID = (): string => [token(), Date.now()].join('_')

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

type WebSocketInfo = {
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
      cookie:
        'kuaishou.live.bfb1s=ac5f27b3b62895859c4c1622f49856a4; clientid=3; did=web_7e51045128f24186e3071da93fec3b7c; client_key=65890b29; kpn=GAME_ZONE; soft_did=1619580708547; userId=2363789227; userId=2363789227; kuaishou.live.web_st=ChRrdWFpc2hvdS5saXZlLndlYi5zdBKgAaaIJ6wPw0BzBHc7OPgIz5Z8ZyERolArXnGBihEW2rThzr7NwUIb-2WsRaD6g11OLP30XO-gCdtiVsu9iphKFJlC2r4G4-3FFjtnu4TnD3y6J8a0y9yA_MYyxNtZlzFq7cbAmHy5vUlMOQYB5s9OqCjdmEm6I12lZVXrpeD70xKxIqOtd-MROlhzLGBLEye254-0h108hl87pdgW1cCT-WYaEsvpGUru20c-iIt7T0W8MQrXwiIgKmKNwwAQ0iditiOD0JYaXen8HbPtoiqxikx4q2B8PQ8oBTAB; kuaishou.live.web_ph=e7915482f9951bb1f19a90a6b07a33bcbea9',
    },
    // referrer: 'https://live.kuaishou.com/u/KPL704668133',
    // referrerPolicy: 'unsafe-url',
    body: `{"operationName":"WebSocketInfoQuery","variables":{"liveStreamId":"${liveStreamId}"},"query":"query WebSocketInfoQuery($liveStreamId: String) {\\n  webSocketInfo(liveStreamId: $liveStreamId) {\\n    token\\n    webSocketUrls\\n    __typename\\n  }\\n}\\n"}`,
    method: 'POST',
    // mode: 'cors',
  }).then((t) => t.json())
  // .then((t) => t.data)
}

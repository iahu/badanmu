import WebSocket from 'ws'
import fetch from 'node-fetch'

import { getWebSocketInfo } from './helper'
import Client, { ID } from '../client'

export default class Kuaishou extends Client {
  constructor(roomID: ID) {
    super(roomID)

    // this.client = this.createClient()
    // this.listen()

    this.getLiveStreamId(roomID).then(getWebSocketInfo).then(console.log)
  }

  createClient(): WebSocket {
    const client = new WebSocket('wss://live-ws-pg-group3.kuaishou.com/websocket')

    return client
  }

  listen = (): void => {
    const client = this.client as WebSocket

    client.on('open', () => {
      this.emit('open')
      console.log('open')
    })
    client.on('close', (has_error) => this.emit('close', has_error))
    client.on('error', (error) => this.emit('error', error))
    client.on('message', (msg) => this.emit('message', msg))
  }

  getLiveStreamId = (roomID: ID): Promise<string> => {
    return fetch(`https://live.kuaishou.com/u/${roomID}`, {
      headers: {
        // Connection: 'keep-alive',
        // 'Cache-control': 'max-age=0',
        // 'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
        // 'sec-ch-ua-mobile': '?0',
        // DNT: '1',
        // 'Upgrade-insecure-requests': '1',
        // 'User-Agent':
        //   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        // Accept:
        //   'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        // 'Sec-Fetch-Site': 'none',
        // 'Sec-Fetch-Mode': 'navigate',
        // 'Sec-Fetch-User': '?1',
        // 'Sec-Fetch-Dest': 'document',
        // 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
        Cookie:
          'kuaishou.live.bfb1s=ac5f27b3b62895859c4c1622f49856a4; clientid=3; did=web_7e51045128f24186e3071da93fec3b7c; client_key=65890b29; kpn=GAME_ZONE; soft_did=1619580708547; userId=2363789227; userId=2363789227; kuaishou.live.web_st=ChRrdWFpc2hvdS5saXZlLndlYi5zdBKgAaaIJ6wPw0BzBHc7OPgIz5Z8ZyERolArXnGBihEW2rThzr7NwUIb-2WsRaD6g11OLP30XO-gCdtiVsu9iphKFJlC2r4G4-3FFjtnu4TnD3y6J8a0y9yA_MYyxNtZlzFq7cbAmHy5vUlMOQYB5s9OqCjdmEm6I12lZVXrpeD70xKxIqOtd-MROlhzLGBLEye254-0h108hl87pdgW1cCT-WYaEsvpGUru20c-iIt7T0W8MQrXwiIgKmKNwwAQ0iditiOD0JYaXen8HbPtoiqxikx4q2B8PQ8oBTAB; kuaishou.live.web_ph=e7915482f9951bb1f19a90a6b07a33bcbea9',
      },
      method: 'GET',
    })
      .then((t) => t.text())
      .then((html) => {
        const match = html.match(/live-stream-id="(\w+)"/)
        if (match) {
          console.log('live-stream-id', match[1])
          return match[1]
        }
        return ''
      })
  }
}

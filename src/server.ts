import WebSocket from 'ws'

import { Message } from './client'
import { getCommonType, CommonType } from './helper'
import Bilibili from './bilibili'
import Douyu from './douyu'
import Huya from './huya'
import Kuaishou from './kuaishou'
import log from './log'

const [port] = process.argv.slice(2)

type ClientMessage = {
  type?: string
  platform: string
  roomId: string | number
}

type Client = Bilibili | Douyu | Huya | Kuaishou

const parseClientMsg = (data: string) => {
  if (data === '') {
    return ''
  }
  try {
    return JSON.parse(data) as ClientMessage | string
  } catch (e) {
    log.error('parse client message failed', data)
    // throw Error(e)
    return null
  }
}

const clientCache = {} as Record<string, Client>
const createClient = (platform: string, roomId: number | string, ws: WebSocket): Client | undefined => {
  const cacheKey = `${platform}@=${roomId}`
  const cachedClient = clientCache[cacheKey]
  if (cachedClient) {
    return cachedClient
  }

  let client: Client | undefined
  if (platform === 'bilibili') {
    client = new Bilibili(roomId)
  } else if (platform === 'douyu') {
    client = new Douyu(roomId)
  } else if (platform === 'huya') {
    client = new Huya(roomId)
  } else if (platform === 'kuaishou') {
    client = new Kuaishou(roomId)
  } else {
    log.info('收到未知平台的消息请求', platform)
  }

  if (!client) return

  const roomName = `${platform}平台，${roomId}房间`
  log.info(`开始监听${roomName}`)

  const onMessage = (msg: Message) => {
    if (!msg) {
      return
    }
    const commonType = getCommonType(msg.data) as number
    const msgWithComType = JSON.stringify({ ...msg, commonType })

    log.info(`接收到${roomName}的消息`, msgWithComType)
    ws.send(msgWithComType)
  }
  const cleaup = () => {
    client?.off('message', onMessage)
    delete clientCache[cacheKey]
  }

  client.on('message', onMessage)

  ws.once('close', () => {
    log.info(`${roomName} closed`)
    client?.off('message', onMessage)
    client?.stop()
  })

  client.on('close', () => {
    cleaup()
    log.info('client closed')
    ws.send('close')
  })
  client.on('error', (e) => {
    cleaup()
    log.error('client error', e)
    ws.send('error')
  })

  clientCache[cacheKey] = client
  return client
}

const main = (port: number) => {
  const server = new WebSocket.Server({ port })

  log.info(`WebSocket 服务器正在监听 ${port} 端口`)

  server.on('connection', (ws) => {
    log.info('收到连接请求')
    ws.on('message', (message) => {
      let requestBody = message.toString('utf8').trim()
      if (requestBody === '') {
        // 忽略空消息
        return
      } else if (requestBody === 'ping') {
        requestBody = '{type: "ping"}'
      }

      log.info('收到消息', requestBody)

      const msg = parseClientMsg(requestBody)

      if (!(msg && typeof msg === 'object' && msg.type)) {
        log.info('未知消息', requestBody)
        return ws.send('未知消息')
      }

      const { type, platform, roomId } = msg

      if (type === 'login') {
        if (platform && roomId) {
          const client = createClient(platform, roomId, ws)
          if (client) {
            ws.send(JSON.stringify({ type: 'loginResponse', data: 'success', commonType: CommonType.CONECT_HOLD }))
          }
        } else {
          return ws.send('参数错误')
        }
      } else if (type === 'ping') {
        return ws.send('pong')
      } else {
        log.info('其它消息', message)
      }
    })
  })
}

main(parseInt(port) || 8181)

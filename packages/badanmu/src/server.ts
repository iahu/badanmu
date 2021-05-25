import WebSocket from 'ws'

import { CommonType, getCommonType, stringify } from './helper'
import { Message } from './client'
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

const createClient = (platform: string, roomId: number | string, ws: WebSocket): Client | undefined => {
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

  const roomInfo = client.roomInfo()
  log.info(`开始监听${roomInfo}`)

  const onMessage = (msg: Message) => {
    if (!msg) {
      return
    }
    const commonType = getCommonType(msg.data) as number
    const msgWithComType = stringify({ ...msg, commonType, roomId })

    log.info(`接收到${roomInfo}的消息`, msgWithComType)
    ws.send(msgWithComType)
  }
  const cleanup = () => {
    client?.off('message', onMessage)
    client?.stop()
  }

  client.once('open', () => {
    ws.send(stringify({ type: 'loginResponse', data: 'success', roomId }))
  })
  client.on('message', onMessage)
  client.once('close', (code, reason) => {
    cleanup()
    log.info(roomInfo, 'client closed', code, reason)
    ws.send('close')
    ws.close()
  })
  client.on('error', (e) => {
    cleanup()
    log.error(roomInfo, 'client error', e)
    ws.send('error')
  })

  ws.once('close', () => {
    log.info(roomInfo, 'closed')
    cleanup()
  })

  return client
}

const main = (port: number) => {
  const server = new WebSocket.Server({ port })

  log.info(`WebSocket 服务器正在监听 ${port} 端口`)

  server.on('connection', (ws) => {
    log.info('收到连接请求')

    ws.send(stringify({ commonType: CommonType.CONECT_HOLD }))

    ws.on('message', (message) => {
      const requestBody = message.toString('utf8').trim()
      log.info('收到消息', requestBody)

      if (requestBody === '') {
        // 忽略空消息
        return
      } else if (requestBody === 'ping') {
        ws.send('pong')
        return
      }

      const msg = parseClientMsg(requestBody)

      if (!(msg && typeof msg === 'object')) {
        log.info('未知消息', requestBody)
        return ws.send('未知消息')
      }

      const { type, platform, roomId } = msg

      if (type === 'login' || (platform && roomId)) {
        if (platform && roomId) {
          createClient(platform, roomId, ws)
        } else {
          ws.send('参数错误')
        }
      } else if (type === 'clientSize') {
        ws.send(JSON.stringify({ type: 'clientSize', data: server.clients.size }))
      } else {
        log.info('其它消息', message)
      }
    })
  })
}

main(parseInt(port) || 8181)

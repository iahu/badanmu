import WebSocket from 'ws'

import { CommonType, getCommonType, stringify } from './helper'
import { Message } from './client'
import Bilibili from './bilibili'
import Douyu from './douyu'
import Huya from './huya'
import Kuaishou from './kuaishou'
import log from './log'
import { createClient } from 'create-client'

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

const listenToUpstream = (wsServer: WebSocket, upstream: Client, roomId: number | string): Client | undefined => {
  const roomInfo = upstream.roomInfo()
  log.info(`开始监听${roomInfo}`)

  const onMessage = (msg: Message) => {
    if (!msg) {
      return
    }
    const commonType = getCommonType(msg.data) as number
    const msgWithComType = stringify({ ...msg, commonType, roomId })

    log.info(`接收到${roomInfo}的消息`, msgWithComType)
    wsServer.send(msgWithComType)
  }
  const cleanup = () => {
    upstream?.off('message', onMessage)
    upstream?.stop()
  }

  upstream.once('open', () => {
    wsServer.send(stringify({ type: 'loginResponse', data: 'success', roomId }))
  })
  upstream.on('message', onMessage)
  upstream.once('close', (code, reason) => {
    cleanup()
    log.info(roomInfo, 'client closed', code, reason)
    wsServer.send(stringify({ type: 'close', code, data: reason }))
    wsServer.close()
  })
  upstream.on('error', (e) => {
    cleanup()
    log.error(roomInfo, 'client error', e)
    wsServer.send(stringify({ type: 'close', code: 1, data: e.message }))
  })

  wsServer.once('close', (code, reason) => {
    log.info(roomInfo, 'closed', code, reason)
    cleanup()
  })

  return upstream
}

export const main = (port: number): void => {
  const server = new WebSocket.Server({ port })

  log.info(`WebSocket 服务器正在监听 ${port} 端口`)

  server.on('error', (error) => {
    log.error('server error', error)
  })

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
          const upstream = createClient(platform, roomId)
          if (!upstream) {
            log.info('收到未知平台的消息请求', platform)
            return
          }

          upstream.platform = platform
          listenToUpstream(ws, upstream, roomId)
        } else {
          ws.send('参数错误')
        }
      } else if (type === 'clientSize') {
        ws.send(stringify({ type: 'clientSize', data: server.clients.size }))
      } else {
        log.info('其它消息', message)
      }
    })
  })
}

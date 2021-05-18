import WebSocket from 'ws'

import Bilibili from './bilibili'
import Douyu from './douyu'
import Huya from './huya'
import Kuaishou from './kuaishou'
import log, { log2 } from './log'

const [port] = process.argv.slice(2)

type ClientMessage = {
  platform: string
  roomId: string | number
}

const parseClientMsg = (data: string) => {
  try {
    return JSON.parse(data) as ClientMessage
  } catch (e) {
    log.error(e)
    throw Error(e)
  }
}

const main = (port: number) => {
  const server = new WebSocket.Server({ port })

  log.info(`WebSocket 服务器正在监听 ${port} 端口`)

  server.on('connection', (ws) => {
    log.info('收到连接请求')
    ws.on('message', (message) => {
      log2.info('收到消息', message)

      ws.send(`recived, ${message}`)
      const msg = parseClientMsg(message.toString('utf8'))
      const { platform, roomId } = msg

      if (!(platform && roomId)) {
        log.log('其它消息', msg)
        return ws.send(`recived ${message}`)
      }

      // 连接消息
      let client: Bilibili | Douyu | Huya | Kuaishou | undefined
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

      const roomName = `${platform} 平台，${roomId} 房间`
      log.info(`开始监听 ${roomName}`)

      client.on('message', (msg) => {
        log.info(`接收到 ${roomName} 的消息`, JSON.stringify(msg))
        ws.send(JSON.stringify(msg))
      })

      ws.once('close', () => {
        log.info(`${roomName} closed`)
        client?.stop()
      })

      client.on('close', () => {
        ws.send('close')
      })
      client.on('error', () => {
        ws.send('error')
      })
    })
  })
}

main(parseInt(port) || 8181)

import WebSocket from 'ws'
import fetch from 'node-fetch'

import Client, { Gift, Comment } from '../client'
import { HUYA, Taf, TafMx } from './lib'
import { getCommetMsg, getGiftMsg } from './helper'
import toArrayBuffer from './to-arraybuffer'

type ID = string | number

type ChatInfo = {
  subsid: number
  topsid: number
  yyuid: number
}

const heartbeat_interval = 60 * 1000
const fresh_gift_interval = 60 * 60 * 1000

const userAgent =
  'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Mobile Safari/537.36'
export default class Huya extends Client {
  static url = 'wss://cdnws.api.huya.com'
  platform_id = '10002'
  clientName = '接收线程'
  client?: WebSocket
  _main_user_id: HUYA.UserId
  chatInfo = {} as ChatInfo
  heartbeatTimer?: NodeJS.Timeout
  freshGiftListTimer?: NodeJS.Timeout
  isLogin = false
  isRun = true
  room_id: ID
  nickname: string
  cookies: string
  startTime: number
  // _chat_list: List

  constructor(roomID: ID) {
    super(roomID)
    this.nickname = ''
    this.cookies = ''
    this.startTime = Date.now()
    // this._chat_list = new List()

    this.room_id = roomID
    this._main_user_id = new HUYA.UserId()
    this.getChatInfo()
      .then((info) => {
        this.chatInfo = info
        this._main_user_id.lUid = info.yyuid
        this._main_user_id.sHuYaUA = 'webh5&1.0.0&websocket'
      })
      .then(() => {
        this.client = this.createClient()
      })
      .catch((e) => {
        console.log('出错了')
        console.error(e)
      })
  }

  getChatInfo(): Promise<ChatInfo> {
    return fetch(`https://m.huya.com/${this.room_id}`, {
      headers: { 'User-Agent': userAgent },
    })
      .then((t) => t.text())
      .then((body) => {
        const subsid_array = body.match(/var SUBSID = '(.*)';/)
        const topsid_array = body.match(/var TOPSID = '(.*)';/)
        const yyuid_array = body.match(/ayyuid: '(.*)',/)

        if (!subsid_array || !topsid_array || !yyuid_array) return Promise.reject('没找到页面信息')

        return {
          subsid: subsid_array[1] === '' ? 0 : parseInt(subsid_array[1]),
          topsid: topsid_array[1] === '' ? 0 : parseInt(topsid_array[1]),
          yyuid: parseInt(yyuid_array[1]),
        }
      })
  }

  createClient = (): WebSocket => {
    const client = new WebSocket('ws://ws.api.huya.com')

    client.on('open', () => {
      this.requestGiftInfo()
      this.requestWsInfo()
      this.requestChatInfo()
      this.freshGiftListTimer = setInterval(this.requestGiftInfo.bind(this), fresh_gift_interval)

      this.ping()
      this.heartbeatTimer = setInterval(this.ping.bind(this), heartbeat_interval)
      this.emit('open')
    })

    client.on('error', (hasError) => {
      console.log('error', hasError)
    })

    client.on('close', () => {
      console.log('close')
    })

    client.on('message', (data) => {
      try {
        const buffer = toArrayBuffer(data as Buffer)
        let stream = new Taf.JceInputStream(buffer)
        const command = new HUYA.WebSocketCommand()
        command.readFrom(stream)

        switch (command.iCmdType) {
          case HUYA.EWebSocketCommandType.EWSCmd_WupRsp:
            try {
              const wup = new Taf.Wup()
              wup.decode(command.vData.buffer)
              const map = new TafMx.WupMapping[wup.sFuncName]()
              wup.readStruct('tRsp', map, TafMx.WupMapping[wup.sFuncName])
              this.emit(wup.sFuncName, map)
            } catch (e) {
              console.error('返回方法处理异常', e)
            }
            break
          case HUYA.EWebSocketCommandType.EWSCmdS2C_MsgPushReq: {
            this.isLogin = true
            stream = new Taf.JceInputStream(command.vData.buffer)
            const msg = new HUYA.WSPushMessage()
            msg.readFrom(stream)
            stream = new Taf.JceInputStream(msg.sMsg.buffer)
            if (TafMx.UriMapping[msg.iUri]) {
              const map = new TafMx.UriMapping[msg.iUri]()
              map.readFrom(stream)

              let body: Gift | Comment | undefined
              if (map?.sPropsName) {
                body = getGiftMsg({ code: -1, body: map as any })
              } else if (map.body?.sPropsName) {
                body = getGiftMsg(map)
              } else if (map.sContent) {
                body = getCommetMsg({ code: -1, body: map })
              }

              if (body) {
                this.emit('message', {
                  code: msg.iUri,
                  body,
                })
              }
            }
            break
          }
          // case HUYA.EWebSocketCommandType.EWSCmdS2C_VerifyCookieRsp: {
          //   stream = new Taf.JceInputStream(command.vData.buffer)
          //   const g = new HUYA.WSVerifyCookieRsp()
          //   g.readFrom(stream)
          //   this.isLogin = g.iValidate == 0
          //   if (this.isLogin) {
          //     console.info(this.getInfo() + '登录成功')
          //     this.emit('loginSuccess')
          //     this.heartbeat()
          //     this.heartbeatTimer = setInterval(this.heartbeat.bind(this), heartbeat_interval)
          //   } else {
          //     console.info(this.getInfo() + '登录失败')
          //     this.emit('loginFail')
          //     this.isRun = false
          //     this.exit()
          //   }
          //   break
          // }
          default:
            break
        }
      } catch (e) {
        console.error('接收信息出错', e)
      }
    })

    return client
  }

  exit(): void {
    this.isRun = false
    this.isLogin = false
    if (this.client) {
      this.client.close()
    }
  }

  getInfo(): string {
    let info = this.clientName + ';平台=' + this.platform_id + ';房间=' + this.room_id + ';'
    if (this.nickname) {
      info += '账号=' + this.nickname + ';'
    }
    return info
  }

  requestGiftInfo(): void {
    const prop_req = new HUYA.GetPropsListReq()
    prop_req.tUserId = this._main_user_id
    prop_req.iTemplateType = HUYA.EClientTemplateType.TPL_MIRROR
    this.send_wup('PropsUIServer', 'getPropsList', prop_req)
  }

  requestWsInfo(): void {
    const ws_user_info = new HUYA.WSUserInfo()
    ws_user_info.lUid = this.chatInfo.yyuid
    ws_user_info.bAnonymous = 0 == this.chatInfo.yyuid
    ws_user_info.sGuid = this._main_user_id.sGuid
    ws_user_info.sToken = ''
    ws_user_info.lTid = this.chatInfo.topsid
    ws_user_info.lSid = this.chatInfo.subsid
    ws_user_info.lGroupId = this.chatInfo.yyuid
    ws_user_info.lGroupType = 3
    let jce_stream = new Taf.JceOutputStream()
    ws_user_info.writeTo(jce_stream)
    const ws_command = new HUYA.WebSocketCommand()
    ws_command.iCmdType = HUYA.EWebSocketCommandType.EWSCmd_RegisterReq
    ws_command.vData = jce_stream.getBinBuffer()
    jce_stream = new Taf.JceOutputStream()
    ws_command.writeTo(jce_stream)
    this.client?.send(jce_stream.getBuffer())
  }

  requestChatInfo(): void {
    const t = new HUYA.WSRegisterGroupReq()
    t.vGroupId.value.push('live:' + this.chatInfo.yyuid)
    t.vGroupId.value.push('chat:' + this.chatInfo.yyuid)

    let e = new Taf.JceOutputStream()
    t.writeTo(e)

    const i = new HUYA.WebSocketCommand()
    i.iCmdType = HUYA.EWebSocketCommandType.EWSCmdC2S_RegisterGroupReq
    i.vData = e.getBinBuffer()

    e = new Taf.JceOutputStream()
    i.writeTo(e)

    this.client?.send(e.getBuffer())
  }

  // heartbeat(): void {
  //   const heart_beat_req = new HUYA.UserHeartBeatReq()
  //   const user_id = new HUYA.UserId()
  //   user_id.sHuYaUA = 'webh5&1.0.0&websocket'
  //   heart_beat_req.tId = user_id
  //   heart_beat_req.lTid = this.chatInfo.topsid
  //   heart_beat_req.lSid = this.chatInfo.subsid
  //   heart_beat_req.lPid = this.chatInfo.yyuid
  //   heart_beat_req.eLineType = 1
  //   this.send_wup('onlineui', 'OnUserHeartBeat', heart_beat_req)
  // }

  ping = (): void => {
    if (!this.isRun) {
      this.exit()
      return
    }
    const currTime = Date.now()
    if (currTime - this.startTime > 30 * 1000 && !this.isLogin) {
      console.info(this.getInfo() + '登录超时')
      this.exit()
      return
    }
    const req = new HUYA.VideoGatewayProxy2VGPingReq()
    req.lLocalTime = (0.001 * currTime) >> 0
    this.send_wup('videogateway', 'videoGatewayProxy2VGPing', req)
  }

  send_wup(action: string, callback: string, req: any): void {
    try {
      const wup = new Taf.Wup()
      wup.setServant(action)
      wup.setFunc(callback)
      wup.writeStruct('tReq', req as any)
      const command = new HUYA.WebSocketCommand()
      command.iCmdType = HUYA.EWebSocketCommandType.EWSCmd_WupReq
      command.vData = wup.encode()
      const stream = new Taf.JceOutputStream()
      command.writeTo(stream)
      this.client?.send(stream.getBuffer())
    } catch (err) {
      this.emit('error', err)
    }
  }
}

import { Writer } from 'protobufjs'
import fetch from 'node-fetch'
import puppeteer from 'puppeteer'

import { ID } from '../client'

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

export const makeCookie = (cookies: Record<string, number | string>): string => {
  return Object.entries(cookies)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => [k, v].join('='))
    .join('; ')
}

export const parseCookie = (cookie: string): Record<string, string> => {
  return cookie.split(/;\s?/g).reduce((acc, c) => {
    const [k, v] = c.split('=')
    acc[k] = v
    return acc
  }, {} as Record<string, string>)
}

type TokenInfo = {
  result: number
  ssecurity: string
  passToken: string
  stsUrl: string
  followUrl: string
  'kuaishou.live.web_st': string
  userId: number
  'kuaishou.live.web.at': string
  errorMsg?: string
  error_msg?: string
  cookie: Record<string, string>
}

export const getTokenInfo = (cookie?: string): Promise<TokenInfo> => {
  const mergedCooke =
    cookie ??
    'passToken=ChNwYXNzcG9ydC5wYXNzLXRva2VuErABjH8SsNCmzTUfY2VUfjTgtuM4t2xeHJ72cwefGy-MfNniM7KE1p5mPxInCENdjjAPFel0rbYbj7zr8YBtKgKGiymkJ-Tl0l0SZGBCFG5cvL-cmPAvzUXcPoiO2h-t9MaTfbQK0vQZwq3bjXmHtAOaWcGT-liE6zENkPI4T37S0I6vvooxFMPe-tvbzqN8EQHCcc19k55Y6cK7VgZt_nyq2h2Bpum9y-sjAWLhP6OZQ3gaEqTfGfUjaES9oBVZA08VrH567CIgIeL4BjOcjkmjdpEtHLEzGRImYWxBgGtpDoeDpBUnE0goBTAB; userId=1736972579'
  return fetch('https://id.kuaishou.com/pass/kuaishou/login/passToken', {
    headers: {
      accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      Cookie: mergedCooke,
    },
    body: 'sid=kuaishou.live.web',
    method: 'POST',
  }).then((r) => {
    const cookies = r.headers.raw()['set-cookie']
    const cookie = {} as Record<string, string>
    cookies
      .map((c) => c.split(';').shift())
      .forEach((c = '') => {
        const [k, v] = c.split('=')
        return (cookie[k] = v)
      })

    return r.json().then((d) => ({
      ...d,
      cookie,
    }))
  })
}

export const getDid = (): Promise<string> => {
  return fetch('https://id.kuaishou.com/pass/kuaishou/login/passToken')
    .then((t) => t.json())
    .then((d) => d.did)
}

export const getLiveStreamId = (roomID: ID, cookie: string): Promise<string> => {
  return fetch(`https://live.kuaishou.com/u/${roomID}`, {
    headers: {
      Connection: 'keep-alive',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      'sec-ch-ua-mobile': '?0',
      DNT: '1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
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

export type WebSocketInfo = {
  token: string
  webSocketUrls: string[]
  __typename: 'WebSocketInfoResult'
}

export const getLiveDetail = (roomId: ID, cookie: string): Promise<string> => {
  return fetch('https://live.kuaishou.com/graphql', {
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
    body: `{"operationName":"LiveDetail","variables":{"principalId":"${roomId}"},"query":"query LiveDetail($principalId: String) {\\n  liveDetail(principalId: $principalId) {\\n    liveStream\\n}\\n}\\n"}`,
    method: 'POST',
  })
    .then((t) => t.json())
    .then((r) => r.data?.webLiveDetail?.liveStream?.liveStreamId)
}

export const getWebSocketInfo = (liveStreamId: string, cookie: string): Promise<WebSocketInfo> => {
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
    body: `{"operationName":"WebSocketInfoQuery","variables":{"liveStreamId":"${liveStreamId}"},"query":"query WebSocketInfoQuery($liveStreamId: String) {\\n  webSocketInfo(liveStreamId: $liveStreamId) {\\n    token\\n    webSocketUrls\\n    __typename\\n  }\\n}\\n"}`,
    method: 'POST',
  }).then((t) => t.json())
}

export type Maybe<T> = T | null | undefined
type RequireLogin = (dataUrl: string) => void
export type PageInfo = {
  pageId?: Maybe<string>
  liveStreamId?: Maybe<string>
  cookie: string
}

export const getPageInfo = async (roomId: string | number, requireLogin?: RequireLogin): Promise<PageInfo> => {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.goto(`https://live.kuaishou.com/u/${roomId}`)
  await page.waitForSelector('.no-login .login')
  const el = await page.$('.no-login .login')
  await el?.evaluate((e) => e.click())
  const qrimg = await page.waitForSelector('.qrcode.qr-login-code img', { visible: false })
  await qrimg?.click()
  const propSrc = await qrimg?.getProperty('src')
  const dataUrl = await propSrc?.jsonValue()
  requireLogin?.(dataUrl as string)

  await page.waitForSelector('.user-info-profile[src]', { timeout: 120 * 1000, visible: false })
  await page.reload()

  const pageInfo = await page.evaluate(() => {
    return {
      liveStreamId: JSON.parse(sessionStorage.getItem('kslive.log.page_live_stream_id') || '""'),
      pageId: JSON.parse(sessionStorage.getItem('kslive.log.page_id') || '""'),
    }
  })

  const cookies = await page.cookies()
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

  setTimeout(() => browser.close(), 100)

  return Promise.resolve({ ...pageInfo, cookie })
}

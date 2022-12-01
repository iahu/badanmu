import Bilibili from 'bilibili'
import Douyu from 'douyu'
import Huya from 'huya'
import Kuaishou from 'kuaishou'

export type Client = Bilibili | Douyu | Huya | Kuaishou

export const createClient = (platform: string, roomId: number | string): Client | undefined => {
  let client: Client | undefined
  if (platform === 'bilibili') {
    client = new Bilibili(roomId)
  } else if (platform === 'douyu') {
    client = new Douyu(roomId)
  } else if (platform === 'huya') {
    client = new Huya(roomId)
  } else if (platform === 'kuaishou') {
    client = new Kuaishou(roomId)
  }

  return client
}

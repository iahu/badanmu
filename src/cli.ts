import Bilibili from './bilibili'
import Douyu from './douyu'
import Huya from './huya'
import Kuaishou from './kuaishou'

const [platform, roomID] = process.argv.slice(2)

let client: Bilibili | Douyu | Huya | Kuaishou | undefined

if (platform && roomID) {
  if (platform === 'bilibili') {
    client = new Bilibili(roomID)
  } else if (platform === 'douyu') {
    client = new Douyu(roomID)
  } else if (platform === 'huya') {
    client = new Huya(roomID)
  } else if (platform === 'kuaishou') {
    client = new Kuaishou(roomID)
  }

  if (client) {
    console.log('listen', platform, client.roomID)
    client.on('open', () => console.log('open'))
    client.on('error', (error) => console.error(error))
    client.on('message', (msg) => console.log('msg', msg))
    client.on('close', (c, r) => console.log('closed', c, r))
  } else {
    console.log('不支持的平台')
  }
} else {
  console.log('useage: node ./cli.js <platform> <roomID>')
}

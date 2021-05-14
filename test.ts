// import Bilibili from './src/bilibili'

// const [roomID = 58] = process.argv.slice(2)

// const bilibili = new Bilibili(roomID)

// bilibili.on('open', () => {
//   console.log('connected')
// })

// bilibili.on('message', (msg) => {
//   console.log('reviced', JSON.stringify(msg.body.messages))
// })

// import Douyu from './src/douyu'

// const [roomID = 4291405] = process.argv.slice(2)

// const client = new Douyu(roomID)
// client.on('open', () => console.log('opened'))
// client.on('message', (d) => console.log('said', d.body))
// client.on('error', console.error)

import Huya from './src/huya'

const [roomID = 'cxldb'] = process.argv.slice(2)

const client = new Huya(roomID)
client.on('open', () => console.log('opened'))
client.on('message', (d) => console.log('said', d))
client.on('error', console.error)

import TestClient from './test-client'

const { NODE_ENV } = process.env
const isDev = NODE_ENV !== 'production'
const args = process.argv.slice(2)
const [platform = 'bilibili', roomId = '9922197'] = args

const client = new TestClient(isDev)
client.on('close', () => process.exit(0))
client.login(platform, roomId)

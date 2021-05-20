import { MockUser } from './MockUser'

const { NODE_ENV } = process.env
const isDev = NODE_ENV !== 'production'
const args = process.argv.slice(2)
const [platform = 'bilibili', roomId = '9922197'] = args

const user1 = new MockUser(isDev)
user1.login(platform, roomId)

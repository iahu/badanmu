import { main } from './server'

const [port] = process.argv.slice(2)

main(parseInt(port) || 8181)

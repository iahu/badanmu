#!/usr/bin/env node

import { program } from 'commander'

import TestClient from './test-client'

const { NODE_ENV } = process.env
const isDev = NODE_ENV !== 'production'

const client = new TestClient(isDev)
client.on('close', () => process.exit(0))

program
  .command('login <huya|douyu|bilibli> <roomId>')
  .alias('l')
  .description('login a room of platform')
  .action((platform, roomId) => {
    client.login(platform, roomId)
  })

program
  .command('client-size')
  .alias('s')
  .description('echo the current clients size of server')
  .action(() => {
    client.clientSize()
  })

program.parse(process.argv)

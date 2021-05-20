# badanmu

巴旦木/扒弹幕

## 使用

1. 启动服务器

```sh
npm run start [port]
```

2. 启动客户端

```ts
const ws = new WebSocket('ws://127.0.0.1:8181')
ws.on('open', () => {
  console.log(`连接成功 ${platform}, ${roomId}`)

  // 发送连接请求
  ws.send(socketData({ type: 'login', platform: 'bilibili', roomId: '213' }))
})
ws.on('error', console.error)
ws.on('close', console.log)
// 监听消息
ws.on('message', console.info)
```

## 开发

```sh
npm run cli <platform> <roomId>
```

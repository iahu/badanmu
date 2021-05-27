const apps = ['8000', '8001', '8002'].map((port) => ({
  name: `badanmu-${port}`,
  script: './dist/server.js',
  // watch: './dist', // 需要手动重启
  env: {
    NODE_ENV: 'development',
  },
  env_production: {
    NODE_ENV: 'production',
  },
  increment_var: 'PORT',
  args: port,
}))

module.exports = { apps }

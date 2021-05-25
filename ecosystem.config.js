module.exports = {
  apps: [
    {
      name: 'badanmu',
      script: './dist/server.js',
      watch: './dist',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // args: "8000"
    },
  ],
}

module.exports = {
  apps: [
    {
      name: 'badanmu-server-8000',
      script: './dist/server.js',
      watch: './dist',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      increment_var: 'PORT',
      args: '8000',
    },
    {
      name: 'badanmu-server-8001',
      script: './dist/server.js',
      watch: './dist',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      increment_var: 'PORT',
      args: '8001',
    },
    {
      name: 'badanmu-server-8002',
      script: './dist/server.js',
      watch: './dist',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      increment_var: 'PORT',
      args: '8002',
    },
  ],
}

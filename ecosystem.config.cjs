module.exports = {
  apps: [
    {
      name: 'audio_smart',
      script: './node_modules/.bin/tsx',
      args: 'server.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3007
      }
    }
  ]
};

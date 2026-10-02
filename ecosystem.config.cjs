module.exports = {
  apps: [
    {
      name: 'audio_smart',
      script: 'server.ts',
      interpreter: 'tsx',
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

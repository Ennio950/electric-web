module.exports = {
  apps: [
    {
      name: 'straight-wire-electric',
      cwd: '/var/www/electric-web/straight-wire-backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

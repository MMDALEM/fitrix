module.exports = {
  apps: [
    {
      name: "fitrix",
      script: "server.js",
      interpreter: "bun",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

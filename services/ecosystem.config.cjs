module.exports = {
  apps: [
    {
      name: "tradeao-engine",
      script: "./dist/server.cjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/tradeao_server_pm2_err.log",
      out_file: "./logs/tradeao_server_pm2_out.log",
      pid_file: "./storage/tradeao_server_pm2.pid",
    },
    {
      name: "tradeao-bot",
      script: "./venv/bin/python",
      args: "bot.py",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./logs/tradeao_bot_pm2_err.log",
      out_file: "./logs/tradeao_bot_pm2_out.log",
      pid_file: "./storage/tradeao_bot_pm2.pid",
    }
  ]
};

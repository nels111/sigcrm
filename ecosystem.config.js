module.exports = {
  apps: [
    {
      name: "signature-os",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/sigcrm",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/signature-os/error.log",
      out_file: "/var/log/signature-os/out.log",
      merge_logs: true,
    },
  ],
};

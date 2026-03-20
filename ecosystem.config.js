module.exports = {
  apps: [
    {
      name: "livestream",
      script: "server.js",
      cwd: "/home/alfan/LiveStream-9b5rbq/server",
      autorestart: true,
      restart_delay: 10000
    },
    {
      name: "main-platform",
      script: "server.js",
      cwd: "/home/alfan/main-platform",
      autorestart: true,
      restart_delay: 10000
    },
    {
      name: "gps-server",
      script: "server.js",
      cwd: "/home/alfan/gps-camera",
      autorestart: true,
      restart_delay: 10000
    },
    {
      name: "apk-server",
      script: "server.js",
      cwd: "/home/alfan/apk-store",
      autorestart: true,
      restart_delay: 10000
    },
    {
      name: "serveo-pintu-utama",
      script: "ssh",
      args: "-o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R duha-dudu:80:localhost:80 serveo.net",
      autorestart: true,
      restart_delay: 10000
    }
  ]
};

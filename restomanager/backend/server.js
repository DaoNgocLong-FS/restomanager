require('dotenv').config();
const http = require('http');
const { initDatabase, closePool } = require('./src/database/db');
const { initStorage } = require('./src/storage/minio');
const { runSeed } = require('./src/database/seed');
const app = require('./app');
const realtime = require('./src/realtime/io');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    await initStorage();
    await runSeed();

    // Bọc Express trong HTTP server để Socket.IO dùng chung cổng
    const httpServer = http.createServer(app);
    realtime.init(httpServer);

    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('============================================');
      console.log(' RESTAURANT MANAGEMENT SYSTEM');
      console.log(' PostgreSQL + MinIO + Express + Socket.IO');
      console.log('============================================');
      console.log('Server:    http://localhost:' + PORT);
      console.log('Health:    http://localhost:' + PORT + '/api/health');
      console.log('Socket.IO: ws://localhost:' + PORT + '/socket.io');
      console.log('============================================');
    });

    process.on('SIGTERM', shutdown(server));
    process.on('SIGINT',  shutdown(server));
  } catch (err) {
    console.error('[ERROR] Khong the khoi dong server:', err);
    process.exit(1);
  }
}

function shutdown(server) {
  return async () => {
    console.log('Shutting down gracefully...');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
}

startServer();

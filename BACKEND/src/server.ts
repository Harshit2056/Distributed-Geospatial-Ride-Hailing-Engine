import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { app } from './app.js';
import { initSocket } from './socket/index.js';
import http from 'http'
import { initRedisPubSub } from './config/redis.pubsub.js';

dotenv.config();

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    pool.query('SELECT 1')
  .then(() => console.log(' PostgreSQL Database connected successfully!'))
  .catch((err) => console.error(' PostgreSQL connection failed:', err));

  await initRedisPubSub(); // Redis Pub/Sub connect karein
  
  // Node HTTP Server create karein
  const server = http.createServer(app);

  // Socket.io attach karein
  initSocket(server);

  // Start the server
  server.listen(PORT, () => {
    console.log(` Server is running on http://localhost:${PORT}`);
  });
  
  }catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

import express from 'express';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import { redis } from './config/redis.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON
app.use(express.json());

// Basic health check route
app.get('/api/health', async ( req , res ) => {
  try {
    // Check DB
    const pgRes = await pool.query('SELECT NOW()');
    
    // Check Redis
    await redis.set('health_check', 'ok', 'EX', 10);
    const redisRes = await redis.get('health_check');

    res.status(200).json({
      status: 'active',
      database: 'connected',
      dbTime: pgRes.rows[0].now,
      redis: redisRes === 'ok' ? 'connected' : 'error'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ error: 'System is unhealthy' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

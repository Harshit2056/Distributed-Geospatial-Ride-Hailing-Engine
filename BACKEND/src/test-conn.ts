import { pool } from './config/db.js';
import { redis } from './config/redis.js';

async function testConnections() {
  try {
    // 1. PostgreSQL Test
    const pgRes = await pool.query('SELECT NOW()');
    console.log('PostgreSQL Success! Server Time:', pgRes.rows[0].now);

    // 2. Redis Test
    await redis.set('test_key', 'Rideshare Backend Active');
    const redisVal = await redis.get('test_key');
    console.log('Redis Success! Value from Redis:', redisVal);

    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

testConnections();
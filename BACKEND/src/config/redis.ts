import {Redis} from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD, 
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('Redis connected successfully!');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});
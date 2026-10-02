import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.REDIS_HOST || 'localhost';
const port = Number(process.env.REDIS_PORT) || 6379;

export const pubClient = new Redis({ host, port });
export const subClient = pubClient.duplicate();

export const initRedisPubSub = async () => {
  try {
    // ioredis auto-connects by default. 
    // We can just log that the setup is complete.
    console.log(' Redis Pub/Sub clients initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Redis Pub/Sub clients:', error);
  }
};
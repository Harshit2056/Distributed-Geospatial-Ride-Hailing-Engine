import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/auth.types.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.pubsub.js';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Production mein client URL allow karein
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach Redis Adapter for Multi-Server Horizontal Scaling
  io.adapter(createAdapter(pubClient, subClient));

    // Socket Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    // 1. Auth payload, 2. Header, 3. Cookie header teeno check karein
    const rawCookie = socket.handshake.headers.cookie;
    let cookieToken: string | undefined;

    if (rawCookie) {
      const match = rawCookie.match(/accessToken=([^;]+)/);
      if (match) cookieToken = match[1];
    }

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '').trim() ||
      (socket.handshake.headers?.accesstoken as string) ||
      cookieToken;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const secret = process.env.ACCESS_TOKEN_SECRET || 'access_secret';
      const decoded = jwt.verify(token, secret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    // Har user ko uski specific room me join karwayein (direct messaging ke liye)
    const userRoom = `user:${user.userId}`;
    socket.join(userRoom);
    console.log(` User connected to socket: ${user.userId} (${user.role})`);

    // Ride-specific room join karne ka event
    socket.on('join_ride', (rideId: string) => {
      socket.join(`ride:${rideId}`);
      console.log(`User ${user.userId} joined ride room: ride:${rideId}`);
    });

    // Driver live telemetry location broadcast
    socket.on('driver_location_update', (data: { rideId: string; latitude: number; longitude: number }) => {
      // Driver ki nayi position sirf usi ride ke rider ko broadcast hogi
      socket.to(`ride:${data.rideId}`).emit('driver_moved', {
        driverId: user.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${user.userId}`);
    });
  });

  return io;
};

// Application me kahin se bhi event emit karne ke liye helper function
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};
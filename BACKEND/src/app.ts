import express from 'express';
import authRouter from './routes/auth.routes.js';
import driverRouter from './routes/driver.routes.js';
import routeRouter from './routes/route.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware.js';
import rideRouter from './routes/ride.routes.js';

export const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());


app.use('/api/v1/auth', authRouter);
app.use('/api/v1/drivers',driverRouter );
app.use('/api/v1/routes',routeRouter );
app.use('/api/v1/rides',rideRouter)

// Global Error Handler
app.use(errorHandler);
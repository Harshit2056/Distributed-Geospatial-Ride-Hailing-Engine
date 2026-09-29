import express from 'express';
import authRouter from './routes/auth.routes.js';
import driverRouter from './routes/driver.routes.js';
import routeRouter from './routes/route.routes.js';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error.middleware.js';

export const app = express();

app.use(express.json());
app.use(cookieParser());


app.use('/api/v1/auth', authRouter);
app.use('/api/v1/drivers',driverRouter );
app.use('/api/v1/routes',routeRouter );

// Global Error Handler
app.use(errorHandler);
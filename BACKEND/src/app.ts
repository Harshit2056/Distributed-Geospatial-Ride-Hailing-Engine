import express from 'express';
import authRoutes from './routes/auth.routes.js';
import driverRoutes from './routes/driver.routes.js';
import routeRoutes from './routes/route.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export const app = express();

app.use(express.json());

// Routes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', service: 'Ride Sharing Engine' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/routes', routeRoutes);

// Global Error Handler
app.use(errorHandler);
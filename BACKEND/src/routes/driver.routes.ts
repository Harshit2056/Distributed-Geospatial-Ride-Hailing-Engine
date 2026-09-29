import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { verifyJWT, authorizeRole } from '../middleware/auth.middleware.js';

const driverRouter = Router();

// Location update endpoint: Sirf valid DRIVER role wala logged-in user hit kar sakta hai
driverRouter.post(
  '/location',
  verifyJWT,
  authorizeRole('DRIVER'),
  DriverController.updateLocation
);

// Nearby drivers endpoint: Koi bhi authenticated user (rider/driver) search kar sakta hai
driverRouter.get(
  '/nearby',
  verifyJWT,
  DriverController.getNearbyDrivers
);

export default driverRouter;
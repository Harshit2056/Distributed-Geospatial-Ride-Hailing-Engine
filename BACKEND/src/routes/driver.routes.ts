import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { verifyJWT, authorizeRole } from '../middleware/auth.middleware.js';

const driverRouter = Router();

// Only DRIVER can push location
driverRouter.post(
  '/location',
  verifyJWT,
  authorizeRole('DRIVER'),
  DriverController.updateLocation
);

// Only RIDER can discover nearby drivers
driverRouter.get(
  '/nearby',
  verifyJWT,
  authorizeRole('RIDER'),
  DriverController.getNearbyDrivers
);

export default driverRouter;
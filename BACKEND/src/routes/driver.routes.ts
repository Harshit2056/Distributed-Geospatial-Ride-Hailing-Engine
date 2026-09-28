import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { verifyJWT, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

// Location update endpoint: Sirf valid DRIVER role wala logged-in user hit kar sakta hai
router.post(
  '/location',
  verifyJWT,
  authorizeRole('DRIVER'),
  DriverController.updateLocation
);

// Nearby drivers endpoint: Koi bhi authenticated user (rider/driver) search kar sakta hai
router.get(
  '/nearby',
  verifyJWT,
  DriverController.getNearbyDrivers
);

export default router;
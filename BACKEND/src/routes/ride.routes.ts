import { Router } from 'express';
import { RideController } from '../controllers/ride.controller.js';
import { verifyJWT, authorizeRole } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const rideRouter = Router();

// Only RIDER can request a ride
rideRouter.post('/request', verifyJWT, authorizeRole('RIDER'), rateLimiter({ windowInSeconds: 60, maxRequests: 5 }), RideController.requestRide);

// Fetch active ongoing ride for logged in user (Rider or Driver)
rideRouter.get('/active', verifyJWT, RideController.getActiveRide);

// Both RIDER or DRIVER can update status (FSM handles valid transitions)
rideRouter.patch('/:rideId/status', verifyJWT, RideController.updateStatus);

export default rideRouter;
import { Router } from 'express';
import { RideController } from '../controllers/ride.controller.js';
import { verifyJWT, authorizeRole } from '../middleware/auth.middleware.js';

const rideRouter = Router();

// Only RIDER can request a ride
rideRouter.post('/request', verifyJWT, authorizeRole('RIDER'), RideController.requestRide);

// Both RIDER or DRIVER can update status (FSM handles valid transitions)
rideRouter.patch('/:rideId/status', verifyJWT, RideController.updateStatus);

export default rideRouter;
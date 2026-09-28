import { Router } from 'express';
import { RouteController } from '../controllers/route.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Protected: Only authenticated users can calculate routes
router.post('/calculate', verifyJWT, RouteController.getOptimalRoute);

export default router;
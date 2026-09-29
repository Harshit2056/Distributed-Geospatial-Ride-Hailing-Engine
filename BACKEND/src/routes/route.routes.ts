import { Router } from 'express';
import { RouteController } from '../controllers/route.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const routeRouter = Router();

// Protected: Only authenticated users can calculate routes
routeRouter.post('/calculate', verifyJWT, RouteController.getOptimalRoute);

export default routeRouter;
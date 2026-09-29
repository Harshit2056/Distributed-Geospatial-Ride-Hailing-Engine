import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const authRouter = Router();

// Public routes for user registration and authentication
authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh-token', AuthController.refresh);
authRouter.post('/logout', verifyJWT, AuthController.logout);
authRouter.get('/me', verifyJWT, AuthController.getCurrentUser);

export default authRouter;
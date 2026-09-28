import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

// Public routes for user registration and authentication
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

export default router;
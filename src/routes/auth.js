import express from 'express';
import {
  register,
  login,
  getMe,
  checkAuth,
  logout,
  registerValidation,
  loginValidation
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.get('/check', authMiddleware, checkAuth);
router.post('/logout', authMiddleware, logout);

export default router;


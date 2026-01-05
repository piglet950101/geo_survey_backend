import express from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

export default router;


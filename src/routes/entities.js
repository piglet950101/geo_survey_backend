import express from 'express';
import {
  createSurveyResult,
  getSurveyResult,
  getPayments,
  createPayment
} from '../controllers/entityController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Survey Results
router.post('/survey-results', createSurveyResult);
router.get('/survey-results/:id', getSurveyResult);

// Payments
router.get('/payments', getPayments);
router.post('/payments', createPayment);

export default router;


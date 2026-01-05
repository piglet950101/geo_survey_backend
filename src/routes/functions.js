import express from 'express';
import { analyzeSurvey } from '../controllers/surveyController.js';
import {
  getAllData,
  getSuggestions,
  getSurveyNumbers,
  searchVillages,
  searchSurveyNumbers
} from '../controllers/villageController.js';
import { exportReportPDF } from '../controllers/exportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/villages-data', getAllData);
router.get('/village-suggestions', getSuggestions);
router.get('/survey-numbers', getSurveyNumbers);
router.get('/search-villages', searchVillages);
router.get('/search-survey-numbers', searchSurveyNumbers);

// Protected routes (require authentication)
router.use(authMiddleware);

// Survey analysis
router.post('/analyze-survey', analyzeSurvey);

// Export routes
router.post('/export-pdf', exportReportPDF);

// Test routes
router.get('/test', (req, res) => {
  res.json({
    data: {
      success: true,
      message: 'Test endpoint working',
      test: 'hello',
      amount: 349
    }
  });
});

router.get('/test-razorpay', async (req, res) => {
  try {
    const razorpay = (await import('../config/razorpay.js')).default;
    res.json({
      data: {
        success: true,
        message: 'Razorpay configuration loaded',
        key_id: process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set'
      }
    });
  } catch (error) {
    res.status(500).json({
      data: { error: error.message }
    });
  }
});

router.get('/test-credentials', (req, res) => {
  res.json({
    data: {
      success: true,
      database: process.env.DATABASE_HOST ? 'Configured' : 'Not configured',
      razorpay: process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured',
      jwt: process.env.JWT_SECRET ? 'Configured' : 'Not configured'
    }
  });
});

export default router;


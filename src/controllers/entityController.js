import { SurveyResult } from '../models/SurveyResult.js';
import { Payment } from '../models/Payment.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Create Survey Result
 */
export const createSurveyResult = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const resultData = {
    ...req.body,
    user_id: userId
  };

  const result = await SurveyResult.create(resultData);

  res.status(201).json({
    data: {
      success: true,
      data: result
    }
  });
});

/**
 * Get Survey Result by ID
 */
export const getSurveyResult = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await SurveyResult.findById(id);

  if (!result) {
    return res.status(404).json({
      data: { error: 'Survey result not found' }
    });
  }

  // Note: ts_warangal_survey doesn't have user_id column
  // Skip ownership check for now, or implement alternative tracking

  res.json({
    data: {
      success: true,
      data: result
    }
  });
});

/**
 * Get Payments (in-memory, no DB table)
 */
export const getPayments = asyncHandler(async (req, res) => {
  const filters = {
    user_id: req.user.id,
    ...req.query
  };

  const payments = await Payment.find(filters);

  res.json({
    data: {
      success: true,
      payments: payments || []
    }
  });
});

/**
 * Create Payment (Admin/Service Role)
 */
export const createPayment = asyncHandler(async (req, res) => {
  const paymentData = {
    ...req.body,
    user_id: req.user.id
  };

  const payment = await Payment.create(paymentData);

  res.status(201).json({
    data: {
      success: true,
      data: payment
    }
  });
});


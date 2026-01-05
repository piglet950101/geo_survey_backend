import razorpay from '../config/razorpay.js';
import { Payment } from '../models/Payment.js';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Create Razorpay Order
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { amount, surveyResultId, village, surveyNumber, promoCode } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      data: { error: 'Invalid amount' }
    });
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `survey_${surveyResultId || Date.now()}`,
      notes: {
        survey_result_id: surveyResultId,
        village,
        survey_number: surveyNumber,
        promo_code: promoCode
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      data: {
        success: true,
        order_id: order.id,
        key_id: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      data: { error: error.message || 'Failed to create order' }
    });
  }
});

/**
 * Verify Razorpay Payment
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const userId = req.user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      data: { error: 'Missing payment details' }
    });
  }

  try {
    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        data: { error: 'Invalid payment signature' }
      });
    }

    // Get order details to extract metadata
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = order.notes || {};

    // Calculate amounts
    const amount = order.amount / 100; // Convert from paise
    const originalAmount = notes.original_amount || amount;
    const discountAmount = originalAmount - amount;

    // Create payment record (in-memory, no DB table)
    await Payment.create({
      user_id: userId,
      survey_result_id: notes.survey_result_id || null,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      promo_code: notes.promo_code || null,
      payment_status: 'completed',
      village: notes.village || null,
      survey_number: notes.survey_number || null
    });

    res.json({
      data: {
        success: true,
        message: 'Payment verified successfully'
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      data: { error: error.message || 'Payment verification failed' }
    });
  }
});


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
    // Generate short receipt (max 40 chars as per Razorpay requirement) - matching original
    const timestamp = Date.now().toString().slice(-10); // Last 10 digits
    const shortId = (surveyResultId || '').substring(0, 15); // First 15 chars of ID
    const receipt = `rcpt_${shortId}_${timestamp}`.substring(0, 40); // Ensure max 40 chars

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: receipt,
      notes: {
        survey_result_id: surveyResultId,
        village: village || '',
        survey_number: surveyNumber || '',
        promo_code: promoCode || null
      }
    };

    const order = await razorpay.orders.create(options);

    // Save payment record with 'pending' status (matching original)
    await Payment.create({
      user_id: userId,
      survey_result_id: surveyResultId || null,
      razorpay_order_id: order.id,
      amount: amount,
      original_amount: 699, // Default original amount
      discount_amount: 699 - amount,
      promo_code: promoCode || null,
      payment_status: 'pending',
      village: village || '',
      survey_number: surveyNumber || ''
    });

    res.json({
      data: {
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
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

    // Find existing payment record by razorpay_order_id (matching original)
    const payments = await Payment.filter({
      razorpay_order_id: razorpay_order_id
    });

    if (payments.length > 0) {
      // Update existing payment record (matching original)
      await Payment.update(payments[0].id, {
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        payment_status: 'completed'
      });
    } else {
      // Fallback: Get order details and create new record if not found
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const notes = order.notes || {};
      const amount = order.amount / 100; // Convert from paise
      const originalAmount = notes.original_amount || amount;
      const discountAmount = originalAmount - amount;

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
    }

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


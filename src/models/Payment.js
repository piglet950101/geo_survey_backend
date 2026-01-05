/**
 * Payment Model - No Database Table
 * 
 * Since there's no payments table in the database, we'll:
 * 1. Store payment records in memory (for session)
 * 2. Use Razorpay for payment processing
 * 3. Return payment status without DB persistence
 * 
 * NOTE: This means payment records won't persist across server restarts.
 * For production, consider using Redis or a separate database.
 */

// In-memory payment store (will be lost on server restart)
const paymentStore = new Map();

export class Payment {
  /**
   * Create new payment record (in-memory)
   */
  static async create(data) {
    const {
      user_id,
      survey_result_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      original_amount,
      discount_amount,
      promo_code,
      payment_status,
      village,
      survey_number
    } = data;

    const paymentId = razorpay_payment_id || `payment_${Date.now()}`;
    
    const payment = {
      id: paymentId,
      user_id,
      survey_result_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      original_amount,
      discount_amount,
      promo_code,
      payment_status: payment_status || 'pending',
      village,
      survey_number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in memory
    paymentStore.set(paymentId, payment);

    return payment;
  }

  /**
   * Find payments by filters (in-memory)
   */
  static async find(filters = {}) {
    let payments = Array.from(paymentStore.values());

    if (filters.survey_result_id) {
      payments = payments.filter(p => p.survey_result_id === filters.survey_result_id);
    }

    if (filters.payment_status) {
      payments = payments.filter(p => p.payment_status === filters.payment_status);
    }

    if (filters.user_id) {
      payments = payments.filter(p => p.user_id === filters.user_id);
    }

    // Sort by created_at DESC
    payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return payments;
  }

  /**
   * Find payment by ID (in-memory)
   */
  static async findById(id) {
    return paymentStore.get(id) || null;
  }

  /**
   * Update payment status
   */
  static async updateStatus(paymentId, status) {
    const payment = paymentStore.get(paymentId);
    if (payment) {
      payment.payment_status = status;
      payment.updated_at = new Date().toISOString();
      paymentStore.set(paymentId, payment);
      return payment;
    }
    return null;
  }
}

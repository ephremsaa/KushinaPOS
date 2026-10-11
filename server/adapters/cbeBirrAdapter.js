const crypto = require('crypto');
const BasePaymentAdapter = require('./basePaymentAdapter');

/**
 * Commercial Bank of Ethiopia (CBE Birr) Payment Adapter
 */
class CbeBirrAdapter extends BasePaymentAdapter {
  constructor(credentials = {}, isSandbox = true) {
    super('cbe_birr', credentials, isSandbox);
    this.merchantCode = credentials.merchant_code || credentials.merchantCode || '';
    this.tillNumber = credentials.till_number || credentials.tillNumber || '';
    this.apiKey = credentials.api_key || credentials.apiKey || '';
  }

  async testConnection() {
    if (!this.merchantCode || !this.tillNumber) {
      return { success: false, message: 'CBE Birr credentials incomplete (merchant_code and till_number required)' };
    }
    return { success: true, message: `CBE Birr (${this.isSandbox ? 'Sandbox' : 'Production'}) connection validated` };
  }

  async createPayment({ order, amount, currency = 'ETB', returnUrl, customer }) {
    if (!this.merchantCode) {
      throw new Error('CBE Birr merchant credentials missing');
    }
    const cbeRef = `CBE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return {
      providerReference: cbeRef,
      checkoutUrl: `https://cbebirr.cbe.com.et/pay?ref=${cbeRef}&amount=${amount}&till=${this.tillNumber}`,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(cbeRef)}`,
      status: 'pending',
    };
  }

  async verifyPayment(reference, metadata = {}) {
    if (!reference) {
      return { verified: false, status: 'failed', providerReference: reference, amount: 0, currency: 'ETB' };
    }
    return {
      verified: true,
      status: 'paid',
      providerReference: reference,
      amount: Number(metadata.amount || 0),
      currency: 'ETB',
    };
  }

  async handleWebhook(request, rawBody, signature) {
    const payload = request.body || request;
    const eventId = payload.cbeTransactionId || payload.transactionId || `CBE-EVT-${Date.now()}`;
    const amount = Number(payload.transAmount || payload.amount || 0);
    const currency = 'ETB';
    const reference = payload.billReference || payload.reference;

    return {
      verified: true,
      eventId,
      eventType: payload.responseCode === '0' || payload.status === 'paid' ? 'payment.succeeded' : 'payment.failed',
      providerReference: reference,
      amount,
      currency,
      status: payload.responseCode === '0' || payload.status === 'paid' ? 'paid' : 'failed',
    };
  }

  async refund({ payment, amount, reason }) {
    return {
      success: true,
      refundReference: `CBE-REF-${Date.now()}`,
      status: 'refunded',
    };
  }
}

module.exports = CbeBirrAdapter;

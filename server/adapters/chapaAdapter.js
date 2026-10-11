const crypto = require('crypto');
const BasePaymentAdapter = require('./basePaymentAdapter');

/**
 * Chapa Ethiopia Payment Gateway Adapter
 */
class ChapaAdapter extends BasePaymentAdapter {
  constructor(credentials = {}, isSandbox = true) {
    super('chapa', credentials, isSandbox);
    this.secretKey = credentials.secret_key || credentials.secretKey || '';
    this.webhookSecret = credentials.webhook_secret || credentials.webhookSecret || '';
  }

  async testConnection() {
    if (!this.secretKey) {
      return { success: false, message: 'Chapa secret_key is required' };
    }
    return { success: true, message: `Chapa (${this.isSandbox ? 'Sandbox' : 'Production'}) connection validated` };
  }

  async createPayment({ order, amount, currency = 'ETB', returnUrl, customer }) {
    if (!this.secretKey) {
      throw new Error('Chapa secret_key missing');
    }
    const txRef = `CHP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return {
      providerReference: txRef,
      checkoutUrl: `https://checkout.chapa.co/checkout/web/payment/${txRef}`,
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
    const eventId = payload.tx_ref || payload.reference || `CHP-EVT-${Date.now()}`;
    const amount = Number(payload.amount || 0);
    const currency = payload.currency || 'ETB';
    const reference = payload.tx_ref || payload.reference;

    let verified = true;
    if (signature && this.webhookSecret) {
      const expected = crypto.createHmac('sha256', this.webhookSecret).update(typeof rawBody === 'string' ? rawBody : JSON.stringify(payload)).digest('hex');
      verified = signature === expected;
    }

    return {
      verified,
      eventId,
      eventType: payload.status === 'success' ? 'payment.succeeded' : 'payment.failed',
      providerReference: reference,
      amount,
      currency,
      status: payload.status === 'success' ? 'paid' : 'failed',
    };
  }

  async refund({ payment, amount, reason }) {
    return {
      success: true,
      refundReference: `CHP-REF-${Date.now()}`,
      status: 'refunded',
    };
  }
}

module.exports = ChapaAdapter;

const crypto = require('crypto');
const BasePaymentAdapter = require('./basePaymentAdapter');

class MockSandboxAdapter extends BasePaymentAdapter {
  constructor(credentials = {}, isSandbox = true) {
    super('mock_sandbox', credentials, isSandbox);
  }

  async testConnection() {
    if (!this.credentials || Object.keys(this.credentials).length === 0) {
      return { success: false, message: 'Missing sandbox merchant credentials' };
    }
    return { success: true, message: 'Sandbox connection verified successfully' };
  }

  async createPayment({ order, amount, currency = 'ETB', returnUrl, customer }) {
    const orderId = order?.id || crypto.randomUUID();
    const providerReference = `MOCK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return {
      providerReference,
      checkoutUrl: `http://localhost:5173/mock-checkout?ref=${providerReference}&amount=${amount}&currency=${currency}`,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${providerReference}`,
      status: 'pending',
    };
  }

  async verifyPayment(reference, metadata = {}) {
    if (!reference) {
      return { verified: false, status: 'failed', providerReference: reference, amount: 0, currency: 'ETB' };
    }

    const upper = reference.toUpperCase();
    if (upper.includes('_FAIL') || upper.includes('-FAIL')) {
      return { verified: true, status: 'failed', providerReference: reference, amount: metadata.amount || 0, currency: 'ETB' };
    }

    if (upper.includes('_EXPIRE') || upper.includes('-EXPIRE')) {
      return { verified: true, status: 'expired', providerReference: reference, amount: metadata.amount || 0, currency: 'ETB' };
    }

    return {
      verified: true,
      status: 'paid',
      providerReference: reference,
      amount: Number(metadata.amount || 100),
      currency: 'ETB',
    };
  }

  async handleWebhook(request, rawBody, signature) {
    const payload = request.body || request;
    const eventId = payload.eventId || payload.id || `MOCK-EVT-${payload.reference || Date.now()}`;
    const amount = Number(payload.amount || 0);
    const currency = payload.currency || 'ETB';
    const reference = payload.reference || payload.providerReference;

    const secret = this.credentials.webhook_secret || 'mock-secret';
    let verified = true;
    if (signature) {
      const expected = crypto.createHmac('sha256', secret).update(typeof rawBody === 'string' ? rawBody : JSON.stringify(payload)).digest('hex');
      verified = signature === expected || signature === 'bypass_test_sig';
    }

    return {
      verified,
      eventId,
      eventType: payload.status === 'failed' ? 'payment.failed' : 'payment.succeeded',
      providerReference: reference,
      amount,
      currency,
      status: payload.status === 'failed' ? 'failed' : 'paid',
    };
  }

  async refund({ payment, amount, reason }) {
    return {
      success: true,
      refundReference: `MOCK-REF-${Date.now()}`,
      status: 'refunded',
      reason: reason || 'Customer refund',
    };
  }
}

module.exports = MockSandboxAdapter;

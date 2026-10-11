/**
 * Abstract Payment Provider Adapter Interface
 * All payment providers must conform to this interface.
 */
class BasePaymentAdapter {
  constructor(providerName, credentials = {}, isSandbox = true) {
    if (this.constructor === BasePaymentAdapter) {
      throw new Error('BasePaymentAdapter is abstract and cannot be instantiated directly.');
    }
    this.name = providerName;
    this.credentials = credentials || {};
    this.isSandbox = Boolean(isSandbox);
  }

  /**
   * Tests the connection with the provider using provided credentials.
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async testConnection() {
    throw new Error(`testConnection() not implemented for provider ${this.name}`);
  }

  /**
   * Initiates a payment session with the provider.
   * @param {Object} params
   * @param {Object} params.order
   * @param {number} params.amount
   * @param {string} params.currency
   * @param {string} params.returnUrl
   * @param {Object} [params.customer]
   * @returns {Promise<{ providerReference: string, checkoutUrl?: string, qrCodeUrl?: string, status: 'initiated' | 'pending' }>}
   */
  async createPayment(params) {
    throw new Error(`createPayment() not implemented for provider ${this.name}`);
  }

  /**
   * Performs server-to-server verification for a payment reference.
   * @param {string} reference
   * @param {Object} [metadata]
   * @returns {Promise<{ verified: boolean, status: 'paid' | 'failed' | 'expired' | 'pending', providerReference: string, amount: number, currency: string, rawResponse?: any }>}
   */
  async verifyPayment(reference, metadata = {}) {
    throw new Error(`verifyPayment() not implemented for provider ${this.name}`);
  }

  /**
   * Parses and validates an incoming webhook callback.
   * @param {Object} request - Express request or webhook payload
   * @param {string|Buffer} [rawBody]
   * @param {string} [signature]
   * @returns {Promise<{ verified: boolean, eventType: string, providerReference: string, amount: number, currency: string, status: 'paid' | 'failed' | 'pending', eventId?: string }>}
   */
  async handleWebhook(request, rawBody, signature) {
    throw new Error(`handleWebhook() not implemented for provider ${this.name}`);
  }

  /**
   * Initiates a refund for an existing payment.
   * @param {Object} params
   * @param {Object} params.payment
   * @param {number} params.amount
   * @param {string} params.reason
   * @returns {Promise<{ success: boolean, refundReference: string, status: string }>}
   */
  async refund(params) {
    throw new Error(`refund() not implemented for provider ${this.name}`);
  }
}

module.exports = BasePaymentAdapter;

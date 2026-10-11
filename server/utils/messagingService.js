const db = require('../config/db');

const DAILY_MARKETING_LIMIT = 100; // Daily limit per restaurant

/**
 * Provider-neutral messaging interface
 * @param {string} channel - 'manual' | 'whatsapp' | 'telegram' | 'sms'
 * @param {string} to - Customer phone number (+251...)
 * @param {string} text - Message body
 * @param {object} [options]
 */
async function sendMessage(channelOrOptions, toArg, textArg, optionsArg = {}) {
  let channel, to, text, options;
  if (typeof channelOrOptions === 'object' && channelOrOptions !== null) {
    channel = channelOrOptions.channel;
    to = channelOrOptions.to;
    text = channelOrOptions.text;
    options = channelOrOptions;
  } else {
    channel = channelOrOptions;
    to = toArg;
    text = textArg;
    options = optionsArg;
  }

  // Always enforce mandatory opt-out in marketing copy
  let finalBody = String(text || '').trim();
  if (!/opt[- ]?out|stop/i.test(finalBody)) {
    finalBody += '\n\n(Reply STOP to opt out)';
  }

  switch (channel) {
    case 'manual':
    case 'whatsapp':
    case 'telegram':
      // Manual provider: generates copyable text and link
      const encodedText = encodeURIComponent(finalBody);
      const cleanPhone = String(to || '').replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      const telegramUrl = `https://t.me/share/url?url=&text=${encodedText}`;
      return {
        success: true,
        channel,
        to,
        message: finalBody,
        fullMessage: finalBody,
        whatsappUrl,
        telegramUrl,
        status: 'ready_to_send'
      };

    case 'sms':
      // SMS provider adapter (placeholder for when owner provides gateway credentials)
      if (options.smsProvider && options.apiKey) {
        // e.g. AfroMessage, Telebirr SMS, Twilio
        return {
          success: true,
          channel: 'sms',
          to,
          message: finalBody,
          provider: options.smsProvider,
          status: 'sent'
        };
      } else {
        return {
          success: false,
          channel: 'sms',
          to,
          error: 'SMS Gateway credentials not configured. Please use WhatsApp/Telegram or contact support.'
        };
      }

    default:
      throw new Error(`Unsupported messaging channel: ${channel}`);
  }
}

/**
 * Check daily marketing message limit for a restaurant
 */
async function checkDailyMarketingLimit(restaurantId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(recipient_count), 0) as sent_today
     FROM marketing_campaigns
     WHERE restaurant_id = $1 
       AND created_at >= CURRENT_DATE`,
    [restaurantId]
  );

  const sentToday = parseInt(rows[0]?.sent_today || 0, 10);
  const remaining = Math.max(0, DAILY_MARKETING_LIMIT - sentToday);
  return {
    sentToday,
    limit: DAILY_MARKETING_LIMIT,
    remaining,
    isLimitReached: sentToday >= DAILY_MARKETING_LIMIT
  };
}

module.exports = {
  DAILY_MARKETING_LIMIT,
  sendMessage,
  checkDailyMarketingLimit
};

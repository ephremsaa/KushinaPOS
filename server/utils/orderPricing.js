const { hasPlanFeature } = require('../middleware/planLimits');

let hasModifierTables = null;
async function checkModifierTables(client) {
  if (hasModifierTables !== null) return hasModifierTables;
  try {
    const res = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_modifier_options'");
    hasModifierTables = res.rows.length > 0;
  } catch {
    hasModifierTables = false;
  }
  return hasModifierTables;
}

/**
 * Computes order totals with strict server validation.
 * NEVER trusts prices, totals, discounts, delivery fees, or points sent from client.
 * 
 * @param {object} client - pg pool or transaction client
 * @param {string} restaurantId - verified restaurant ID from auth token
 * @param {Array} items - raw items array from request body
 * @param {object|null} discount - optional discount { type: 'percentage'|'fixed', value: number }
 * @param {object} [options]
 * @param {string} [options.orderType] - 'dine_in' | 'takeaway' | 'delivery'
 * @param {string} [options.customerId] - optional customer ID for loyalty points redemption
 * @param {number} [options.pointsToRedeem] - points to redeem (validated against DB balance)
 */
const computeOrderTotals = async (client, restaurantId, items, discount = null, options = {}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const { orderType = 'dine_in', customerId = null, pointsToRedeem = 0 } = options;

  // 1. Verify restaurant status & financial settings
  const restRes = await client.query(
    `SELECT tax_rate, tax_inclusive, service_charge_enabled, service_charge_percent, 
            COALESCE(default_delivery_fee, 0) as default_delivery_fee,
            loyalty_enabled, loyalty_program_type, loyalty_point_val_etb, 
            loyalty_min_redeem_points, loyalty_max_bill_share_percent
     FROM restaurants 
     WHERE id = $1 AND status = 'active'`,
    [restaurantId]
  );
  if (!restRes.rows[0]) throw new Error('Restaurant not active or not found');
  const rest = restRes.rows[0];

  // 2. Validate Feature Flags by Plan
  if (orderType === 'delivery') {
    const deliveryAllowed = await hasPlanFeature(restaurantId, 'delivery');
    if (!deliveryAllowed) {
      throw new Error('Delivery orders are not available on the current subscription plan. Please upgrade to Growth or Enterprise.');
    }
  }

  // 3. Fetch verified database items
  let subtotal = 0;
  const validatedItems = [];
  const itemIds = items.map(i => i.menu_item_id).filter(Boolean);
  if (itemIds.length === 0) throw new Error('No valid menu items in order');

  const menuItemsRes = await client.query(
    'SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2',
    [itemIds, restaurantId]
  );
  const menuItemsMap = {};
  menuItemsRes.rows.forEach(r => { menuItemsMap[r.id] = r; });

  // Modifiers
  const modTableExists = await checkModifierTables(client);
  const modOptionsMap = {};
  if (modTableExists) {
    const modOptionsRes = await client.query(`
      SELECT o.id, o.price_delta 
      FROM menu_modifier_options o
      JOIN menu_modifiers m ON m.id = o.modifier_id
      WHERE m.restaurant_id = $1
    `, [restaurantId]);
    modOptionsRes.rows.forEach(r => { modOptionsMap[r.id] = Number(r.price_delta) || 0; });
  }

  for (const item of items) {
    const dbItem = menuItemsMap[item.menu_item_id];
    if (!dbItem) throw new Error(`Invalid menu item ${item.menu_item_id} for this restaurant`);
    if (!dbItem.is_available) throw new Error(`Item "${dbItem.name}" is currently marked unavailable`);

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      throw new Error(`Invalid quantity (${item.quantity}) for ${dbItem.name}`);
    }

    // Secure database price (client price ignored)
    let unitPrice = Number(dbItem.price) || 0;

    const validatedModifiers = [];
    if (Array.isArray(item.modifier_choices)) {
      for (const mod of item.modifier_choices) {
        const optionDelta = modOptionsMap[mod.option_id] || 0;
        unitPrice += optionDelta;
        validatedModifiers.push({
          modifier_id: mod.modifier_id,
          option_id: mod.option_id,
          label: mod.label ? String(mod.label).slice(0, 50) : '',
          price_delta: optionDelta
        });
      }
    }

    subtotal += unitPrice * qty;

    validatedItems.push({
      menu_item_id: dbItem.id,
      menu_item_name: dbItem.name,
      quantity: qty,
      unit_price: Math.round(unitPrice * 100) / 100,
      modifier_choices: validatedModifiers,
      notes: item.notes ? String(item.notes).slice(0, 100) : null,
      station: item.station ? String(item.station).slice(0, 50) : 'General'
    });
  }

  // 4. Server-computed Discount (Manager PIN verified separately if required)
  let discountAmount = 0;
  if (discount && discount.type && discount.value) {
    const val = Number(discount.value) || 0;
    if (val > 0) {
      if (discount.type === 'percentage') {
        const pct = Math.min(100, Math.max(0, val));
        discountAmount = (subtotal * pct) / 100;
      } else if (discount.type === 'fixed') {
        discountAmount = Math.min(subtotal, Math.max(0, val));
      }
    }
  }

  // 5. Loyalty Points Redemption (Never trust client points)
  let loyaltyDiscount = 0;
  let redeemedPoints = 0;
  const requestedPoints = parseInt(pointsToRedeem, 10) || 0;

  if (customerId && requestedPoints > 0) {
    const loyaltyAllowed = await hasPlanFeature(restaurantId, 'loyalty');
    if (!loyaltyAllowed) {
      throw new Error('Loyalty redemption is not enabled on this subscription plan.');
    }

    if (rest.loyalty_enabled === false) {
      throw new Error('Loyalty program is currently disabled for this restaurant.');
    }

    const minRedeem = parseInt(rest.loyalty_min_redeem_points, 10) || 0;
    if (requestedPoints < minRedeem) {
      throw new Error(`Minimum redemption amount is ${minRedeem} points.`);
    }

    const custRes = await client.query(
      'SELECT id, points FROM customers WHERE id = $1 AND restaurant_id = $2',
      [customerId, restaurantId]
    );

    if (custRes.rows[0]) {
      const availablePoints = parseInt(custRes.rows[0].points, 10) || 0;
      redeemedPoints = Math.min(availablePoints, requestedPoints);
      if (redeemedPoints <= 0) {
        redeemedPoints = 0;
      } else if (redeemedPoints < minRedeem) {
        throw new Error(`Minimum redemption amount is ${minRedeem} points.`);
      }

      const pointVal = Number(rest.loyalty_point_val_etb) || 0.10;
      loyaltyDiscount = Math.round(redeemedPoints * pointVal * 100) / 100;

      // Cap loyalty discount by max share of bill
      const postDiscountSubtotal = Math.max(0, subtotal - discountAmount);
      const maxSharePct = Number(rest.loyalty_max_bill_share_percent) || 50;
      const maxAllowedDiscount = Math.min(postDiscountSubtotal, Math.round((postDiscountSubtotal * maxSharePct) / 100 * 100) / 100);

      if (loyaltyDiscount > maxAllowedDiscount) {
        loyaltyDiscount = maxAllowedDiscount;
        redeemedPoints = Math.floor(loyaltyDiscount / (pointVal || 0.10));
      }
    }
  }

  const taxableSubtotal = Math.max(0, subtotal - discountAmount - loyaltyDiscount);

  // 6. Taxes
  const taxRate = Number(rest.tax_rate) || 0;
  let taxAmount = 0;

  if (rest.tax_inclusive) {
    taxAmount = taxableSubtotal - (taxableSubtotal / (1 + taxRate / 100));
  } else {
    taxAmount = (taxableSubtotal * taxRate) / 100;
  }

  // 7. Service Charge
  let serviceCharge = 0;
  if (rest.service_charge_enabled && Number(rest.service_charge_percent) > 0) {
    serviceCharge = (taxableSubtotal * Number(rest.service_charge_percent)) / 100;
  }

  // 8. Server-Enforced Delivery Fee
  let deliveryFee = 0;
  if (orderType === 'delivery') {
    deliveryFee = Number(rest.default_delivery_fee) || 0;
  }

  // 9. Final Order Total (all components strictly server-calculated)
  const total = rest.tax_inclusive
    ? taxableSubtotal + serviceCharge + deliveryFee
    : taxableSubtotal + taxAmount + serviceCharge + deliveryFee;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    loyaltyDiscount: Math.round(loyaltyDiscount * 100) / 100,
    pointsRedeemed: redeemedPoints,
    taxAmount: Math.round(taxAmount * 100) / 100,
    serviceCharge: Math.round(serviceCharge * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    validatedItems
  };
};

module.exports = { computeOrderTotals };

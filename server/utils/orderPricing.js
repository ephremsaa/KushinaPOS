const computeOrderTotals = async (client, restaurantId, items, discount = null) => {
  if (!items || items.length === 0) throw new Error('Order must contain at least one item');
  
  // 1. Fetch restaurant
  const restRes = await client.query(
    'SELECT tax_rate, tax_inclusive, service_charge_enabled, service_charge_percent FROM restaurants WHERE id = $1 AND status = \'active\'',
    [restaurantId]
  );
  if (!restRes.rows[0]) throw new Error('Restaurant not active');
  const rest = restRes.rows[0];

  // 2. Fetch items
  let subtotal = 0;
  const validatedItems = [];
  const itemIds = items.map(i => i.menu_item_id).filter(Boolean);
  if (itemIds.length === 0) throw new Error('No valid menu items in order');

  const menuItemsRes = await client.query(
    'SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1) AND restaurant_id = $2',
    [itemIds, restaurantId]
  );
  const menuItemsMap = {};
  menuItemsRes.rows.forEach(r => menuItemsMap[r.id] = r);

  const modOptionsRes = await client.query(`
    SELECT o.id, o.price_delta 
    FROM menu_modifier_options o
    JOIN menu_modifiers m ON m.id = o.modifier_id
    WHERE m.restaurant_id = $1
  `, [restaurantId]);
  const modOptionsMap = {};
  modOptionsRes.rows.forEach(r => modOptionsMap[r.id] = Number(r.price_delta) || 0);

  for (const item of items) {
    const dbItem = menuItemsMap[item.menu_item_id];
    if (!dbItem) throw new Error(`Invalid menu item`);
    if (!dbItem.is_available) throw new Error(`Item ${dbItem.name} is currently unavailable`);

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 50) throw new Error(`Invalid quantity for ${dbItem.name}`);

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
      unit_price: unitPrice,
      modifier_choices: validatedModifiers,
      notes: item.notes ? String(item.notes).slice(0, 100) : null,
      station: item.station ? String(item.station).slice(0, 50) : 'General'
    });
  }

  // Discount
  let discountAmount = 0;
  if (discount && discount.type && discount.value) {
    const val = Number(discount.value) || 0;
    if (val > 0) {
      if (discount.type === 'percentage') {
        discountAmount = (subtotal * val) / 100;
      } else if (discount.type === 'fixed') {
        discountAmount = val;
      }
    }
  }

  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  
  const taxRate = Number(rest.tax_rate) || 0;
  let taxAmount = 0;
  
  if (rest.tax_inclusive) {
    taxAmount = taxableSubtotal - (taxableSubtotal / (1 + taxRate / 100));
  } else {
    taxAmount = (taxableSubtotal * taxRate) / 100;
  }

  let serviceCharge = 0;
  if (rest.service_charge_enabled && Number(rest.service_charge_percent) > 0) {
    serviceCharge = (taxableSubtotal * Number(rest.service_charge_percent)) / 100;
  }

  const total = rest.tax_inclusive 
    ? taxableSubtotal + serviceCharge 
    : taxableSubtotal + taxAmount + serviceCharge;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    serviceCharge: Math.round(serviceCharge * 100) / 100,
    total: Math.round(total * 100) / 100,
    validatedItems
  };
};

module.exports = { computeOrderTotals };

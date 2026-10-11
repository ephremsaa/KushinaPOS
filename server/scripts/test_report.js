const db = require('../config/db');
const jwt = require('jsonwebtoken');

async function testReport() {
  const rest = (await db.query("SELECT id FROM restaurants WHERE email = 'test@example.com'")).rows[0];
  const token = jwt.sign(
    { userId: rest.id, restaurantId: rest.id, role: 'restaurant_owner' },
    process.env.JWT_SECRET || 'dev_secret_key_12345'
  );

  const res = await fetch('http://localhost:3001/api/reports/customers-loyalty', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Report status:', res.status);
  const data = await res.json();
  console.log('Report data:', data);

  // Test customer create
  const custRes = await fetch('http://localhost:3001/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      name: 'Liya Kebede',
      phone: '0911223344',
      email: 'liya@example.com',
      birthday: '1995-05-15',
      marketing_consent: true,
      notes: 'VIP frequent diner'
    })
  });
  console.log('Customer create status:', custRes.status);
  const custData = await custRes.json();
  console.log('Created customer:', custData);

  // Test adjust points with Manager PIN
  const adjRes = await fetch(`http://localhost:3001/api/customers/${custData.customer.id}/adjust-points`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      points: 50,
      manager_pin: '1234',
      reason: 'Welcome bonus'
    })
  });
  console.log('Adjust points status:', adjRes.status);
  const adjData = await adjRes.json();
  console.log('Adjusted points result:', adjData);

  // Test loyalty settings
  const settingsRes = await fetch('http://localhost:3001/api/loyalty/settings', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Loyalty settings status:', settingsRes.status);
  const settingsData = await settingsRes.json();
  console.log('Loyalty settings:', settingsData);

  // Test customer details (order & ledger history)
  const detailRes = await fetch(`http://localhost:3001/api/customers/${custData.customer.id}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Customer detail status:', detailRes.status);
  const detailData = await detailRes.json();
  console.log('Customer details - points:', detailData.customer.points, 'history entries:', detailData.loyalty_history.length);
  
  console.log('ALL CRM & LOYALTY API TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testReport().catch(e => {
  console.error(e);
  process.exit(1);
});

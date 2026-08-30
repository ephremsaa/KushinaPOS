require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const sql = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    action       TEXT NOT NULL,
    target_type  TEXT,
    target_id    UUID,
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );
`;

pool.query(sql)
  .then(() => { console.log('audit_logs table ready'); pool.end(); })
  .catch(e => { console.error('Error:', e.message); pool.end(); });

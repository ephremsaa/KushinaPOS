-- ─────────────────────────────────────────────
-- LEADS TABLE (Public Demo & Quote Inquiries)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT,
  branches              TEXT DEFAULT '1',
  interest              TEXT DEFAULT 'Full POS + KDS',
  preferred_contact_time TEXT DEFAULT 'Anytime',
  source_page           TEXT DEFAULT '/',
  language              TEXT DEFAULT 'en',
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo booked', 'won', 'lost')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_business_name ON leads(business_name);

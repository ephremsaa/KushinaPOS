-- ============================================================
-- kushinaPOS — Migration 0008: Add tags and station to menu_items
-- ============================================================

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS station TEXT;

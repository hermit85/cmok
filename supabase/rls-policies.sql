-- ============================================
-- Cmok MVP: Row Level Security Policies
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmoks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FAMILIES table policies
-- ============================================
CREATE POLICY "Allow public read on families"
  ON families FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on families"
  ON families FOR INSERT
  WITH CHECK (true);

-- ============================================
-- MEMBERS table policies
-- ============================================
CREATE POLICY "Allow public read on members"
  ON members FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on members"
  ON members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on members"
  ON members FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CMOKS table policies
-- ============================================
CREATE POLICY "Allow public read on cmoks"
  ON cmoks FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on cmoks"
  ON cmoks FOR INSERT
  WITH CHECK (true);

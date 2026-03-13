-- Families
CREATE TABLE families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Moja rodzina',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family members
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  expo_push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_cmok_at TIMESTAMPTZ
);

-- Cmok history
CREATE TABLE cmoks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES members(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_members_family ON members(family_id);
CREATE INDEX idx_members_device ON members(device_id);
CREATE INDEX idx_cmoks_family ON cmoks(family_id);
CREATE INDEX idx_cmoks_sender ON cmoks(sender_id);
CREATE INDEX idx_families_code ON families(code);

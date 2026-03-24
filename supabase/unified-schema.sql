-- ============================================================================
-- UNIFIED SCHEMA FOR DOI.BIO ECOSYSTEM
-- ============================================================================
-- Shared Supabase instance for:
--   - leads.doi.bio.me (premium biotech lead marketplace)
--   - earn.doi.bio.me (lead-to-earn platform)
--
-- Naming Convention:
--   - earn_* tables: Earn platform (user-contributed leads, revenue sharing)
--   - leads_* tables: Leads platform (curated lead lists, direct purchases)
--   - No prefix: Shared across all platforms
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SHARED TABLES
-- ============================================================================

-- Unified profiles table (shared across all platforms)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,

  -- Contact Info
  company TEXT,
  role TEXT,

  -- Earn Platform Fields
  earn_tier TEXT DEFAULT 'bronze' CHECK (earn_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  earn_total_earnings DECIMAL(10,2) DEFAULT 0,
  earn_total_leads_shared INTEGER DEFAULT 0,
  earn_total_deals_closed INTEGER DEFAULT 0,
  earn_reputation_score INTEGER DEFAULT 0,
  earn_stripe_connect_id TEXT,  -- For receiving payouts

  -- Leads Platform Fields
  leads_stripe_customer_id TEXT,  -- For making purchases

  -- Shared CRM Integration Status
  salesforce_connected BOOLEAN DEFAULT FALSE,
  salesforce_instance_url TEXT,
  hubspot_connected BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared company enrichment cache (to avoid duplicate enrichment across platforms)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,

  -- Basic Info
  industry TEXT,
  size TEXT,
  location TEXT,
  description TEXT,

  -- Enrichment Data
  funding_stage TEXT,
  funding_amount DECIMAL(12,2),
  founded_year INTEGER,
  tech_stack JSONB,
  social_links JSONB,

  -- Metadata
  enriched_at TIMESTAMPTZ,
  enrichment_source TEXT,
  enrichment_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EARN PLATFORM TABLES (earn.doi.bio.me)
-- ============================================================================

-- User-contributed leads
CREATE TABLE earn_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Contact Information
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Company Information (denormalized for performance)
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_size TEXT,
  industry TEXT,
  location TEXT,

  -- Lead Details
  title TEXT,
  seniority_level TEXT,
  department TEXT,
  lead_status TEXT DEFAULT 'cold' CHECK (lead_status IN ('cold', 'warm', 'hot')),
  lead_source TEXT,

  -- Enrichment Data
  company_funding_stage TEXT,
  company_funding_amount DECIMAL(12,2),
  tech_stack JSONB,
  buyer_intent_score INTEGER,
  ideal_customer_score INTEGER,
  enrichment_data JSONB,

  -- Visibility & Privacy
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'anonymized', 'public')),
  email_visible BOOLEAN DEFAULT FALSE,
  phone_visible BOOLEAN DEFAULT FALSE,

  -- Monetization
  price_per_view DECIMAL(6,2) DEFAULT 0,
  price_per_intro DECIMAL(6,2) DEFAULT 0,
  revenue_share_percent DECIMAL(5,2) DEFAULT 10,

  -- Tracking
  view_count INTEGER DEFAULT 0,
  intro_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead view tracking
CREATE TABLE earn_lead_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES earn_leads(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  view_type TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, viewer_id)
);

-- Introduction requests
CREATE TABLE earn_introductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES earn_leads(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  message TEXT,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Deal tracking (revenue sharing)
CREATE TABLE earn_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES earn_leads(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deal_value DECIMAL(12,2),
  commission_amount DECIMAL(10,2),
  commission_paid BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'won', 'lost')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial transactions (views, intros, commissions, payouts)
CREATE TABLE earn_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES earn_deals(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('view_fee', 'intro_fee', 'commission', 'payout')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_payment_id TEXT,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- AI-powered lead matching
CREATE TABLE earn_lead_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES earn_leads(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_score INTEGER,
  match_reasons JSONB,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CSV import tracking
CREATE TABLE earn_csv_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  row_count INTEGER,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Leaderboard rankings
CREATE TABLE earn_leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  rank INTEGER,
  earnings DECIMAL(10,2),
  deals_closed INTEGER,
  leads_shared INTEGER,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period, period_start)
);

-- ============================================================================
-- LEADS PLATFORM TABLES (leads.doi.bio.me)
-- ============================================================================

-- Curated lead list products
CREATE TABLE leads_lead_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  lead_count INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  preview_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual leads within curated lists
CREATE TABLE leads_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_list_id UUID NOT NULL REFERENCES leads_lead_lists(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Contact Information
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  title TEXT NOT NULL,
  role TEXT,

  -- Company Details (denormalized)
  location TEXT,
  funding_stage TEXT,
  team_size TEXT,
  domain_tags TEXT[] DEFAULT '{}',

  -- URLs
  linkedin_url TEXT,
  company_url TEXT,

  -- Verification & Enrichment
  verified_at TIMESTAMPTZ,
  enrichment_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase history
CREATE TABLE leads_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_list_id UUID NOT NULL REFERENCES leads_lead_lists(id),
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  csv_file_path TEXT
);

-- Subscription plans
CREATE TABLE leads_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- CRM integration credentials
CREATE TABLE leads_crm_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  instance_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead export history
CREATE TABLE leads_lead_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES leads_purchases(id) ON DELETE CASCADE,
  crm_integration_id UUID REFERENCES leads_crm_integrations(id),
  export_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Shared indexes
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Earn indexes
CREATE INDEX idx_earn_leads_owner ON earn_leads(owner_id);
CREATE INDEX idx_earn_leads_company ON earn_leads(company_name);
CREATE INDEX idx_earn_leads_visibility ON earn_leads(visibility);
CREATE INDEX idx_earn_leads_industry ON earn_leads(industry);
CREATE INDEX idx_earn_leads_company_id ON earn_leads(company_id);
CREATE INDEX idx_earn_lead_views_lead ON earn_lead_views(lead_id);
CREATE INDEX idx_earn_lead_views_viewer ON earn_lead_views(viewer_id);
CREATE INDEX idx_earn_transactions_user ON earn_transactions(user_id);
CREATE INDEX idx_earn_deals_buyer ON earn_deals(buyer_id);
CREATE INDEX idx_earn_deals_seller ON earn_deals(seller_id);

-- Leads indexes
CREATE INDEX idx_leads_list_items_list_id ON leads_list_items(lead_list_id);
CREATE INDEX idx_leads_list_items_company_id ON leads_list_items(company_id);
CREATE INDEX idx_leads_purchases_user_id ON leads_purchases(user_id);
CREATE INDEX idx_leads_purchases_lead_list_id ON leads_purchases(lead_list_id);
CREATE INDEX idx_leads_subscriptions_user_id ON leads_subscriptions(user_id);
CREATE INDEX idx_leads_crm_integrations_user_id ON leads_crm_integrations(user_id);
CREATE INDEX idx_leads_lead_exports_user_id ON leads_lead_exports(user_id);
CREATE INDEX idx_leads_lead_exports_purchase_id ON leads_lead_exports(purchase_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE earn_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_lead_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_lead_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_csv_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_leaderboard ENABLE ROW LEVEL SECURITY;

ALTER TABLE leads_lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_lead_exports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - SHARED TABLES
-- ============================================================================

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Public profiles viewable" ON profiles
  FOR SELECT USING (true);

-- Companies (public read, service role write)
CREATE POLICY "Anyone can view companies" ON companies
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage companies" ON companies
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES - EARN PLATFORM
-- ============================================================================

-- Earn Leads
CREATE POLICY "Users can view own earn leads" ON earn_leads
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can view public/anonymized earn leads" ON earn_leads
  FOR SELECT USING (visibility IN ('public', 'anonymized'));

CREATE POLICY "Users can insert own earn leads" ON earn_leads
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own earn leads" ON earn_leads
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own earn leads" ON earn_leads
  FOR DELETE USING (auth.uid() = owner_id);

-- Earn Lead Views
CREATE POLICY "Users can view own earn lead views" ON earn_lead_views
  FOR SELECT USING (auth.uid() = viewer_id);

CREATE POLICY "Earn lead owners can view their lead views" ON earn_lead_views
  FOR SELECT USING (
    auth.uid() IN (SELECT owner_id FROM earn_leads WHERE id = lead_id)
  );

CREATE POLICY "Users can insert earn lead views" ON earn_lead_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Earn Introductions
CREATE POLICY "Users can view earn introductions they're involved in" ON earn_introductions
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = owner_id
  );

CREATE POLICY "Users can create earn intro requests" ON earn_introductions
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Earn lead owners can update intros" ON earn_introductions
  FOR UPDATE USING (auth.uid() = owner_id);

-- Earn Deals
CREATE POLICY "Users can view their earn deals" ON earn_deals
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create earn deals as buyer" ON earn_deals
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update their earn deals" ON earn_deals
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Earn Transactions
CREATE POLICY "Users can view own earn transactions" ON earn_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Earn Lead Matches
CREATE POLICY "Users can view their earn matches" ON earn_lead_matches
  FOR SELECT USING (auth.uid() = buyer_id);

-- Earn CSV Imports
CREATE POLICY "Users can view own earn csv imports" ON earn_csv_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own earn csv imports" ON earn_csv_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Earn Leaderboard
CREATE POLICY "Anyone can view earn leaderboard" ON earn_leaderboard
  FOR SELECT USING (true);

-- ============================================================================
-- RLS POLICIES - LEADS PLATFORM
-- ============================================================================

-- Leads Lead Lists (public read for active lists)
CREATE POLICY "Anyone can view active lead lists" ON leads_lead_lists
  FOR SELECT USING (is_active = TRUE);

-- Leads List Items (access via Edge Functions after purchase)
CREATE POLICY "Service role can manage leads list items" ON leads_list_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Leads Purchases
CREATE POLICY "Users can view own leads purchases" ON leads_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create leads purchases" ON leads_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leads Subscriptions
CREATE POLICY "Users can view own leads subscriptions" ON leads_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Leads CRM Integrations
CREATE POLICY "Users can view own leads crm integrations" ON leads_crm_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own leads crm integrations" ON leads_crm_integrations
  FOR ALL USING (auth.uid() = user_id);

-- Leads Exports
CREATE POLICY "Users can view own leads exports" ON leads_lead_exports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create leads exports" ON leads_lead_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earn_leads_updated_at BEFORE UPDATE ON earn_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earn_deals_updated_at BEFORE UPDATE ON earn_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_lead_lists_updated_at BEFORE UPDATE ON leads_lead_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_crm_integrations_updated_at BEFORE UPDATE ON leads_crm_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

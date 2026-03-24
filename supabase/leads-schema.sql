-- ============================================================================
-- SUPABASE SCHEMA FOR LEADS.DOI.BIO
-- ============================================================================
-- Shared Supabase instance for:
--   - login.doi.bio.me (SSO portal)
--   - leads.doi.bio.me (premium biotech lead marketplace)
--
-- NOTE: earn.doi.bio.me uses local SQLite storage
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

  -- Leads Platform Fields
  leads_stripe_customer_id TEXT,  -- For making purchases

  -- Shared CRM Integration Status
  salesforce_connected BOOLEAN DEFAULT FALSE,
  salesforce_instance_url TEXT,
  hubspot_connected BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared company enrichment cache
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
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM integration configurations
CREATE TABLE leads_crm_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN ('salesforce', 'hubspot', 'pipedrive')),
  is_active BOOLEAN DEFAULT TRUE,
  credentials JSONB NOT NULL,
  sync_settings JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead export history
CREATE TABLE leads_lead_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_list_id UUID REFERENCES leads_lead_lists(id),
  crm_integration_id UUID REFERENCES leads_crm_integrations(id),
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'salesforce', 'hubspot', 'pipedrive')),
  record_count INTEGER NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_lead_exports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Companies: public read access
CREATE POLICY "Companies are publicly readable"
  ON companies FOR SELECT
  USING (true);

-- Lead Lists: public read access
CREATE POLICY "Lead lists are publicly readable"
  ON leads_lead_lists FOR SELECT
  USING (is_active = true);

-- List Items: only visible after purchase
CREATE POLICY "Users can view purchased leads"
  ON leads_list_items FOR SELECT
  USING (
    lead_list_id IN (
      SELECT lead_list_id FROM leads_purchases
      WHERE user_id = auth.uid() AND status = 'completed'
    )
  );

-- Purchases: users can view their own purchases
CREATE POLICY "Users can view own purchases"
  ON leads_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own purchases"
  ON leads_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Subscriptions: users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON leads_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON leads_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

-- CRM Integrations: users can manage their own integrations
CREATE POLICY "Users can manage own CRM integrations"
  ON leads_crm_integrations FOR ALL
  USING (user_id = auth.uid());

-- Lead Exports: users can view their own exports
CREATE POLICY "Users can view own exports"
  ON leads_lead_exports FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own exports"
  ON leads_lead_exports FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_lead_lists_category ON leads_lead_lists(category);
CREATE INDEX idx_lead_lists_is_active ON leads_lead_lists(is_active);
CREATE INDEX idx_list_items_lead_list_id ON leads_list_items(lead_list_id);
CREATE INDEX idx_purchases_user_id ON leads_purchases(user_id);
CREATE INDEX idx_purchases_lead_list_id ON leads_purchases(lead_list_id);
CREATE INDEX idx_subscriptions_user_id ON leads_subscriptions(user_id);
CREATE INDEX idx_crm_integrations_user_id ON leads_crm_integrations(user_id);
CREATE INDEX idx_lead_exports_user_id ON leads_lead_exports(user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_lead_lists_updated_at
  BEFORE UPDATE ON leads_lead_lists
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON leads_subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_crm_integrations_updated_at
  BEFORE UPDATE ON leads_crm_integrations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- DONE!
-- ============================================================================

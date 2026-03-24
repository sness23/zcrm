-- ============================================================================
-- DROP ALL TABLES - CLEAN SLATE MIGRATION
-- ============================================================================
-- DANGER: This will delete ALL data in your Supabase database
-- Only use this if you're starting fresh or have backups
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
DROP TRIGGER IF EXISTS set_updated_at_lead_lists ON lead_lists;
DROP TRIGGER IF EXISTS set_updated_at_crm_integrations ON crm_integrations;

-- ============================================================================
-- STEP 2: DROP ALL FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- STEP 3: DROP EARN PLATFORM TABLES (if they exist)
-- ============================================================================

DROP TABLE IF EXISTS earn_leaderboard CASCADE;
DROP TABLE IF EXISTS earn_csv_imports CASCADE;
DROP TABLE IF EXISTS earn_lead_matches CASCADE;
DROP TABLE IF EXISTS earn_transactions CASCADE;
DROP TABLE IF EXISTS earn_deals CASCADE;
DROP TABLE IF EXISTS earn_introductions CASCADE;
DROP TABLE IF EXISTS earn_lead_views CASCADE;
DROP TABLE IF EXISTS earn_leads CASCADE;

-- Drop old unprefixed versions (from original earn schema)
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS csv_imports CASCADE;
DROP TABLE IF EXISTS lead_matches CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS introductions CASCADE;
DROP TABLE IF EXISTS lead_views CASCADE;

-- ============================================================================
-- STEP 4: DROP LEADS PLATFORM TABLES (if they exist)
-- ============================================================================

DROP TABLE IF EXISTS leads_lead_exports CASCADE;
DROP TABLE IF EXISTS leads_crm_integrations CASCADE;
DROP TABLE IF EXISTS leads_subscriptions CASCADE;
DROP TABLE IF EXISTS leads_purchases CASCADE;
DROP TABLE IF EXISTS leads_list_items CASCADE;
DROP TABLE IF EXISTS leads_lead_lists CASCADE;

-- Drop old unprefixed versions (from original leads schema)
DROP TABLE IF EXISTS lead_exports CASCADE;
DROP TABLE IF EXISTS crm_integrations CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS lead_lists CASCADE;

-- ============================================================================
-- STEP 5: DROP LEADS TABLE (conflicts between both schemas)
-- ============================================================================

DROP TABLE IF EXISTS leads CASCADE;

-- ============================================================================
-- STEP 6: DROP SHARED TABLES
-- ============================================================================

DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE 'sql_%';

  RAISE NOTICE 'Remaining tables in public schema: %', table_count;

  IF table_count = 0 THEN
    RAISE NOTICE '✓ All tables dropped successfully!';
  ELSE
    RAISE NOTICE '⚠ Some tables still remain. Check manually.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify all tables are dropped
-- 3. Run the unified-schema.sql to create new tables
-- 4. Update your application code to use new table names
-- ============================================================================

-- ============================================================================
-- DROP OLD EARN TABLES (unprefixed versions only)
-- ============================================================================
-- This drops only the old earn tables WITHOUT the earn_ prefix
-- Safe to run - won't touch earn_ prefixed tables or other platform tables
-- ============================================================================

BEGIN;

-- Drop old unprefixed earn tables
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS csv_imports CASCADE;
DROP TABLE IF EXISTS lead_matches CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS introductions CASCADE;
DROP TABLE IF EXISTS lead_views CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- Verification
DO $$
DECLARE
  old_earn_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name) INTO old_earn_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('leaderboard', 'csv_imports', 'lead_matches', 'transactions',
                       'deals', 'introductions', 'lead_views', 'leads');

  IF old_earn_tables IS NULL THEN
    RAISE NOTICE '✓ All old earn tables dropped successfully!';
  ELSE
    RAISE NOTICE '⚠ Some old tables still exist: %', old_earn_tables;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- After running this, you can:
-- 1. Run unified-schema.sql to create new earn_ prefixed tables
-- 2. Or keep existing earn_ tables if you already created them
-- ============================================================================

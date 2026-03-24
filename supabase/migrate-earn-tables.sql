-- ============================================================================
-- MIGRATION SCRIPT: EARN PLATFORM TABLE RENAMING
-- ============================================================================
-- Renames earn.doi.bio.me tables from unprefixed to earn_ prefix
-- Safe to run on existing database with data
--
-- IMPORTANT: Run this BEFORE deploying app code changes
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP EXISTING TRIGGERS (will recreate later)
-- ============================================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================================
-- STEP 2: RENAME TABLES
-- ============================================================================

-- Rename core tables (order matters due to foreign key dependencies)
ALTER TABLE IF EXISTS leaderboard RENAME TO earn_leaderboard;
ALTER TABLE IF EXISTS csv_imports RENAME TO earn_csv_imports;
ALTER TABLE IF EXISTS lead_matches RENAME TO earn_lead_matches;
ALTER TABLE IF EXISTS transactions RENAME TO earn_transactions;
ALTER TABLE IF EXISTS deals RENAME TO earn_deals;
ALTER TABLE IF EXISTS introductions RENAME TO earn_introductions;
ALTER TABLE IF EXISTS lead_views RENAME TO earn_lead_views;
ALTER TABLE IF EXISTS leads RENAME TO earn_leads;

-- Note: profiles table will be merged, not renamed (see Step 6)

-- ============================================================================
-- STEP 3: RENAME INDEXES
-- ============================================================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_leads_owner;
DROP INDEX IF EXISTS idx_leads_company;
DROP INDEX IF EXISTS idx_leads_visibility;
DROP INDEX IF EXISTS idx_leads_industry;
DROP INDEX IF EXISTS idx_lead_views_lead;
DROP INDEX IF EXISTS idx_lead_views_viewer;
DROP INDEX IF EXISTS idx_transactions_user;
DROP INDEX IF EXISTS idx_deals_buyer;
DROP INDEX IF EXISTS idx_deals_seller;

-- Create new indexes with proper naming
CREATE INDEX idx_earn_leads_owner ON earn_leads(owner_id);
CREATE INDEX idx_earn_leads_company ON earn_leads(company_name);
CREATE INDEX idx_earn_leads_visibility ON earn_leads(visibility);
CREATE INDEX idx_earn_leads_industry ON earn_leads(industry);
CREATE INDEX idx_earn_lead_views_lead ON earn_lead_views(lead_id);
CREATE INDEX idx_earn_lead_views_viewer ON earn_lead_views(viewer_id);
CREATE INDEX idx_earn_transactions_user ON earn_transactions(user_id);
CREATE INDEX idx_earn_deals_buyer ON earn_deals(buyer_id);
CREATE INDEX idx_earn_deals_seller ON earn_deals(seller_id);

-- ============================================================================
-- STEP 4: UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Note: PostgreSQL automatically updates foreign key constraints when tables
-- are renamed, but constraint names remain unchanged. Optionally rename them:

-- Earn lead views
ALTER TABLE earn_lead_views
  DROP CONSTRAINT IF EXISTS lead_views_lead_id_fkey,
  ADD CONSTRAINT earn_lead_views_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES earn_leads(id) ON DELETE CASCADE;

ALTER TABLE earn_lead_views
  DROP CONSTRAINT IF EXISTS lead_views_viewer_id_fkey,
  ADD CONSTRAINT earn_lead_views_viewer_id_fkey
    FOREIGN KEY (viewer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Earn introductions
ALTER TABLE earn_introductions
  DROP CONSTRAINT IF EXISTS introductions_lead_id_fkey,
  ADD CONSTRAINT earn_introductions_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES earn_leads(id) ON DELETE CASCADE;

-- Earn deals
ALTER TABLE earn_deals
  DROP CONSTRAINT IF EXISTS deals_lead_id_fkey,
  ADD CONSTRAINT earn_deals_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES earn_leads(id) ON DELETE SET NULL;

-- Earn transactions
ALTER TABLE earn_transactions
  DROP CONSTRAINT IF EXISTS transactions_deal_id_fkey,
  ADD CONSTRAINT earn_transactions_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES earn_deals(id) ON DELETE SET NULL;

-- Earn lead matches
ALTER TABLE earn_lead_matches
  DROP CONSTRAINT IF EXISTS lead_matches_lead_id_fkey,
  ADD CONSTRAINT earn_lead_matches_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES earn_leads(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: UPDATE RLS POLICY NAMES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own leads" ON earn_leads;
DROP POLICY IF EXISTS "Users can view public/anonymized leads" ON earn_leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON earn_leads;
DROP POLICY IF EXISTS "Users can update own leads" ON earn_leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON earn_leads;

DROP POLICY IF EXISTS "Users can view own lead views" ON earn_lead_views;
DROP POLICY IF EXISTS "Lead owners can view their lead views" ON earn_lead_views;
DROP POLICY IF EXISTS "Users can insert lead views" ON earn_lead_views;

DROP POLICY IF EXISTS "Users can view introductions they're involved in" ON earn_introductions;
DROP POLICY IF EXISTS "Users can create intro requests" ON earn_introductions;
DROP POLICY IF EXISTS "Lead owners can update intros" ON earn_introductions;

DROP POLICY IF EXISTS "Users can view their deals" ON earn_deals;
DROP POLICY IF EXISTS "Users can create deals as buyer" ON earn_deals;
DROP POLICY IF EXISTS "Users can update their deals" ON earn_deals;

DROP POLICY IF EXISTS "Users can view own transactions" ON earn_transactions;
DROP POLICY IF EXISTS "Users can view their matches" ON earn_lead_matches;
DROP POLICY IF EXISTS "Users can view own imports" ON earn_csv_imports;
DROP POLICY IF EXISTS "Users can insert own imports" ON earn_csv_imports;
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON earn_leaderboard;

-- Recreate policies with new names
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

CREATE POLICY "Users can view own earn lead views" ON earn_lead_views
  FOR SELECT USING (auth.uid() = viewer_id);

CREATE POLICY "Earn lead owners can view their lead views" ON earn_lead_views
  FOR SELECT USING (
    auth.uid() IN (SELECT owner_id FROM earn_leads WHERE id = lead_id)
  );

CREATE POLICY "Users can insert earn lead views" ON earn_lead_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can view earn introductions they're involved in" ON earn_introductions
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = owner_id
  );

CREATE POLICY "Users can create earn intro requests" ON earn_introductions
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Earn lead owners can update intros" ON earn_introductions
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view their earn deals" ON earn_deals
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create earn deals as buyer" ON earn_deals
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update their earn deals" ON earn_deals
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can view own earn transactions" ON earn_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their earn matches" ON earn_lead_matches
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Users can view own earn csv imports" ON earn_csv_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own earn csv imports" ON earn_csv_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view earn leaderboard" ON earn_leaderboard
  FOR SELECT USING (true);

-- ============================================================================
-- STEP 6: MIGRATE PROFILES TABLE
-- ============================================================================

-- Add new earn-specific columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_tier TEXT DEFAULT 'bronze'
  CHECK (earn_tier IN ('bronze', 'silver', 'gold', 'platinum'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_total_earnings DECIMAL(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_total_leads_shared INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_total_deals_closed INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_reputation_score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS earn_stripe_connect_id TEXT;

-- Migrate data from old profiles columns to new earn_ prefixed columns
-- (Assumes old profiles table had: tier, total_earnings, etc.)
UPDATE profiles SET
  earn_tier = COALESCE(tier, 'bronze'),
  earn_total_earnings = COALESCE(total_earnings, 0),
  earn_total_leads_shared = COALESCE(total_leads_shared, 0),
  earn_total_deals_closed = COALESCE(total_deals_closed, 0),
  earn_reputation_score = COALESCE(reputation_score, 0),
  earn_stripe_connect_id = stripe_connect_id
WHERE tier IS NOT NULL OR total_earnings IS NOT NULL;

-- Drop old unprefixed columns (after data migration)
ALTER TABLE profiles DROP COLUMN IF EXISTS tier;
ALTER TABLE profiles DROP COLUMN IF EXISTS total_earnings;
ALTER TABLE profiles DROP COLUMN IF EXISTS total_leads_shared;
ALTER TABLE profiles DROP COLUMN IF EXISTS total_deals_closed;
ALTER TABLE profiles DROP COLUMN IF EXISTS reputation_score;
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_connect_id;

-- ============================================================================
-- STEP 7: RECREATE TRIGGERS
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earn_leads_updated_at BEFORE UPDATE ON earn_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earn_deals_updated_at BEFORE UPDATE ON earn_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to verify success)
-- ============================================================================

-- Verify table renames
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'earn_leads') THEN
    RAISE EXCEPTION 'Migration failed: earn_leads table not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'earn_deals') THEN
    RAISE EXCEPTION 'Migration failed: earn_deals table not found';
  END IF;

  RAISE NOTICE 'Migration verification passed!';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION CHECKLIST
-- ============================================================================
-- [ ] Verify all earn_ tables exist
-- [ ] Check row counts match pre-migration counts
-- [ ] Update application code to use new table names
-- [ ] Update TypeScript types
-- [ ] Deploy updated frontend code
-- [ ] Test core user flows (lead creation, intro requests, etc.)
-- ============================================================================

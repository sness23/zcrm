-- Add account_id foreign key to leads table
-- This allows linking leads to accounts for qualification tracking

ALTER TABLE leads ADD COLUMN account_id TEXT REFERENCES accounts(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);

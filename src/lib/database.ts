import Database from 'better-sqlite3'
import path from 'path'
import type { Event } from './event-log.js'

export class CRMDatabase {
  public db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL') // Better performance
    this.db.pragma('foreign_keys = ON') // Enforce foreign keys
    this.initSchema()
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    // Accounts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website TEXT,
        industry TEXT,
        owner TEXT,
        lifecycle_stage TEXT,
        created TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
      CREATE INDEX IF NOT EXISTS idx_accounts_lifecycle_stage ON accounts(lifecycle_stage);
    `)

    // Contacts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    `)

    // Opportunities
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        stage TEXT,
        amount_acv REAL,
        close_date TEXT,
        probability REAL,
        next_action TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_opportunities_account ON opportunities(account_id);
      CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
      CREATE INDEX IF NOT EXISTS idx_opportunities_close_date ON opportunities(close_date);
    `)

    // Leads
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        source TEXT,
        status TEXT,
        rating TEXT,
        account_id TEXT REFERENCES accounts(id),
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
    `)

    // Activities
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT,
        "when" TEXT,
        status TEXT,
        summary TEXT,
        duration_min INTEGER,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_activities_when ON activities("when");
      CREATE INDEX IF NOT EXISTS idx_activities_kind ON activities(kind);
    `)

    // Tasks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT,
        status TEXT,
        priority TEXT,
        due_date TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    `)

    // Quotes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT,
        account_id TEXT,
        name TEXT NOT NULL,
        status TEXT,
        total_amount REAL,
        valid_until TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_opportunity ON quotes(opportunity_id);
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    `)

    // Products
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        price REAL,
        status TEXT,
        is_active INTEGER,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    `)

    // Campaigns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT,
        campaign_type TEXT,
        start_date TEXT,
        end_date TEXT,
        budget REAL,
        num_leads INTEGER,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
    `)

    // System tracking table for worker operations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        event_id TEXT PRIMARY KEY,
        type TEXT,
        entity_type TEXT,
        entity_id TEXT,
        status TEXT,
        timestamp TEXT,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_log_entity_type ON sync_log(entity_type);
    `)

    // Calendar Events (entity type)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT,
        start_datetime TEXT,
        end_datetime TEXT,
        location TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_events_start_datetime ON calendar_events(start_datetime);
    `)

    // Orders
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        status TEXT,
        effective_date TEXT,
        total_amount REAL,
        order_number TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `)

    // Contracts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        status TEXT,
        start_date TEXT,
        end_date TEXT,
        contract_term INTEGER,
        total_value REAL,
        contract_number TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contracts_account ON contracts(account_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
    `)

    // Assets
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        product_id TEXT,
        name TEXT NOT NULL,
        status TEXT,
        purchase_date TEXT,
        install_date TEXT,
        quantity INTEGER,
        serial_number TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_assets_account ON assets(account_id);
      CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product_id);
    `)

    // Cases
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT,
        status TEXT,
        priority TEXT,
        origin TEXT,
        case_number TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
      CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
    `)

    // Knowledge
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        article_type TEXT,
        category TEXT,
        is_published INTEGER,
        article_number TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
      CREATE INDEX IF NOT EXISTS idx_knowledge_article_type ON knowledge(article_type);
    `)

    // Contact App: Visitor Sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id TEXT PRIMARY KEY,
        socket_id TEXT UNIQUE NOT NULL,
        phone TEXT,
        email TEXT,
        name TEXT,
        company TEXT,
        message TEXT,
        connected_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        disconnected_at TEXT,
        page_url TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        ip_address TEXT,
        location_city TEXT,
        location_region TEXT,
        location_country TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        imessage_sent INTEGER DEFAULT 0,
        imessage_sent_at TEXT,
        admin_engaged INTEGER DEFAULT 0,
        admin_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_socket_id ON visitor_sessions(socket_id);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_status ON visitor_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_connected_at ON visitor_sessions(connected_at);
      CREATE INDEX IF NOT EXISTS idx_visitor_sessions_phone ON visitor_sessions(phone);
    `)

    // Contact App: Chat Messages
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        author TEXT NOT NULL CHECK(author IN ('visitor', 'admin')),
        author_name TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'web' CHECK(channel IN ('web', 'imessage')),
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES visitor_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON contact_chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON contact_chat_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON contact_chat_messages(read);
    `)

    // Contact App: iMessage Log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS imessage_log (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        template_id TEXT,
        sent_at TEXT NOT NULL,
        delivery_status TEXT NOT NULL CHECK(delivery_status IN ('sent', 'delivered', 'failed', 'read')),
        delivery_updated_at TEXT,
        imcp_response TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES visitor_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_imessage_log_session_id ON imessage_log(session_id);
      CREATE INDEX IF NOT EXISTS idx_imessage_log_phone ON imessage_log(phone);
      CREATE INDEX IF NOT EXISTS idx_imessage_log_sent_at ON imessage_log(sent_at);
    `)

    // Party Model Tables (Phase 3.C - Identity Resolution System)
    // Party - Canonical identity (universal person/org identity)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parties (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        canonical_name TEXT,
        party_type TEXT NOT NULL CHECK(party_type IN ('Individual','Organization','Household')),
        unified_score REAL CHECK(unified_score BETWEEN 0 AND 1),
        merge_source_party_ids TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
      CREATE INDEX IF NOT EXISTS idx_parties_canonical_name ON parties(canonical_name);
      CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
      CREATE INDEX IF NOT EXISTS idx_parties_unified_score ON parties(unified_score);
    `)

    // Individual - Person demographic profile
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS individuals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        person_name TEXT NOT NULL,
        canonical_name TEXT,
        person_given_name TEXT,
        person_middle_name TEXT,
        person_family_name TEXT,
        first_name TEXT,
        middle_name TEXT,
        last_name TEXT,
        preferred_name TEXT,
        salutation TEXT,
        name_suffix TEXT,
        birth_date TEXT,
        gender TEXT CHECK(gender IN ('Male','Female','Non-Binary','Prefer Not to Say','Other')),
        pronoun TEXT CHECK(pronoun IN ('He/Him','She/Her','They/Them','Other')),
        primary_language TEXT,
        photo_url TEXT,
        website_url TEXT,
        has_opted_out_processing INTEGER DEFAULT 0,
        has_opted_out_profiling INTEGER DEFAULT 0,
        has_opted_out_tracking INTEGER DEFAULT 0,
        has_opted_out_geo_tracking INTEGER DEFAULT 0,
        has_opted_out_solicit INTEGER DEFAULT 0,
        should_forget INTEGER DEFAULT 0,
        residence_country TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_individuals_party_id ON individuals(party_id);
      CREATE INDEX IF NOT EXISTS idx_individuals_name ON individuals(person_name);
      CREATE INDEX IF NOT EXISTS idx_individuals_canonical_name ON individuals(canonical_name);
      CREATE INDEX IF NOT EXISTS idx_individuals_email ON individuals(person_name);
    `)

    // Organization - Company/institution demographic profile
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        organization_name TEXT NOT NULL,
        canonical_name TEXT,
        organization_type TEXT,
        industry TEXT,
        website_url TEXT,
        employee_count INTEGER,
        annual_revenue_usd REAL,
        year_founded INTEGER,
        stock_symbol TEXT,
        is_publicly_traded INTEGER DEFAULT 0,
        parent_organization_id TEXT,
        headquarters_country TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_organizations_party_id ON organizations(party_id);
      CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(organization_name);
      CREATE INDEX IF NOT EXISTS idx_organizations_canonical_name ON organizations(canonical_name);
      CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);
    `)

    // Household - Family/household unit
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        household_name TEXT NOT NULL,
        primary_address_id TEXT,
        household_size INTEGER,
        household_income_range TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_households_party_id ON households(party_id);
      CREATE INDEX IF NOT EXISTS idx_households_name ON households(household_name);
    `)

    // PartyIdentification - External IDs (ORCID, Google Scholar, LinkedIn, etc.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS party_identifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        identification_number TEXT NOT NULL,
        party_identification_type TEXT NOT NULL CHECK(party_identification_type IN (
          'ORCID','GoogleScholar','SemanticScholar','LinkedIn','Twitter','GitHub',
          'ResearchGate','PubMed','Scopus','Website','Email','Phone','CRM_Contact_ID',
          'CRM_Lead_ID','Other'
        )),
        confidence_score REAL CHECK(confidence_score BETWEEN 0 AND 1),
        match_method TEXT CHECK(match_method IN (
          'exact_id','exact_email','fuzzy_name','co_authorship',
          'institutional','manual','api_verified'
        )),
        source_url TEXT,
        discovered_date TEXT,
        last_verified_date TEXT,
        is_verified INTEGER DEFAULT 0,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_party_identifications_party_id ON party_identifications(party_id);
      CREATE INDEX IF NOT EXISTS idx_party_identifications_number ON party_identifications(identification_number);
      CREATE INDEX IF NOT EXISTS idx_party_identifications_type ON party_identifications(party_identification_type);
      CREATE INDEX IF NOT EXISTS idx_party_identifications_confidence ON party_identifications(confidence_score);
    `)

    // AccountContactRelationship - Junction table for Account-Contact relationships
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS account_contact_relationships (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        account_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        role TEXT CHECK(role IN (
          'Decision Maker','Employee','Founder','Executive','Manager',
          'PhD Student','Postdoc','Professor','Supervisor','Collaborator',
          'Advisor','Board Member','Consultant','Contractor','Intern','Other'
        )),
        start_date TEXT,
        end_date TEXT,
        is_primary INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        is_direct INTEGER DEFAULT 1,
        supervisor_contact_id TEXT,
        department TEXT,
        title TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (supervisor_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_acr_account_id ON account_contact_relationships(account_id);
      CREATE INDEX IF NOT EXISTS idx_acr_contact_id ON account_contact_relationships(contact_id);
      CREATE INDEX IF NOT EXISTS idx_acr_supervisor ON account_contact_relationships(supervisor_contact_id);
      CREATE INDEX IF NOT EXISTS idx_acr_role ON account_contact_relationships(role);
      CREATE INDEX IF NOT EXISTS idx_acr_is_active ON account_contact_relationships(is_active);
      CREATE INDEX IF NOT EXISTS idx_acr_is_primary ON account_contact_relationships(is_primary);
    `)

    // ContactPointEmail - Email addresses
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_point_emails (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        email_address TEXT NOT NULL,
        email_type TEXT CHECK(email_type IN ('Work','Personal','Academic','Other')),
        is_primary INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        opt_in_status TEXT CHECK(opt_in_status IN ('Opted In','Opted Out','Unknown')),
        bounce_status TEXT CHECK(bounce_status IN ('Valid','Hard Bounce','Soft Bounce','Unknown')),
        last_verified_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_contact_point_emails_party_id ON contact_point_emails(party_id);
      CREATE INDEX IF NOT EXISTS idx_contact_point_emails_email ON contact_point_emails(email_address);
      CREATE INDEX IF NOT EXISTS idx_contact_point_emails_primary ON contact_point_emails(is_primary);
    `)

    // ContactPointPhone - Phone numbers
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_point_phones (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        phone_type TEXT CHECK(phone_type IN ('Work','Mobile','Home','Fax','Other')),
        is_primary INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        sms_opt_in INTEGER DEFAULT 0,
        last_verified_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_contact_point_phones_party_id ON contact_point_phones(party_id);
      CREATE INDEX IF NOT EXISTS idx_contact_point_phones_phone ON contact_point_phones(phone_number);
      CREATE INDEX IF NOT EXISTS idx_contact_point_phones_primary ON contact_point_phones(is_primary);
    `)

    // ContactPointAddress - Physical addresses
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_point_addresses (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        party_id TEXT NOT NULL,
        address_type TEXT CHECK(address_type IN ('Work','Home','Mailing','Billing','Other')),
        street_address TEXT,
        city TEXT,
        state_province TEXT,
        postal_code TEXT,
        country TEXT,
        is_primary INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_contact_point_addresses_party_id ON contact_point_addresses(party_id);
      CREATE INDEX IF NOT EXISTS idx_contact_point_addresses_country ON contact_point_addresses(country);
      CREATE INDEX IF NOT EXISTS idx_contact_point_addresses_primary ON contact_point_addresses(is_primary);
    `)

    // Research Intelligence Tables (Phase 3)
    // ResearcherProfile - Academic/research-specific profile data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS researcher_profiles (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        individual_id TEXT NOT NULL,
        party_id TEXT NOT NULL,
        orcid_id TEXT,
        google_scholar_id TEXT,
        pubmed_author_id TEXT,
        research_gate_profile TEXT,
        linkedin_url TEXT,
        current_position TEXT,
        current_institution TEXT,
        current_department TEXT,
        position_start_date TEXT,
        previous_institution TEXT,
        primary_research_area TEXT,
        secondary_research_areas TEXT,
        techniques_used TEXT,
        organisms_studied TEXT,
        therapeutic_areas TEXT,
        h_index INTEGER,
        total_citations INTEGER,
        publications_count INTEGER,
        first_author_papers INTEGER,
        last_author_papers INTEGER,
        recent_high_impact_papers INTEGER,
        active_grants TEXT,
        total_funding_usd REAL,
        funding_sources TEXT,
        funding_end_date TEXT,
        has_own_lab INTEGER DEFAULT 0,
        lab_size INTEGER,
        lab_budget_usd REAL,
        equipment_budget_usd REAL,
        recruits_postdocs INTEGER DEFAULT 0,
        recruits_grad_students INTEGER DEFAULT 0,
        tech_stack TEXT,
        recent_equipment_purchases TEXT,
        attended_conferences TEXT,
        conference_role TEXT,
        first_discovered TEXT,
        discovery_source TEXT,
        last_enriched TEXT,
        enrichment_sources TEXT,
        lead_score INTEGER CHECK(lead_score BETWEEN 0 AND 100),
        lead_temperature TEXT CHECK(lead_temperature IN ('Cold','Warm','Hot')),
        next_review_date TEXT,
        subscribed_to_newsletter INTEGER DEFAULT 0,
        attended_webinars TEXT,
        downloaded_resources TEXT,
        opened_emails_count INTEGER DEFAULT 0,
        clicked_emails_count INTEGER DEFAULT 0,
        last_engagement_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (individual_id) REFERENCES individuals(id) ON DELETE CASCADE,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_individual_id ON researcher_profiles(individual_id);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_party_id ON researcher_profiles(party_id);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_orcid ON researcher_profiles(orcid_id);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_position ON researcher_profiles(current_position);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_research_area ON researcher_profiles(primary_research_area);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_lead_score ON researcher_profiles(lead_score);
      CREATE INDEX IF NOT EXISTS idx_researcher_profiles_lead_temp ON researcher_profiles(lead_temperature);
    `)

    // OrganizationProfile - Institution intelligence
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS organization_profiles (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        party_id TEXT NOT NULL,
        institution_type TEXT NOT NULL CHECK(institution_type IN ('Academic','Biotech','Pharma','CRO','Nonprofit','Government','Other')),
        institution_subtype TEXT,
        carnegie_classification TEXT,
        is_r1_institution INTEGER DEFAULT 0,
        total_research_funding_usd REAL,
        nih_funding_rank INTEGER,
        has_medical_school INTEGER DEFAULT 0,
        graduate_programs TEXT,
        research_strengths TEXT,
        major_research_centers TEXT,
        core_facilities TEXT,
        total_faculty INTEGER,
        biotech_faculty INTEGER,
        labs_in_target_area INTEGER,
        key_decision_makers TEXT,
        procurement_model TEXT CHECK(procurement_model IN ('Centralized','Decentralized','Hybrid')),
        purchasing_contacts TEXT,
        preferred_vendors TEXT,
        fiscal_year_end TEXT,
        budget_cycle TEXT CHECK(budget_cycle IN ('Annual','Biennial','Other')),
        grant_cycles TEXT,
        equipment_inventory TEXT,
        software_used TEXT,
        customer_count INTEGER DEFAULT 0,
        prospect_count INTEGER DEFAULT 0,
        total_revenue_usd REAL DEFAULT 0,
        potential_revenue_usd REAL DEFAULT 0,
        last_on_site_visit TEXT,
        next_planned_visit TEXT,
        institution_notes TEXT,
        competitive_landscape TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_organization_profiles_organization_id ON organization_profiles(organization_id);
      CREATE INDEX IF NOT EXISTS idx_organization_profiles_party_id ON organization_profiles(party_id);
      CREATE INDEX IF NOT EXISTS idx_organization_profiles_type ON organization_profiles(institution_type);
      CREATE INDEX IF NOT EXISTS idx_organization_profiles_r1 ON organization_profiles(is_r1_institution);
      CREATE INDEX IF NOT EXISTS idx_organization_profiles_customer_count ON organization_profiles(customer_count);
    `)

    // PartySource - Data provenance tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS party_sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        party_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('Conference','Publication','LinkedIn','Referral','Website','Import','Google Scholar','ORCID','PubMed','Institution Directory','Cold Outreach','Webinar','Trade Show','Social Media','Partner','Other')),
        source_name TEXT NOT NULL,
        source_date TEXT,
        source_url TEXT,
        source_file TEXT,
        source_confidence TEXT CHECK(source_confidence IN ('High','Medium','Low')),
        source_notes TEXT,
        import_batch_id TEXT,
        import_date TEXT,
        imported_by TEXT,
        import_method TEXT CHECK(import_method IN ('CSV Upload','API','Manual Entry','Web Scrape','Partner Feed','Other')),
        enrichment_attempts INTEGER DEFAULT 0,
        last_enrichment_date TEXT,
        enrichment_sources TEXT,
        enrichment_success_rate REAL CHECK(enrichment_success_rate BETWEEN 0 AND 1),
        fields_enriched TEXT,
        fields_failed TEXT,
        data_quality_score INTEGER CHECK(data_quality_score BETWEEN 0 AND 100),
        needs_review INTEGER DEFAULT 0,
        review_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_party_sources_party_id ON party_sources(party_id);
      CREATE INDEX IF NOT EXISTS idx_party_sources_source_type ON party_sources(source_type);
      CREATE INDEX IF NOT EXISTS idx_party_sources_batch_id ON party_sources(import_batch_id);
      CREATE INDEX IF NOT EXISTS idx_party_sources_quality ON party_sources(data_quality_score);
      CREATE INDEX IF NOT EXISTS idx_party_sources_needs_review ON party_sources(needs_review);
    `)

    // PartyEngagement - Lead scoring and engagement tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS party_engagements (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        party_id TEXT NOT NULL,
        lead_score INTEGER CHECK(lead_score BETWEEN 0 AND 100),
        lead_temperature TEXT CHECK(lead_temperature IN ('Cold','Warm','Hot')),
        last_score_update TEXT,
        score_trend TEXT CHECK(score_trend IN ('Increasing','Stable','Decreasing')),
        has_funding INTEGER DEFAULT 0,
        funding_amount_usd REAL,
        is_pi INTEGER DEFAULT 0,
        is_decision_maker INTEGER DEFAULT 0,
        uses_relevant_tech INTEGER DEFAULT 0,
        attended_event INTEGER DEFAULT 0,
        opened_emails INTEGER DEFAULT 0,
        visited_website INTEGER DEFAULT 0,
        downloaded_resources INTEGER DEFAULT 0,
        first_contact_date TEXT,
        last_contact_date TEXT,
        total_touchpoints INTEGER DEFAULT 0,
        email_opens INTEGER DEFAULT 0,
        email_clicks INTEGER DEFAULT 0,
        webinar_attendances INTEGER DEFAULT 0,
        conference_meetings INTEGER DEFAULT 0,
        phone_calls INTEGER DEFAULT 0,
        demos_attended INTEGER DEFAULT 0,
        recommended_action TEXT CHECK(recommended_action IN ('Schedule Demo','Send Follow-Up Email','Phone Call','Add to Nurture Campaign','Request Meeting','Send Case Study','Invite to Webinar','No Action','Other')),
        next_action_date TEXT,
        assigned_to TEXT,
        pipeline_stage TEXT CHECK(pipeline_stage IN ('New Lead','Qualified Lead','Contact Made','Demo Scheduled','Demo Complete','Proposal Sent','Negotiation','Closed Won','Closed Lost','Nurture')),
        estimated_close_date TEXT,
        estimated_deal_size_usd REAL,
        win_probability REAL CHECK(win_probability BETWEEN 0 AND 1),
        lost_reason TEXT CHECK(lost_reason IN ('Budget','Timing','Competitor','No Response','Not a Fit','Other')),
        engagement_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_party_engagements_party_id ON party_engagements(party_id);
      CREATE INDEX IF NOT EXISTS idx_party_engagements_lead_score ON party_engagements(lead_score);
      CREATE INDEX IF NOT EXISTS idx_party_engagements_lead_temp ON party_engagements(lead_temperature);
      CREATE INDEX IF NOT EXISTS idx_party_engagements_pipeline ON party_engagements(pipeline_stage);
      CREATE INDEX IF NOT EXISTS idx_party_engagements_assigned ON party_engagements(assigned_to);
    `)

    // OAuth tokens for Gmail API
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        user_email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date INTEGER,
        token_type TEXT,
        scope TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
    `)

    // Email templates
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_md TEXT NOT NULL,
        from_name TEXT,
        from_email TEXT,
        category TEXT,
        merge_fields TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
      CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
      CREATE INDEX IF NOT EXISTS idx_email_templates_status ON email_templates(status);
    `)

    // Email drafts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_drafts (
        id TEXT PRIMARY KEY,
        template_id TEXT,
        contact_id TEXT,
        party_id TEXT,
        to_email TEXT NOT NULL,
        to_name TEXT,
        subject TEXT NOT NULL,
        body_html TEXT,
        body_md TEXT,
        gmail_draft_id TEXT,
        status TEXT DEFAULT 'created',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
        FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_email_drafts_template ON email_drafts(template_id);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_contact ON email_drafts(contact_id);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_party ON email_drafts(party_id);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_gmail ON email_drafts(gmail_draft_id);
    `)

    // Local users for authentication
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `)

    // User sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `)

    console.log('✓ Database schema initialized')
  }

  /**
   * Apply an event to the database
   */
  applyEvent(event: Event): void {
    const transaction = this.db.transaction(() => {
      switch (event.type) {
        case 'create':
          this.applyCreate(event)
          break
        case 'update':
          this.applyUpdate(event)
          break
        case 'delete':
          this.applyDelete(event)
          break
        case 'bulk':
          if (event.operations) {
            event.operations.forEach((op) => this.applyEvent(op))
          }
          break
      }
    })

    transaction()
  }

  /**
   * Apply a create event
   */
  private applyCreate(event: any): void {
    const { entity_type, data } = event
    const now = new Date().toISOString()

    // Add timestamps if not present
    const record = {
      ...data,
      created_at: data.created_at || now,
      updated_at: now,
    }

    switch (entity_type) {
      case 'Account':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO accounts (id, name, website, industry, owner, lifecycle_stage, created, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.website,
            record.industry,
            record.owner,
            record.lifecycle_stage,
            record.created,
            record.created_at,
            record.updated_at
          )
        break

      case 'Contact':
        // Extract account_id from wikilink [[accounts/slug]]
        const accountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO contacts (id, account_id, name, first_name, last_name, email, phone, title, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            accountId,
            record.name,
            record.first_name,
            record.last_name,
            record.email,
            record.phone,
            record.title,
            record.created_at,
            record.updated_at
          )
        break

      case 'Opportunity':
        const oppAccountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO opportunities (id, account_id, name, stage, amount_acv, close_date, probability, next_action, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            oppAccountId,
            record.name,
            record.stage,
            record.amount_acv,
            record.close_date,
            record.probability,
            record.next_action,
            record.created_at,
            record.updated_at
          )
        break

      case 'Lead':
        // Extract account_id from wikilink [[accounts/slug]]
        const leadAccountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO leads (id, name, email, phone, company, source, status, rating, account_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.email,
            record.phone,
            record.company,
            record.source,
            record.status,
            record.rating,
            leadAccountId,
            record.created_at,
            record.updated_at
          )
        break

      case 'Activity':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO activities (id, name, kind, "when", status, summary, duration_min, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.kind,
            record.when,
            record.status,
            record.summary,
            record.duration_min,
            record.created_at,
            record.updated_at
          )
        break

      case 'Task':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO tasks (id, name, subject, status, priority, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.subject,
            record.status,
            record.priority,
            record.due_date,
            record.created_at,
            record.updated_at
          )
        break

      case 'Quote':
        const quoteOppId = this.extractOpportunityId(record.opportunity)
        const quoteAccountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO quotes (id, opportunity_id, account_id, name, status, total_amount, valid_until, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            quoteOppId,
            quoteAccountId,
            record.name,
            record.status,
            record.total_amount ?? record.amount, // Support both total_amount and amount
            record.valid_until,
            record.created_at,
            record.updated_at
          )
        break

      case 'Product':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO products (id, name, sku, price, status, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.sku,
            record.price,
            record.status,
            record.is_active ? 1 : 0,
            record.created_at,
            record.updated_at
          )
        break

      case 'Campaign':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO campaigns (id, name, status, campaign_type, start_date, end_date, budget, num_leads, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.status,
            record.campaign_type,
            record.start_date,
            record.end_date,
            record.budget,
            record.num_leads,
            record.created_at,
            record.updated_at
          )
        break

      case 'Event':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO calendar_events (id, name, subject, start_datetime, end_datetime, location, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.subject,
            record.start_datetime,
            record.end_datetime,
            record.location,
            record.created_at,
            record.updated_at
          )
        break

      case 'Order':
        const orderAccountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO orders (id, account_id, name, status, effective_date, total_amount, order_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            orderAccountId,
            record.name,
            record.status,
            record.effective_date,
            record.total_amount,
            record.order_number,
            record.created_at,
            record.updated_at
          )
        break

      case 'Contract':
        const contractAccountId = this.extractAccountId(record.account)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO contracts (id, account_id, name, status, start_date, end_date, contract_term, total_value, contract_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            contractAccountId,
            record.name,
            record.status,
            record.start_date,
            record.end_date,
            record.contract_term,
            record.total_value,
            record.contract_number,
            record.created_at,
            record.updated_at
          )
        break

      case 'Asset':
        const assetAccountId = this.extractAccountId(record.account)
        const assetProductId = this.extractProductId(record.product)

        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO assets (id, account_id, product_id, name, status, purchase_date, install_date, quantity, serial_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            assetAccountId,
            assetProductId,
            record.name,
            record.status,
            record.purchase_date,
            record.install_date,
            record.quantity,
            record.serial_number,
            record.created_at,
            record.updated_at
          )
        break

      case 'Case':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO cases (id, name, subject, status, priority, origin, case_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.subject,
            record.status,
            record.priority,
            record.origin,
            record.case_number,
            record.created_at,
            record.updated_at
          )
        break

      case 'Knowledge':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO knowledge (id, name, title, article_type, category, is_published, article_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.name,
            record.title,
            record.article_type,
            record.category,
            record.is_published ? 1 : 0,
            record.article_number,
            record.created_at,
            record.updated_at
          )
        break

      case 'visitor-session':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO visitor_sessions (
            id, socket_id, phone, email, name, company, message,
            connected_at, last_activity, disconnected_at,
            page_url, referrer, user_agent, ip_address,
            location_city, location_region, location_country,
            status, imessage_sent, imessage_sent_at,
            admin_engaged, admin_user_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.socket_id,
            record.phone || null,
            record.email || null,
            record.name || null,
            record.company || null,
            record.message || null,
            record.connected_at,
            record.last_activity,
            record.disconnected_at || null,
            record.page_url,
            record.referrer || null,
            record.user_agent || null,
            record.ip_address || null,
            record.location_city || null,
            record.location_region || null,
            record.location_country || null,
            record.status || 'active',
            record.imessage_sent ? 1 : 0,
            record.imessage_sent_at || null,
            record.admin_engaged ? 1 : 0,
            record.admin_user_id || null,
            record.created_at,
            record.updated_at
          )
        break

      case 'contact-chat':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO contact_chat_messages (
            id, session_id, author, author_name, text, timestamp, channel, read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.session_id,
            record.author,
            record.author_name,
            record.text,
            record.timestamp,
            record.channel || 'web',
            record.read ? 1 : 0,
            record.created_at
          )
        break

      case 'imessage-log':
        this.db
          .prepare(
            `
          INSERT OR REPLACE INTO imessage_log (
            id, session_id, phone, message, template_id, sent_at,
            delivery_status, delivery_updated_at, imcp_response, error_message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            record.id,
            record.session_id,
            record.phone,
            record.message,
            record.template_id || null,
            record.sent_at,
            record.delivery_status,
            record.delivery_updated_at || null,
            record.imcp_response || null,
            record.error_message || null,
            record.created_at
          )
        break

      // Party Model entities (Phase 3.C - Identity Resolution)
      case 'party':
        this.db.prepare(`
          INSERT OR REPLACE INTO parties (
            id, type, name, canonical_name, party_type, unified_score,
            merge_source_party_ids, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name,
          record.canonical_name || null, record.party_type,
          record.unified_score || null,
          record.merge_source_party_ids ? JSON.stringify(record.merge_source_party_ids) : null,
          record.created_at, record.updated_at
        )
        break

      case 'individual':
        const partyId_ind = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO individuals (
            id, type, name, party_id, person_name, canonical_name,
            person_given_name, person_middle_name, person_family_name,
            first_name, middle_name, last_name, preferred_name,
            salutation, name_suffix, birth_date, gender, pronoun,
            primary_language, photo_url, website_url,
            has_opted_out_processing, has_opted_out_profiling,
            has_opted_out_tracking, has_opted_out_geo_tracking,
            has_opted_out_solicit, should_forget, residence_country,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_ind,
          record.person_name, record.canonical_name || null,
          record.person_given_name || null, record.person_middle_name || null,
          record.person_family_name || null, record.first_name || null,
          record.middle_name || null, record.last_name || null,
          record.preferred_name || null, record.salutation || null,
          record.name_suffix || null, record.birth_date || null,
          record.gender || null, record.pronoun || null,
          record.primary_language || null, record.photo_url || null,
          record.website_url || null, record.has_opted_out_processing ? 1 : 0,
          record.has_opted_out_profiling ? 1 : 0, record.has_opted_out_tracking ? 1 : 0,
          record.has_opted_out_geo_tracking ? 1 : 0, record.has_opted_out_solicit ? 1 : 0,
          record.should_forget ? 1 : 0, record.residence_country || null,
          record.created_at, record.updated_at
        )
        break

      case 'organization':
        const partyId_org = this.extractId(record.party_id, 'pty_')
        const parentOrgId = this.extractId(record.parent_organization_id, 'org_')

        this.db.prepare(`
          INSERT OR REPLACE INTO organizations (
            id, type, name, party_id, organization_name, canonical_name,
            organization_type, industry, website_url, employee_count,
            annual_revenue_usd, year_founded, stock_symbol, is_publicly_traded,
            parent_organization_id, headquarters_country, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_org,
          record.organization_name, record.canonical_name || null,
          record.organization_type || null, record.industry || null,
          record.website_url || null, record.employee_count || null,
          record.annual_revenue_usd || null, record.year_founded || null,
          record.stock_symbol || null, record.is_publicly_traded ? 1 : 0,
          parentOrgId || null, record.headquarters_country || null,
          record.created_at, record.updated_at
        )
        break

      case 'household':
        const partyId_hh = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO households (
            id, type, name, party_id, household_name, primary_address_id,
            household_size, household_income_range, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_hh,
          record.household_name, record.primary_address_id || null,
          record.household_size || null, record.household_income_range || null,
          record.created_at, record.updated_at
        )
        break

      case 'party-identification':
        const partyId_pid = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO party_identifications (
            id, type, name, party_id, identification_number,
            party_identification_type, confidence_score, match_method,
            source_url, discovered_date, last_verified_date,
            is_verified, is_primary, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_pid,
          record.identification_number, record.party_identification_type,
          record.confidence_score || null, record.match_method || null,
          record.source_url || null, record.discovered_date || null,
          record.last_verified_date || null, record.is_verified ? 1 : 0,
          record.is_primary ? 1 : 0, record.created_at, record.updated_at
        )
        break

      case 'account-contact-relationship':
        const accountId_acr = this.extractId(record.account_id, 'acc_')
        const contactId_acr = this.extractId(record.contact_id, 'con_')
        const supervisorId_acr = record.supervisor_contact_id ? this.extractId(record.supervisor_contact_id, 'con_') : null

        this.db.prepare(`
          INSERT OR REPLACE INTO account_contact_relationships (
            id, type, account_id, contact_id, role,
            start_date, end_date, is_primary, is_active, is_direct,
            supervisor_contact_id, department, title,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, accountId_acr, contactId_acr, record.role || null,
          record.start_date || null, record.end_date || null,
          record.is_primary ? 1 : 0, record.is_active ? 1 : 0, record.is_direct ? 1 : 0,
          supervisorId_acr, record.department || null, record.title || null,
          record.created_at, record.updated_at
        )
        break

      case 'contact-point-email':
        const partyId_cpe = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO contact_point_emails (
            id, type, name, party_id, email_address, email_type,
            is_primary, is_verified, opt_in_status, bounce_status,
            last_verified_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_cpe,
          record.email_address, record.email_type || null,
          record.is_primary ? 1 : 0, record.is_verified ? 1 : 0,
          record.opt_in_status || null, record.bounce_status || null,
          record.last_verified_date || null, record.created_at, record.updated_at
        )
        break

      case 'contact-point-phone':
        const partyId_cpp = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO contact_point_phones (
            id, type, name, party_id, phone_number, phone_type,
            is_primary, is_verified, sms_opt_in, last_verified_date,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_cpp,
          record.phone_number, record.phone_type || null,
          record.is_primary ? 1 : 0, record.is_verified ? 1 : 0,
          record.sms_opt_in ? 1 : 0, record.last_verified_date || null,
          record.created_at, record.updated_at
        )
        break

      case 'contact-point-address':
        const partyId_cpa = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO contact_point_addresses (
            id, type, name, party_id, address_type, street_address,
            city, state_province, postal_code, country, is_primary,
            is_verified, latitude, longitude, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, record.name, partyId_cpa,
          record.address_type || null, record.street_address || null,
          record.city || null, record.state_province || null,
          record.postal_code || null, record.country || null,
          record.is_primary ? 1 : 0, record.is_verified ? 1 : 0,
          record.latitude || null, record.longitude || null,
          record.created_at, record.updated_at
        )
        break

      // Research Intelligence entities (Phase 3)
      case 'researcher-profile':
      case 'ResearcherProfile':
        // Extract foreign keys from wikilinks
        const individualId_rp = this.extractId(record.individual_id, 'ind_')
        const partyId_rp = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO researcher_profiles (
            id, type, individual_id, party_id, orcid_id, google_scholar_id, pubmed_author_id,
            research_gate_profile, linkedin_url, current_position, current_institution,
            current_department, position_start_date, previous_institution, primary_research_area,
            secondary_research_areas, techniques_used, organisms_studied, therapeutic_areas,
            h_index, total_citations, publications_count, first_author_papers, last_author_papers,
            recent_high_impact_papers, active_grants, total_funding_usd, funding_sources,
            funding_end_date, has_own_lab, lab_size, lab_budget_usd, equipment_budget_usd,
            recruits_postdocs, recruits_grad_students, tech_stack, recent_equipment_purchases,
            attended_conferences, conference_role, first_discovered, discovery_source,
            last_enriched, enrichment_sources, lead_score, lead_temperature, next_review_date,
            subscribed_to_newsletter, attended_webinars, downloaded_resources,
            opened_emails_count, clicked_emails_count, last_engagement_date,
            created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, individualId_rp, partyId_rp,
          record.orcid_id || null, record.google_scholar_id || null, record.pubmed_author_id || null,
          record.research_gate_profile || null, record.linkedin_url || null,
          record.current_position || null, record.current_institution || null,
          record.current_department || null, record.position_start_date || null,
          record.previous_institution || null, record.primary_research_area || null,
          JSON.stringify(record.secondary_research_areas || []),
          JSON.stringify(record.techniques_used || []),
          JSON.stringify(record.organisms_studied || []),
          JSON.stringify(record.therapeutic_areas || []),
          record.h_index || null, record.total_citations || null,
          record.publications_count || null, record.first_author_papers || null,
          record.last_author_papers || null, record.recent_high_impact_papers || null,
          JSON.stringify(record.active_grants || []),
          record.total_funding_usd || null,
          JSON.stringify(record.funding_sources || []),
          record.funding_end_date || null,
          record.has_own_lab ? 1 : 0, record.lab_size || null,
          record.lab_budget_usd || null, record.equipment_budget_usd || null,
          record.recruits_postdocs ? 1 : 0, record.recruits_grad_students ? 1 : 0,
          JSON.stringify(record.tech_stack || []),
          JSON.stringify(record.recent_equipment_purchases || []),
          JSON.stringify(record.attended_conferences || []),
          record.conference_role || null, record.first_discovered || null,
          record.discovery_source || null, record.last_enriched || null,
          JSON.stringify(record.enrichment_sources || []),
          record.lead_score || null, record.lead_temperature || null,
          record.next_review_date || null, record.subscribed_to_newsletter ? 1 : 0,
          JSON.stringify(record.attended_webinars || []),
          JSON.stringify(record.downloaded_resources || []),
          record.opened_emails_count || 0, record.clicked_emails_count || 0,
          record.last_engagement_date || null,
          record.created_at, record.updated_at,
          record.created_by || null, record.updated_by || null
        )
        break

      case 'organization-profile':
      case 'OrganizationProfile':
        const organizationId_op = this.extractId(record.organization_id, 'org_')
        const partyId_op = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO organization_profiles (
            id, type, organization_id, party_id, institution_type, institution_subtype,
            carnegie_classification, is_r1_institution, total_research_funding_usd,
            nih_funding_rank, has_medical_school, graduate_programs, research_strengths,
            major_research_centers, core_facilities, total_faculty, biotech_faculty,
            labs_in_target_area, key_decision_makers, procurement_model, purchasing_contacts,
            preferred_vendors, fiscal_year_end, budget_cycle, grant_cycles,
            equipment_inventory, software_used, customer_count, prospect_count,
            total_revenue_usd, potential_revenue_usd, last_on_site_visit, next_planned_visit,
            institution_notes, competitive_landscape,
            created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, organizationId_op, partyId_op,
          record.institution_type, record.institution_subtype || null,
          record.carnegie_classification || null, record.is_r1_institution ? 1 : 0,
          record.total_research_funding_usd || null, record.nih_funding_rank || null,
          record.has_medical_school ? 1 : 0,
          JSON.stringify(record.graduate_programs || []),
          JSON.stringify(record.research_strengths || []),
          JSON.stringify(record.major_research_centers || []),
          JSON.stringify(record.core_facilities || []),
          record.total_faculty || null, record.biotech_faculty || null,
          record.labs_in_target_area || null,
          JSON.stringify(record.key_decision_makers || []),
          record.procurement_model || null,
          JSON.stringify(record.purchasing_contacts || []),
          JSON.stringify(record.preferred_vendors || []),
          record.fiscal_year_end || null, record.budget_cycle || null,
          JSON.stringify(record.grant_cycles || []),
          JSON.stringify(record.equipment_inventory || []),
          JSON.stringify(record.software_used || []),
          record.customer_count || 0, record.prospect_count || 0,
          record.total_revenue_usd || 0, record.potential_revenue_usd || 0,
          record.last_on_site_visit || null, record.next_planned_visit || null,
          record.institution_notes || null, record.competitive_landscape || null,
          record.created_at, record.updated_at,
          record.created_by || null, record.updated_by || null
        )
        break

      case 'party-source':
      case 'PartySource':
        const partyId_ps = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO party_sources (
            id, type, party_id, source_type, source_name, source_date, source_url,
            source_file, source_confidence, source_notes, import_batch_id, import_date,
            imported_by, import_method, enrichment_attempts, last_enrichment_date,
            enrichment_sources, enrichment_success_rate, fields_enriched, fields_failed,
            data_quality_score, needs_review, review_reason,
            created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, partyId_ps,
          record.source_type, record.source_name, record.source_date,
          record.source_url || null, record.source_file || null,
          record.source_confidence || null, record.source_notes || null,
          record.import_batch_id || null, record.import_date || null,
          record.imported_by || null, record.import_method || null,
          record.enrichment_attempts || 0, record.last_enrichment_date || null,
          JSON.stringify(record.enrichment_sources || []),
          record.enrichment_success_rate || null,
          JSON.stringify(record.fields_enriched || []),
          JSON.stringify(record.fields_failed || []),
          record.data_quality_score || null, record.needs_review ? 1 : 0,
          record.review_reason || null,
          record.created_at, record.updated_at,
          record.created_by || null, record.updated_by || null
        )
        break

      case 'party-engagement':
      case 'PartyEngagement':
        const partyId_pe = this.extractId(record.party_id, 'pty_')

        this.db.prepare(`
          INSERT OR REPLACE INTO party_engagements (
            id, type, party_id, lead_score, lead_temperature, last_score_update,
            score_trend, has_funding, funding_amount_usd, is_pi, is_decision_maker,
            uses_relevant_tech, attended_event, opened_emails, visited_website,
            downloaded_resources, first_contact_date, last_contact_date, total_touchpoints,
            email_opens, email_clicks, webinar_attendances, conference_meetings,
            phone_calls, demos_attended, recommended_action, next_action_date,
            assigned_to, pipeline_stage, estimated_close_date, estimated_deal_size_usd,
            win_probability, lost_reason, engagement_notes,
            created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id, record.type, partyId_pe,
          record.lead_score || null, record.lead_temperature || null,
          record.last_score_update || null, record.score_trend || null,
          record.has_funding ? 1 : 0, record.funding_amount_usd || null,
          record.is_pi ? 1 : 0, record.is_decision_maker ? 1 : 0,
          record.uses_relevant_tech ? 1 : 0, record.attended_event ? 1 : 0,
          record.opened_emails || 0, record.visited_website ? 1 : 0,
          record.downloaded_resources ? 1 : 0,
          record.first_contact_date || null, record.last_contact_date || null,
          record.total_touchpoints || 0, record.email_opens || 0,
          record.email_clicks || 0, record.webinar_attendances || 0,
          record.conference_meetings || 0, record.phone_calls || 0,
          record.demos_attended || 0, record.recommended_action || null,
          record.next_action_date || null, record.assigned_to || null,
          record.pipeline_stage || null, record.estimated_close_date || null,
          record.estimated_deal_size_usd || null, record.win_probability || null,
          record.lost_reason || null, record.engagement_notes || null,
          record.created_at, record.updated_at,
          record.created_by || null, record.updated_by || null
        )
        break
    }
  }

  /**
   * Apply an update event
   */
  private applyUpdate(event: any): void {
    const { entity_id, changes } = event
    const table = this.getTableFromId(entity_id)

    if (!table) {
      throw new Error(`Cannot determine table for ID: ${entity_id}`)
    }

    const now = new Date().toISOString()

    // Build dynamic UPDATE query
    const fields = Object.keys(changes).filter((k) => k !== 'id' && k !== 'type')
    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => changes[f])

    if (fields.length === 0) {
      return // Nothing to update
    }

    this.db
      .prepare(
        `
      UPDATE ${table}
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `
      )
      .run(...values, now, entity_id)
  }

  /**
   * Apply a delete event
   */
  private applyDelete(event: any): void {
    const { entity_id } = event
    const table = this.getTableFromId(entity_id)

    if (!table) {
      throw new Error(`Cannot determine table for ID: ${entity_id}`)
    }

    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(entity_id)
  }

  /**
   * Get table name from entity ID prefix
   */
  private getTableFromId(id: string): string | null {
    const prefix = id.substring(0, 4)

    const tableMap: Record<string, string> = {
      acc_: 'accounts',
      con_: 'contacts',
      opp_: 'opportunities',
      led_: 'leads',
      act_: 'activities',
      tsk_: 'tasks',
      quo_: 'quotes',
      prd_: 'products',
      cmp_: 'campaigns',
      evt_: 'calendar_events',
      ord_: 'orders',
      ctr_: 'contracts',
      ast_: 'assets',
      cas_: 'cases',
      kav_: 'knowledge',
      vis_: 'visitor_sessions',
      cht_: 'contact_chat_messages',
      ims_: 'imessage_log',
      // Party Model (Phase 3.C - Identity Resolution)
      pty_: 'parties',
      ind_: 'individuals',
      org_: 'organizations',
      hsh_: 'households',
      pid_: 'party_identifications',
      acr_: 'account_contact_relationships',
      cpe_: 'contact_point_emails',
      cpp_: 'contact_point_phones',
      cpa_: 'contact_point_addresses',
      rpr_: 'researcher_profiles',
      opr_: 'organization_profiles',
      pso_: 'party_sources',
      pen_: 'party_engagements',
    }

    return tableMap[prefix] || null
  }

  /**
   * Get table name from ID prefix (for looking up IDs from slugs)
   */
  private getTableFromPrefix(prefix: string): string | null {
    const prefixMap: Record<string, string> = {
      'acc_': 'accounts',
      'con_': 'contacts',
      'opp_': 'opportunities',
      'led_': 'leads',
      'act_': 'activities',
      'tsk_': 'tasks',
      'quo_': 'quotes',
      'prd_': 'products',
      'cmp_': 'campaigns',
      'evt_': 'calendar_events',
      'ord_': 'orders',
      'ctr_': 'contracts',
      'ast_': 'assets',
      'cas_': 'cases',
      'kav_': 'knowledge',
      'pty_': 'parties',
      'ind_': 'individuals',
      'org_': 'organizations',
      'hsh_': 'households',
    }
    return prefixMap[prefix] || null
  }

  /**
   * Extract account ID from wikilink [[accounts/slug]]
   */
  private extractAccountId(link: string | undefined): string | null {
    if (!link) return null

    const match = link.match(/\[\[accounts\/([^\]]+)\]\]/)
    if (!match) return null

    const slug = match[1]

    // Look up account by slug approximation
    // Handle multiple character replacements: spaces and dots to hyphens
    const result: any = this.db
      .prepare(
        `
      SELECT id FROM accounts
      WHERE lower(replace(replace(name, ' ', '-'), '.', '-')) = lower(?)
      LIMIT 1
    `
      )
      .get(slug)

    return result?.id || null
  }

  /**
   * Extract opportunity ID from wikilink [[opportunities/slug]]
   */
  private extractOpportunityId(link: string | undefined): string | null {
    if (!link) return null

    const match = link.match(/\[\[opportunities\/([^\]]+)\]\]/)
    if (!match) return null

    const slug = match[1]

    const result: any = this.db
      .prepare(
        `
      SELECT id FROM opportunities
      WHERE lower(replace(name, ' ', '-')) = lower(?)
      LIMIT 1
    `
      )
      .get(slug)

    return result?.id || null
  }

  /**
   * Extract product ID from wikilink [[products/slug]]
   */
  private extractProductId(link: string | undefined): string | null {
    if (!link) return null

    const match = link.match(/\[\[products\/([^\]]+)\]\]/)
    if (!match) return null

    const slug = match[1]

    const result: any = this.db
      .prepare(
        `
      SELECT id FROM products
      WHERE lower(replace(name, ' ', '-')) = lower(?)
      LIMIT 1
    `
      )
      .get(slug)

    return result?.id || null
  }

  /**
   * Generic helper to extract ID from wikilink or return the raw value if it starts with the prefix
   * Used for Party Model and Research Intelligence entities
   */
  private extractId(value: string | undefined, expectedPrefix: string): string | null {
    if (!value) return null

    // If it already looks like an ID with the right prefix, return it
    if (value.startsWith(expectedPrefix)) {
      return value
    }

    // If it's a wikilink, extract the entity type and slug/id
    // Format: [[entity-type/id]] or [[entity-type/slug]]
    const wikilinkMatch = value.match(/\[\[([^\]]+)\/([^\]]+)\]\]/)
    if (wikilinkMatch) {
      const entityType = wikilinkMatch[1]
      const extracted = wikilinkMatch[2]

      // If extracted value is already an ID, return it
      if (extracted.startsWith(expectedPrefix)) {
        return extracted
      }

      // Otherwise it's a slug - look up the ID in the database by matching slugified names
      const tableName = this.getTableFromPrefix(expectedPrefix)
      if (tableName) {
        try {
          // Get all records and find one where the slugified name matches
          const results = this.db.prepare(`SELECT id, name FROM ${tableName}`).all()
          for (const row of results) {
            if (typeof row === 'object' && row && 'name' in row) {
              // Slugify the name and compare
              const slugifiedName = this.slugifyName(String(row.name))
              if (slugifiedName === extracted) {
                return String((row as any).id)
              }
            }
          }
        } catch (err) {
          // If table doesn't exist or query fails, continue to fallback
        }
      }

      // Fallback: return slug and hope it matches
      return extracted
    }

    // Return as-is if we can't parse it
    return value
  }

  /**
   * Convert a name to slug format (kebab-case, lowercase)
   */
  private slugifyName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Replace multiple hyphens with single
  }

  /**
   * Insert a new visitor session
   */
  insertVisitorSession(data: any): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO visitor_sessions (
          id, socket_id, phone, email, name, company, message,
          connected_at, last_activity, disconnected_at,
          page_url, referrer, user_agent, ip_address,
          location_city, location_region, location_country,
          status, imessage_sent, imessage_sent_at,
          admin_engaged, admin_user_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        data.id,
        data.socket_id,
        data.phone || null,
        data.email || null,
        data.name || null,
        data.company || null,
        data.message || null,
        data.connected_at || now,
        data.last_activity || now,
        data.disconnected_at || null,
        data.page_url,
        data.referrer || null,
        data.user_agent || null,
        data.ip_address || null,
        data.location_city || null,
        data.location_region || null,
        data.location_country || null,
        data.status || 'active',
        data.imessage_sent ? 1 : 0,
        data.imessage_sent_at || null,
        data.admin_engaged ? 1 : 0,
        data.admin_user_id || null,
        data.created_at || now,
        data.updated_at || now
      )
  }

  /**
   * Update a visitor session
   */
  updateVisitorSession(id: string, changes: any): void {
    const now = new Date().toISOString()

    // Build dynamic UPDATE query
    const fields = Object.keys(changes).filter((k) => k !== 'id')
    if (fields.length === 0) {
      return // Nothing to update
    }

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => {
      // Handle boolean fields
      if (f === 'imessage_sent' || f === 'admin_engaged') {
        return changes[f] ? 1 : 0
      }
      return changes[f]
    })

    this.db
      .prepare(
        `
        UPDATE visitor_sessions
        SET ${setClause}, updated_at = ?
        WHERE id = ?
      `
      )
      .run(...values, now, id)
  }

  /**
   * Get all active visitor sessions
   */
  getActiveVisitors(): any[] {
    return this.db
      .prepare(
        `
        SELECT * FROM visitor_sessions
        WHERE status = 'active'
        ORDER BY connected_at DESC
      `
      )
      .all()
  }

  /**
   * Get visitor session by ID
   */
  getVisitorSession(id: string): any {
    return this.db
      .prepare(
        `
        SELECT * FROM visitor_sessions
        WHERE id = ?
      `
      )
      .get(id)
  }

  /**
   * Get visitor session by socket ID
   */
  getVisitorSessionBySocket(socketId: string): any {
    return this.db
      .prepare(
        `
        SELECT * FROM visitor_sessions
        WHERE socket_id = ?
      `
      )
      .get(socketId)
  }

  /**
   * Get all visitor sessions (including offline/disconnected)
   * @param limit - Maximum number of sessions to return (default: 100)
   * @param days - Only return sessions from the last N days (default: 7)
   */
  getAllVisitorSessions(limit: number = 100, days: number = 7): any[] {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString()

    return this.db
      .prepare(
        `
        SELECT * FROM visitor_sessions
        WHERE connected_at >= ?
        ORDER BY connected_at DESC
        LIMIT ?
      `
      )
      .all(cutoffISO, limit)
  }

  /**
   * Insert a chat message
   */
  insertChatMessage(data: any): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO contact_chat_messages (
          id, session_id, author, author_name, text, timestamp, channel, read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        data.id,
        data.session_id,
        data.author,
        data.author_name,
        data.text,
        data.timestamp || now,
        data.channel || 'web',
        data.read ? 1 : 0,
        data.created_at || now
      )
  }

  /**
   * Get chat messages for a session
   */
  getChatMessages(sessionId: string): any[] {
    return this.db
      .prepare(
        `
        SELECT * FROM contact_chat_messages
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `
      )
      .all(sessionId)
  }

  /**
   * Insert an iMessage log entry
   */
  insertIMessageLog(data: any): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO imessage_log (
          id, session_id, phone, message, template_id, sent_at,
          delivery_status, delivery_updated_at, imcp_response, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        data.id,
        data.session_id,
        data.phone,
        data.message,
        data.template_id || null,
        data.sent_at || now,
        data.delivery_status || 'sent',
        data.delivery_updated_at || null,
        data.imcp_response || null,
        data.error_message || null,
        data.created_at || now
      )
  }

  // ============ OAuth Token Methods ============

  /**
   * Get OAuth token for a provider
   */
  getOAuthToken(provider: string): any {
    return this.db
      .prepare(`SELECT * FROM oauth_tokens WHERE provider = ?`)
      .get(provider)
  }

  /**
   * Save or update OAuth token
   */
  saveOAuthToken(
    provider: string,
    tokens: {
      access_token: string
      refresh_token?: string
      expiry_date?: number
      token_type?: string
      scope?: string
    },
    userEmail?: string
  ): void {
    const now = new Date().toISOString()
    const id = `oat_${provider}`

    this.db
      .prepare(
        `
        INSERT INTO oauth_tokens (
          id, provider, user_email, access_token, refresh_token,
          expiry_date, token_type, scope, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
          user_email = excluded.user_email,
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
          expiry_date = excluded.expiry_date,
          token_type = excluded.token_type,
          scope = excluded.scope,
          updated_at = excluded.updated_at
      `
      )
      .run(
        id,
        provider,
        userEmail || null,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || null,
        tokens.token_type || null,
        tokens.scope || null,
        now,
        now
      )
  }

  /**
   * Delete OAuth token
   */
  deleteOAuthToken(provider: string): void {
    this.db.prepare(`DELETE FROM oauth_tokens WHERE provider = ?`).run(provider)
  }

  // ============ Email Template Methods ============

  /**
   * Get all email templates
   */
  getEmailTemplates(status?: string): any[] {
    if (status) {
      return this.db
        .prepare(`SELECT * FROM email_templates WHERE status = ? ORDER BY name`)
        .all(status)
    }
    return this.db
      .prepare(`SELECT * FROM email_templates ORDER BY name`)
      .all()
  }

  /**
   * Get email template by ID
   */
  getEmailTemplate(id: string): any {
    return this.db
      .prepare(`SELECT * FROM email_templates WHERE id = ?`)
      .get(id)
  }

  // ============ Email Draft Methods ============

  /**
   * Get all email drafts
   */
  getEmailDrafts(status?: string): any[] {
    if (status) {
      return this.db
        .prepare(`SELECT * FROM email_drafts WHERE status = ? ORDER BY created_at DESC`)
        .all(status)
    }
    return this.db
      .prepare(`SELECT * FROM email_drafts ORDER BY created_at DESC`)
      .all()
  }

  /**
   * Get email draft by ID
   */
  getEmailDraft(id: string): any {
    return this.db
      .prepare(`SELECT * FROM email_drafts WHERE id = ?`)
      .get(id)
  }

  /**
   * Get email drafts by contact ID
   */
  getEmailDraftsByContact(contactId: string): any[] {
    return this.db
      .prepare(`SELECT * FROM email_drafts WHERE contact_id = ? ORDER BY created_at DESC`)
      .all(contactId)
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close()
  }

  /**
   * Get the underlying database instance
   */
  getDb(): Database.Database {
    return this.db
  }
}

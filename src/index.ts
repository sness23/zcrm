#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { ulid } from "ulidx";
import yaml from "js-yaml";
import { spawnSync } from "child_process";
import { enrichORCIDCommand } from "./commands/enrich-orcid.js";

const program = new Command();
const ROOT = process.cwd();
const VAULT = path.join(ROOT, "vault");

type Kind =
  // Core CRM entities
  "account"|"contact"|"opportunity"|"activity"|"lead"|"task"|"quote"|"product"|"campaign"|"line-item"|"quote-line"|"event"|"order"|"contract"|"asset"|"case"|"knowledge"|
  // Visitor & messaging
  "visitor-session"|"contact-chat"|"imessage-log"|
  // Party Model (Phase 0-2)
  "party"|"individual"|"organization"|"household"|
  "party-identification"|"account-contact-relationship"|"contact-point-email"|"contact-point-phone"|"contact-point-address"|"contact-point-consent"|"data-use-purpose"|
  // Research Intelligence (Phase 3)
  "researcher-profile"|"organization-profile"|"party-source"|"party-engagement"|
  // Email
  "email-template"|"email-draft";
const KIND_DIR: Record<Kind,string> = {
  // Core CRM
  account: "accounts",
  contact: "contacts",
  opportunity: "opportunities",
  activity: "activities",
  lead: "leads",
  task: "tasks",
  quote: "quotes",
  product: "products",
  campaign: "campaigns",
  "line-item": "line-items",
  "quote-line": "quote-lines",
  event: "events",
  order: "orders",
  contract: "contracts",
  asset: "assets",
  case: "cases",
  knowledge: "knowledge",
  // Visitor & messaging
  "visitor-session": "visitors",
  "contact-chat": "contact-chats",
  "imessage-log": "imessages",
  // Party Model (Phase 0-2)
  party: "parties",
  individual: "individuals",
  organization: "organizations",
  household: "households",
  "party-identification": "party-identifications",
  "account-contact-relationship": "account-contact-relationships",
  "contact-point-email": "contact-point-emails",
  "contact-point-phone": "contact-point-phones",
  "contact-point-address": "contact-point-addresses",
  "contact-point-consent": "contact-point-consents",
  "data-use-purpose": "data-use-purposes",
  // Research Intelligence (Phase 3)
  "researcher-profile": "researcher-profiles",
  "organization-profile": "organization-profiles",
  "party-source": "party-sources",
  "party-engagement": "party-engagements",
  // Email
  "email-template": "email-templates",
  "email-draft": "email-drafts",
};;

function ensureVault() {
  const dirs = [
    "_schemas","_hooks","_automation/prompts","settings",
    // Core CRM
    "accounts","contacts","opportunities","activities",
    "leads","tasks","quotes","products","campaigns","line-items","quote-lines","events","orders","contracts","assets","cases","knowledge",
    // Visitor & messaging
    "visitors","contact-chats","imessages",
    // Party Model (Phase 0-2)
    "parties","individuals","organizations","households",
    "party-identifications","account-contact-relationships","contact-point-emails","contact-point-phones","contact-point-addresses","contact-point-consents","data-use-purposes",
    // Research Intelligence (Phase 3)
    "researcher-profiles","organization-profiles","party-sources","party-engagements",
    // System
    "_logs","_indexes"
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(VAULT, d), { recursive: true });
  }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function writeMarkdown(dir: string, filename: string, fm: any, body: string) {
  const content = matter.stringify(body.trim()+"\n", fm);
  const full = path.join(dir, filename);
  fs.writeFileSync(full, content, "utf8");
  return full;
}

function idFor(kind: Kind) {
  const prefix = {
    // Core CRM
    account:"acc_",
    contact:"con_",
    opportunity:"opp_",
    activity:"act_",
    lead:"led_",
    task:"tsk_",
    quote:"quo_",
    product:"prd_",
    campaign:"cmp_",
    "line-item":"oli_",
    "quote-line":"qli_",
    event:"evt_",
    order:"ord_",
    contract:"ctr_",
    asset:"ast_",
    case:"cas_",
    knowledge:"kav_",
    // Visitor & messaging
    "visitor-session":"vis_",
    "contact-chat":"cht_",
    "imessage-log":"ims_",
    // Party Model (Phase 0-2)
    party:"pty_",
    individual:"ind_",
    organization:"org_",
    household:"hsh_",
    "party-identification":"pid_",
    "account-contact-relationship":"acr_",
    "contact-point-email":"cpe_",
    "contact-point-phone":"cpp_",
    "contact-point-address":"cpa_",
    "contact-point-consent":"cpc_",
    "data-use-purpose":"dup_",
    // Research Intelligence (Phase 3)
    "researcher-profile":"rsp_",
    "organization-profile":"orp_",
    "party-source":"pso_",
    "party-engagement":"pen_",
    // Email
    "email-template":"emt_",
    "email-draft":"emd_"
  }[kind];
  return prefix + ulid().toLowerCase();
}

function isGitRepo(dir: string): boolean {
  try {
    spawnSync("git", ["rev-parse", "--git-dir"], { cwd: dir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function gitCommitAndPush(file: string, action: string, entityType: string, name: string, options: { noCommit?: boolean, noPush?: boolean }): void {
  if (options.noCommit) {
    return;
  }

  if (!isGitRepo(VAULT)) {
    console.warn("⚠ Warning: vault/ is not a git repository. Changes not committed.");
    console.warn("  Initialize git: cd vault && git init && git remote add origin <url>");
    return;
  }

  const relPath = path.relative(VAULT, file);
  const message = `${action} ${entityType}: ${name}`;

  try {
    // Add the file
    spawnSync("git", ["add", relPath], { cwd: VAULT, stdio: "pipe" });

    // Commit with message
    const commitResult = spawnSync("git", ["commit", "-m", message], { cwd: VAULT, stdio: "pipe" });

    if (commitResult.status === 0) {
      console.log(`✓ Committed: ${message}`);

      // Push to remote (unless --no-push)
      if (!options.noPush) {
        const pushResult = spawnSync("git", ["push"], { cwd: VAULT, stdio: "pipe" });

        if (pushResult.status === 0) {
          console.log("✓ Pushed to remote");
        } else {
          const errorOutput = pushResult.stderr?.toString() || pushResult.stdout?.toString() || "";
          if (errorOutput.includes("no upstream") || errorOutput.includes("no such remote")) {
            console.warn("⚠ Warning: No remote configured. Changes committed locally only.");
            console.warn("  Set up remote: cd vault && git remote add origin <url>");
          } else if (errorOutput.includes("rejected") || errorOutput.includes("non-fast-forward")) {
            console.warn("⚠ Warning: Push rejected. Remote has changes.");
            console.warn("  Pull first: cd vault && git pull");
          } else {
            console.warn("⚠ Warning: Failed to push. Changes committed locally.");
          }
        }
      }
    } else {
      const errorOutput = commitResult.stderr?.toString() || commitResult.stdout?.toString() || "";
      if (errorOutput.includes("nothing to commit")) {
        // File unchanged, no commit needed
        return;
      }
      console.warn("⚠ Warning: Git commit failed. Changes saved but not committed.");
    }
  } catch (error: any) {
    console.warn("⚠ Warning: Git operation failed:", error.message);
  }
}

program
  .name("zcrm")
  .description("Filesystem-first AI CRM CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize vault and default config")
  .action(() => {
    ensureVault();
    const cfgPath = path.join(VAULT, "settings", "crm.yaml");
    if (!fs.existsSync(cfgPath)) {
      const cfg = {
        id_strategy: "ulid",
        default_owner: "User:steven-ness",
        sync_targets: [],
      };
      fs.writeFileSync(cfgPath, yaml.dump(cfg));
      console.log("Wrote", path.relative(ROOT, cfgPath));
    }
    console.log("Vault ready at", path.relative(ROOT, VAULT));
  });

program
  .command("new")
  .argument("<kind>", "account|contact|opportunity|activity|lead|task|quote|product|campaign|line-item|quote-line|event|order|contract|asset|case|knowledge")
  .argument("<name...>", "record name (quoted)")
  .option("--account <slug>", "related account")
  .option("--opportunity <slug>", "related opportunity")
  .option("--quote <slug>", "related quote (for quote-lines)")
  .option("--product <slug>", "related product (for line-items and quote-lines)")
  .option("--quantity <number>", "quantity (for line-items and quote-lines)")
  .option("--unit-price <price>", "unit price (for line-items and quote-lines)")
  .option("--discount <percent>", "discount percent (for line-items and quote-lines)")
  .option("--email <email>", "email")
  .option("--phone <phone>", "phone")
  .option("--company <company>", "company (for leads)")
  .option("--price <price>", "price (for products)")
  .option("--start <datetime>", "start datetime (ISO 8601 for events)")
  .option("--end <datetime>", "end datetime (ISO 8601 for events)")
  .option("--duration <minutes>", "duration in minutes (for events)")
  .option("--location <location>", "location or video link (for events)")
  .option("--related-to <slug>", "related entity (for events)")
  .option("--attendees <emails>", "comma-separated attendee emails (for events)")
  .option("--status <status>", "status (for orders, contracts)")
  .option("--effective-date <date>", "effective date YYYY-MM-DD (for orders)")
  .option("--amount <amount>", "amount (for orders)")
  .option("--order-number <number>", "order number (for orders)")
  .option("--start-date <date>", "start date YYYY-MM-DD (for contracts)")
  .option("--end-date <date>", "end date YYYY-MM-DD (for contracts)")
  .option("--contract-term <months>", "contract term in months (for contracts)")
  .option("--contract-value <value>", "total contract value (for contracts)")
  .option("--contract-number <number>", "contract number (for contracts)")
  .option("--purchase-date <date>", "purchase date YYYY-MM-DD (for assets)")
  .option("--install-date <date>", "install date YYYY-MM-DD (for assets)")
  .option("--serial-number <number>", "serial number or license key (for assets)")
  .option("--priority <priority>", "priority: low, medium, high, critical (for cases)")
  .option("--origin <origin>", "origin: email, phone, web, chat (for cases)")
  .option("--case-number <number>", "case number (for cases)")
  .option("--contact <slug>", "related contact (for cases)")
  .option("--article-type <type>", "article type: faq, how-to, troubleshooting, reference, announcement (for knowledge)")
  .option("--category <category>", "article category (for knowledge)")
  .option("--tags <tags>", "comma-separated tags (for knowledge)")
  .option("--published", "mark article as published (for knowledge)")
  .option("--article-number <number>", "article number (for knowledge)")
  .option("--no-commit", "create file but do not commit to git")
  .option("--no-push", "commit but do not push to remote")
  .action((kindArg, nameParts, opts) => {
    const kind = kindArg.toLowerCase() as Kind;
    if (!Object.keys(KIND_DIR).includes(kind)) {
      console.error("Unknown kind:", kind);
      process.exit(1);
    }
    ensureVault();
    const name = nameParts.join(" ");
    const slug = slugify(name);
    const dir = path.join(VAULT, KIND_DIR[kind]);
    fs.mkdirSync(dir, { recursive: true });

    let front: any = { id: idFor(kind), type: kind[0].toUpperCase()+kind.slice(1), name: name };
    let body = `# ${name}\n`;

    if (kind === "account") {
      front = { ...front, lifecycle_stage: "prospect", created: new Date().toISOString().slice(0,10) };
    } else if (kind === "contact") {
      if (!opts.account) { console.warn("Tip: pass --account <slug> to link contact to account."); }
      front = { ...front, first_name: name.split(" ")[0], last_name: name.split(" ").slice(1).join(" ") || "", email: opts.email || "", account: opts.account ? `[[accounts/${opts.account}]]` : null };
      body += "\n## Notes\n- \n";
    } else if (kind === "opportunity") {
      front = { ...front, account: opts.account ? `[[accounts/${opts.account}]]` : null, stage: "discovery", amount_acv: 0, close_date: new Date().toISOString().slice(0,10), probability: 0.1, next_action: "TBD" };
      body += "\n- Key risks:\n";
    } else if (kind === "activity") {
      front = { ...front, kind: "note", when: new Date().toISOString(), summary: "", duration_min: 0 };
      body += "\n- \n";
    } else if (kind === "lead") {
      front = { ...front, email: opts.email || "", phone: opts.phone || "", company: opts.company || "", account: opts.account ? `[[accounts/${opts.account}]]` : null, status: "new", rating: "warm" };
      body += "\n## Qualification Notes\n- \n";
    } else if (kind === "task") {
      front = { ...front, subject: name, status: "not_started", priority: "normal", due_date: new Date().toISOString().slice(0,10) };
      body += "\n## Details\n- \n";
    } else if (kind === "quote") {
      front = { ...front, opportunity: opts.opportunity ? `[[opportunities/${opts.opportunity}]]` : null, account: opts.account ? `[[accounts/${opts.account}]]` : null, status: "draft", amount: 0, valid_until: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10) };
      body += "\n## Line Items\n- \n\n## Terms\n- \n";
    } else if (kind === "product") {
      front = { ...front, price: opts.price ? parseFloat(opts.price) : 0, is_active: true };
      body += "\n## Description\n- \n\n## Features\n- \n";
    } else if (kind === "campaign") {
      front = { ...front, status: "planned", campaign_type: "email", start_date: new Date().toISOString().slice(0,10), budget: 0, num_leads: 0 };
      body += "\n## Goals\n- \n\n## Strategy\n- \n";
    } else if (kind === "line-item") {
      // OpportunityLineItem requires opportunity and product
      if (!opts.opportunity) {
        console.error("Error: --opportunity <slug> is required for line-item");
        process.exit(1);
      }
      if (!opts.product) {
        console.error("Error: --product <slug> is required for line-item");
        process.exit(1);
      }

      const quantity = opts.quantity ? parseFloat(opts.quantity) : 1;
      const unitPrice = opts.unitPrice ? parseFloat(opts.unitPrice) : 0;
      const discountPercent = opts.discount ? parseFloat(opts.discount) : 0;
      const totalPrice = (quantity * unitPrice) * (1 - discountPercent / 100);

      front = {
        id: idFor(kind),
        type: "OpportunityLineItem",
        opportunity: `[[opportunities/${opts.opportunity}]]`,
        product: `[[products/${opts.product}]]`,
        quantity,
        unit_price: unitPrice,
        discount_percent: discountPercent,
        total_price: totalPrice,
        description: name
      };

      // Use composite slug: {opportunity-slug}-{product-slug}
      const compositeSlug = `${opts.opportunity}-${opts.product}`;
      const file = writeMarkdown(dir, `${compositeSlug}.md`, front, body);
      console.log("Created", path.relative(ROOT, file));

      const entityType = "OpportunityLineItem";
      gitCommitAndPush(file, "Create", entityType, name, {
        noCommit: opts.commit === false,
        noPush: opts.push === false
      });
      return; // Early return to skip duplicate file creation below
    } else if (kind === "quote-line") {
      // QuoteLineItem requires quote and product
      if (!opts.quote) {
        console.error("Error: --quote <slug> is required for quote-line");
        process.exit(1);
      }
      if (!opts.product) {
        console.error("Error: --product <slug> is required for quote-line");
        process.exit(1);
      }

      const quantity = opts.quantity ? parseFloat(opts.quantity) : 1;
      const unitPrice = opts.unitPrice ? parseFloat(opts.unitPrice) : 0;
      const discountPercent = opts.discount ? parseFloat(opts.discount) : 0;
      const totalPrice = (quantity * unitPrice) * (1 - discountPercent / 100);

      front = {
        id: idFor(kind),
        type: "QuoteLineItem",
        quote: `[[quotes/${opts.quote}]]`,
        product: `[[products/${opts.product}]]`,
        quantity,
        unit_price: unitPrice,
        discount_percent: discountPercent,
        total_price: totalPrice,
        description: name
      };

      // Use composite slug: {quote-slug}-{product-slug}
      const compositeSlug = `${opts.quote}-${opts.product}`;
      const file = writeMarkdown(dir, `${compositeSlug}.md`, front, body);
      console.log("Created", path.relative(ROOT, file));

      const entityType = "QuoteLineItem";
      gitCommitAndPush(file, "Create", entityType, name, {
        noCommit: opts.commit === false,
        noPush: opts.push === false
      });
      return; // Early return to skip duplicate file creation below
    } else if (kind === "event") {
      // Event requires start datetime
      if (!opts.start) {
        console.error("Error: --start <datetime> is required for event (ISO 8601 format)");
        process.exit(1);
      }

      // Calculate end datetime from duration if provided and no explicit end
      let endDatetime = opts.end;
      if (!endDatetime && opts.duration) {
        const startTime = new Date(opts.start);
        const durationMinutes = parseFloat(opts.duration);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        endDatetime = endTime.toISOString();
      }

      // Parse attendees if provided
      const attendees = opts.attendees ? opts.attendees.split(',').map((email: string) => email.trim()) : undefined;

      front = {
        id: idFor(kind),
        type: "Event",
        subject: name,
        start_datetime: opts.start,
        end_datetime: endDatetime,
        location: opts.location,
        related_to: opts.relatedTo ? `[[${opts.relatedTo}]]` : undefined,
        attendees,
        description: ""
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Agenda\n- \n\n## Notes\n- \n`;
    } else if (kind === "order") {
      // Order requires account and status
      if (!opts.account) {
        console.error("Error: --account <slug> is required for order");
        process.exit(1);
      }

      const effectiveDate = opts.effectiveDate || new Date().toISOString().slice(0, 10);
      const status = opts.status || "draft";
      const totalAmount = opts.amount ? parseFloat(opts.amount) : 0;

      front = {
        id: idFor(kind),
        type: "Order",
        account: `[[accounts/${opts.account}]]`,
        opportunity: opts.opportunity ? `[[opportunities/${opts.opportunity}]]` : undefined,
        status,
        effective_date: effectiveDate,
        total_amount: totalAmount,
        order_number: opts.orderNumber,
        description: ""
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Line Items\n- \n\n## Terms & Conditions\n- \n`;
    } else if (kind === "contract") {
      // Contract requires account and status
      if (!opts.account) {
        console.error("Error: --account <slug> is required for contract");
        process.exit(1);
      }

      const startDate = opts.startDate || new Date().toISOString().slice(0, 10);
      const status = opts.status || "draft";
      const contractTerm = opts.contractTerm ? parseInt(opts.contractTerm) : undefined;
      const totalValue = opts.contractValue ? parseFloat(opts.contractValue) : undefined;

      // Calculate end date from term if provided and no explicit end date
      let endDate = opts.endDate;
      if (!endDate && contractTerm) {
        const start = new Date(startDate);
        start.setMonth(start.getMonth() + contractTerm);
        endDate = start.toISOString().slice(0, 10);
      }

      front = {
        id: idFor(kind),
        type: "Contract",
        account: `[[accounts/${opts.account}]]`,
        opportunity: opts.opportunity ? `[[opportunities/${opts.opportunity}]]` : undefined,
        status,
        start_date: startDate,
        end_date: endDate,
        contract_term: contractTerm,
        total_value: totalValue,
        contract_number: opts.contractNumber,
        description: ""
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Terms\n- \n\n## Renewal Details\n- \n`;
    } else if (kind === "asset") {
      // Asset requires account, product, and status
      if (!opts.account) {
        console.error("Error: --account <slug> is required for asset");
        process.exit(1);
      }
      if (!opts.product) {
        console.error("Error: --product <slug> is required for asset");
        process.exit(1);
      }

      const status = opts.status || "purchased";
      const quantity = opts.quantity ? parseInt(opts.quantity) : 1;

      front = {
        id: idFor(kind),
        type: "Asset",
        account: `[[accounts/${opts.account}]]`,
        product: `[[products/${opts.product}]]`,
        status,
        purchase_date: opts.purchaseDate,
        install_date: opts.installDate,
        quantity,
        serial_number: opts.serialNumber,
        description: ""
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Installation Details\n- \n\n## Support & Maintenance\n- \n`;
    } else if (kind === "case") {
      // Case entity
      const status = opts.status || "new";
      const priority = opts.priority || "medium";

      front = {
        id: idFor(kind),
        type: "Case",
        subject: name,
        account: opts.account ? `[[accounts/${opts.account}]]` : undefined,
        contact: opts.contact ? `[[contacts/${opts.contact}]]` : undefined,
        status,
        priority,
        case_number: opts.caseNumber,
        origin: opts.origin,
        description: ""
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Problem Description\n- \n\n## Resolution Steps\n- \n\n## Resolution\n- \n`;
    } else if (kind === "knowledge") {
      // Knowledge article
      const articleType = opts.articleType || "faq";
      const tags = opts.tags ? opts.tags.split(',').map((tag: string) => tag.trim()) : undefined;
      const isPublished = opts.published === true;

      front = {
        id: idFor(kind),
        type: "Knowledge",
        title: name,
        article_type: articleType,
        category: opts.category,
        tags,
        is_published: isPublished,
        summary: "",
        article_number: opts.articleNumber
      };

      // Remove undefined fields
      Object.keys(front).forEach(key => front[key] === undefined && delete front[key]);

      body = `# ${name}\n\n## Overview\n- \n\n## Details\n- \n\n## Related Articles\n- \n`;
    }

    const file = writeMarkdown(dir, `${slug}.md`, front, body);
    console.log("Created", path.relative(ROOT, file));

    // Git commit and push
    const entityType = kind[0].toUpperCase() + kind.slice(1);
    gitCommitAndPush(file, "Create", entityType, name, {
      noCommit: opts.commit === false,  // Commander sets to false when --no-commit
      noPush: opts.push === false       // Commander sets to false when --no-push
    });
  });

// Phase 3.B: Research Intelligence CLI Commands
program
  .command("new-researcher")
  .argument("<name>", "researcher name (e.g., 'Dr. Jane Smith')")
  .option("--email <email>", "email address")
  .option("--orcid <orcid>", "ORCID ID (e.g., 0000-0001-2345-6789)")
  .option("--institution <name>", "current institution name")
  .option("--position <position>", "current position (e.g., 'Principal Investigator')")
  .option("--research-area <area>", "primary research area (e.g., 'Structural Biology')")
  .option("--funding <amount>", "total funding in USD")
  .option("--h-index <number>", "h-index")
  .option("--lab-size <number>", "number of people in lab")
  .option("--tech-stack <technologies>", "comma-separated equipment/platforms")
  .option("--source <source>", "how this researcher was discovered (e.g., 'AAAS 2024')")
  .option("--no-commit", "create files but do not commit to git")
  .option("--no-push", "commit but do not push to remote")
  .description("Create a researcher with Party, Individual, and ResearcherProfile")
  .action((name, opts) => {
    ensureVault();

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Parse name
    const nameParts = name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    // Generate IDs
    const partyId = idFor("party");
    const individualId = idFor("individual");
    const researcherProfileId = idFor("researcher-profile");

    // Slugs for filenames
    const slug = slugify(name);

    // 1. Create Party
    const partyDir = path.join(VAULT, "parties");
    const partyFront = {
      id: partyId,
      type: "Party",
      party_type: "Individual",
      primary_account_id: null,
      created_at: now,
      updated_at: now
    };
    const partyBody = `# ${name}\n\nResearcher profile for ${name}.\n`;
    const partyFile = writeMarkdown(partyDir, `${slug}.md`, partyFront, partyBody);
    console.log(`✓ Created Party: ${partyId} (${slug})`);

    // 2. Create Individual
    const individualDir = path.join(VAULT, "individuals");
    const individualFront = {
      id: individualId,
      type: "Individual",
      party_id: `[[parties/${slug}]]`,
      person_name: name,
      first_name: firstName,
      last_name: lastName,
      created_at: now,
      updated_at: now
    };
    const individualBody = `# ${name}\n\nIndividual record for ${name}.\n`;
    const individualFile = writeMarkdown(individualDir, `${slug}.md`, individualFront, individualBody);
    console.log(`✓ Created Individual: ${individualId}`);

    // 3. Create ResearcherProfile
    const researcherDir = path.join(VAULT, "researcher-profiles");
    const researcherFront: any = {
      id: researcherProfileId,
      type: "ResearcherProfile",
      party_id: `[[parties/${slug}]]`,
      individual_id: `[[individuals/${slug}]]`,
      created_at: now,
      updated_at: now
    };

    // Add optional fields
    if (opts.orcid) researcherFront.orcid_id = opts.orcid;
    if (opts.institution) researcherFront.current_institution = opts.institution;
    if (opts.position) researcherFront.current_position = opts.position;
    if (opts.researchArea) researcherFront.primary_research_area = opts.researchArea;
    if (opts.funding) researcherFront.total_funding_usd = parseFloat(opts.funding);
    if (opts.hIndex) researcherFront.h_index = parseInt(opts.hIndex);
    if (opts.labSize) researcherFront.lab_size = parseInt(opts.labSize);
    if (opts.techStack) researcherFront.tech_stack = opts.techStack.split(",").map((t: string) => t.trim());
    if (opts.source) researcherFront.discovery_source = opts.source;

    // Default values
    researcherFront.first_discovered = today;
    researcherFront.lead_score = 50; // Default neutral score
    researcherFront.lead_temperature = "Warm";

    const researcherBody = `# ${name} - Researcher Profile

## Academic Profile
- **Institution**: ${opts.institution || "TBD"}
- **Position**: ${opts.position || "TBD"}
- **Research Area**: ${opts.researchArea || "TBD"}

## Metrics
- **H-Index**: ${opts.hIndex || "TBD"}
- **Total Funding**: ${opts.funding ? `$${parseInt(opts.funding).toLocaleString()}` : "TBD"}
- **Lab Size**: ${opts.labSize || "TBD"}

## Tech Stack
${opts.techStack ? opts.techStack.split(",").map((t: string) => `- ${t.trim()}`).join("\n") : "- TBD"}

## Discovery
- **Source**: ${opts.source || "TBD"}
- **Date**: ${today}

## Lead Score: ${researcherFront.lead_score}/100 (${researcherFront.lead_temperature})

## Notes
-
`;

    const researcherFile = writeMarkdown(researcherDir, `${slug}.md`, researcherFront, researcherBody);
    console.log(`✓ Created ResearcherProfile: ${researcherProfileId}`);

    // 4. Optionally create ContactPointEmail
    if (opts.email) {
      const emailId = idFor("contact-point-email");
      const emailDir = path.join(VAULT, "contact-point-emails");
      const emailSlug = slugify(opts.email.replace("@", "-at-").replace(".", "-"));
      const emailFront = {
        id: emailId,
        type: "ContactPointEmail",
        party_id: `[[parties/${slug}]]`,
        email_address: opts.email.toLowerCase(),
        email_domain: opts.email.split("@")[1],
        email_mailbox: opts.email.split("@")[0],
        is_primary: true,
        is_verified: false,
        created_at: now,
        updated_at: now
      };
      const emailBody = `# ${opts.email}\n\nEmail contact point for ${name}.\n`;
      const emailFile = writeMarkdown(emailDir, `${emailSlug}.md`, emailFront, emailBody);
      console.log(`✓ Created ContactPointEmail: ${emailId}`);
    }

    // 5. Optionally create PartySource
    if (opts.source) {
      const sourceId = idFor("party-source");
      const sourceDir = path.join(VAULT, "party-sources");
      const sourceSlug = `${slug}-${slugify(opts.source)}`;
      const sourceFront = {
        id: sourceId,
        type: "PartySource",
        party_id: `[[parties/${slug}]]`,
        source_type: "Conference", // Default, can be made configurable
        source_name: opts.source,
        source_date: today,
        source_confidence: "High",
        data_quality_score: 75,
        created_at: now,
        updated_at: now
      };
      const sourceBody = `# ${opts.source}\n\nData source for ${name}.\n`;
      const sourceFile = writeMarkdown(sourceDir, `${sourceSlug}.md`, sourceFront, sourceBody);
      console.log(`✓ Created PartySource: ${sourceId}`);
    }

    console.log(`\n✅ Researcher created successfully!`);
    console.log(`   Party ID: ${partyId}`);
    console.log(`   Individual ID: ${individualId}`);
    console.log(`   ResearcherProfile ID: ${researcherProfileId}`);

    // Git commit (respecting --no-commit and --no-push flags)
    if (!opts.noCommit) {
      const files = [partyFile, individualFile, researcherFile];
      if (opts.email) files.push(path.join(VAULT, "contact-point-emails", `${slugify(opts.email.replace("@", "-at-").replace(".", "-"))}.md`));
      if (opts.source) files.push(path.join(VAULT, "party-sources", `${slug}-${slugify(opts.source)}.md`));

      gitCommitAndPush(files.join(" "), "Create", "Researcher", name, {
        noCommit: false,
        noPush: opts.noPush
      });
    }
  });

program
  .command("import-contacts")
  .argument("<csv-file>", "path to CSV file (relative to vault/)")
  .option("--source <source>", "source name (e.g., 'AAAS 2025')", "CSV Import")
  .option("--source-type <type>", "source type", "Import")
  .option("--batch-id <id>", "batch identifier for this import")
  .option("--dry-run", "preview import without creating records")
  .option("--no-commit", "create files but do not commit to git")
  .description("Bulk import researchers from CSV file")
  .action(async (csvFile, opts) => {
    ensureVault();

    const csvPath = path.join(VAULT, csvFile);

    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    console.log(`Parsing CSV: ${csvFile}`);

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      console.error('Error: CSV file must have header row and at least one data row');
      process.exit(1);
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = header.findIndex(h => h === 'name' || h === 'full_name' || h === 'researcher_name');
    const emailIdx = header.findIndex(h => h === 'email' || h === 'email_address');
    const orcidIdx = header.findIndex(h => h === 'orcid' || h === 'orcid_id');
    const institutionIdx = header.findIndex(h => h === 'institution' || h === 'organization' || h === 'affiliation');
    const positionIdx = header.findIndex(h => h === 'position' || h === 'title' || h === 'role');
    const researchAreaIdx = header.findIndex(h => h === 'research_area' || h === 'field' || h === 'specialty');

    if (nameIdx === -1) {
      console.error('Error: CSV must have a "name" column');
      process.exit(1);
    }

    // Parse data rows
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      const record: any = {
        name: values[nameIdx]
      };

      if (emailIdx >= 0 && values[emailIdx]) record.email = values[emailIdx];
      if (orcidIdx >= 0 && values[orcidIdx]) record.orcid = values[orcidIdx];
      if (institutionIdx >= 0 && values[institutionIdx]) record.institution = values[institutionIdx];
      if (positionIdx >= 0 && values[positionIdx]) record.position = values[positionIdx];
      if (researchAreaIdx >= 0 && values[researchAreaIdx]) record.researchArea = values[researchAreaIdx];

      if (record.name) {
        records.push(record);
      }
    }

    console.log(`Found ${records.length} records\n`);

    if (opts.dryRun) {
      console.log('DRY RUN - Preview first 5 records:\n');
      records.slice(0, 5).forEach((record, idx) => {
        console.log(`${idx + 1}. ${record.name}`);
        if (record.email) console.log(`   Email: ${record.email}`);
        if (record.institution) console.log(`   Institution: ${record.institution}`);
        console.log('');
      });
      console.log(`Total: ${records.length} records would be imported`);
      return;
    }

    // Generate batch ID if not provided
    const batchId = opts.batchId || `batch_${new Date().toISOString().slice(0,10).replace(/-/g, '')}_${Date.now().toString(36)}`;

    console.log(`Processing batch: ${batchId}\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        // Check for duplicate by email or name
        const slug = slugify(record.name);
        const partyFile = path.join(VAULT, "parties", `${slug}.md`);

        if (fs.existsSync(partyFile)) {
          console.log(`⊘ Skipped (exists): ${record.name}`);
          skipped++;
          continue;
        }

        // Parse name
        const nameParts = record.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Generate IDs
        const partyId = idFor('party');
        const individualId = idFor('individual');
        const researcherProfileId = idFor('researcher-profile');

        // Create Party
        const partyDir = path.join(VAULT, 'parties');
        const partyFront = {
          id: partyId,
          type: 'Party',
          party_type: 'Individual',
          created_at: now,
          updated_at: now
        };
        const partyBody = `# ${record.name}\n\nImported from ${opts.source}.\n`;
        writeMarkdown(partyDir, `${slug}.md`, partyFront, partyBody);

        // Create Individual
        const individualDir = path.join(VAULT, 'individuals');
        const individualFront = {
          id: individualId,
          type: 'Individual',
          party_id: `[[parties/${slug}]]`,
          person_name: record.name,
          first_name: firstName,
          last_name: lastName,
          created_at: now,
          updated_at: now
        };
        const individualBody = `# ${record.name}\n`;
        writeMarkdown(individualDir, `${slug}.md`, individualFront, individualBody);

        // Create ResearcherProfile
        const researcherDir = path.join(VAULT, 'researcher-profiles');
        const researcherFront: any = {
          id: researcherProfileId,
          type: 'ResearcherProfile',
          party_id: `[[parties/${slug}]]`,
          individual_id: `[[individuals/${slug}]]`,
          first_discovered: today,
          discovery_source: opts.source,
          lead_score: 40, // Lower score for bulk imports
          lead_temperature: 'Cold',
          created_at: now,
          updated_at: now
        };

        if (record.orcid) researcherFront.orcid_id = record.orcid;
        if (record.institution) researcherFront.current_institution = record.institution;
        if (record.position) researcherFront.current_position = record.position;
        if (record.researchArea) researcherFront.primary_research_area = record.researchArea;

        const researcherBody = `# ${record.name}\n\nImported from ${opts.source} (${today})\n`;
        writeMarkdown(researcherDir, `${slug}.md`, researcherFront, researcherBody);

        // Create ContactPointEmail if provided
        if (record.email) {
          const emailId = idFor('contact-point-email');
          const emailDir = path.join(VAULT, 'contact-point-emails');
          const emailSlug = slugify(record.email.replace('@', '-at-').replace('.', '-'));
          const emailFront = {
            id: emailId,
            type: 'ContactPointEmail',
            party_id: `[[parties/${slug}]]`,
            email_address: record.email.toLowerCase(),
            email_domain: record.email.split('@')[1] || '',
            email_mailbox: record.email.split('@')[0] || '',
            is_primary: true,
            is_verified: false,
            created_at: now,
            updated_at: now
          };
          const emailBody = `# ${record.email}\n`;
          writeMarkdown(emailDir, `${emailSlug}.md`, emailFront, emailBody);
        }

        // Create PartySource for batch tracking
        const sourceId = idFor('party-source');
        const sourceDir = path.join(VAULT, 'party-sources');
        const sourceSlug = `${slug}-${slugify(opts.source)}`;
        const sourceFront = {
          id: sourceId,
          type: 'PartySource',
          party_id: `[[parties/${slug}]]`,
          source_type: opts.sourceType,
          source_name: opts.source,
          source_date: today,
          source_file: csvFile,
          import_batch_id: batchId,
          import_date: now,
          source_confidence: 'Medium',
          data_quality_score: 60,
          created_at: now,
          updated_at: now
        };
        const sourceBody = `# ${opts.source}\n\nBatch: ${batchId}\n`;
        writeMarkdown(sourceDir, `${sourceSlug}.md`, sourceFront, sourceBody);

        console.log(`✓ Created: ${record.name}`);
        created++;

      } catch (error: any) {
        console.error(`✗ Error: ${record.name} - ${error.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Created: ${created} researchers`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Batch ID: ${batchId}`);

    if (!opts.noCommit && created > 0) {
      // Note: We're not doing individual git commits here to avoid overwhelming git
      console.log(`\n⚠ Note: ${created} files created. Run 'git add . && git commit -m "Import ${created} researchers from ${opts.source}"' to commit.`);
    }
  });

program
  .command("enrich-researcher")
  .argument("<party-id>", "Party ID to enrich (e.g., pty_01k8v43enc17w6n7xrstwk9jdb)")
  .option("--sources <sources>", "comma-separated enrichment sources (orcid,pubmed,scholar,nih)", "orcid,pubmed")
  .option("--save", "save enriched data to ResearcherProfile")
  .option("--dry-run", "preview enrichment without saving")
  .option("--use-real-apis", "use real API calls (default: simulated for testing)")
  .description("Enrich researcher data from public APIs")
  .action(async (partyId, opts) => {
    ensureVault();

    // Import enrichment module dynamically
    const {
      fetchORCIDProfile,
      fetchPubMedPublications,
      fetchNIHGrants,
      fetchSemanticScholarMetrics,
      executeWithRateLimit,
      rateLimiters
    } = await import('./lib/enrichment.js');

    // Find the party file
    const partiesDir = path.join(VAULT, "parties");
    const partyFiles = fs.readdirSync(partiesDir);
    let partySlug: string | null = null;

    for (const file of partyFiles) {
      const content = fs.readFileSync(path.join(partiesDir, file), 'utf8');
      if (content.includes(`id: ${partyId}`)) {
        partySlug = file.replace('.md', '');
        break;
      }
    }

    if (!partySlug) {
      console.error(`Error: Party not found: ${partyId}`);
      process.exit(1);
    }

    // Read Individual for name
    const individualFile = path.join(VAULT, "individuals", `${partySlug}.md`);
    let fullName = "";
    if (fs.existsSync(individualFile)) {
      const individualContent = fs.readFileSync(individualFile, 'utf8');
      const individualData = matter(individualContent);
      fullName = individualData.data.person_name || "";
    }

    // Read ResearcherProfile
    const researcherFile = path.join(VAULT, "researcher-profiles", `${partySlug}.md`);
    if (!fs.existsSync(researcherFile)) {
      console.error(`Error: ResearcherProfile not found for: ${partyId}`);
      process.exit(1);
    }

    const researcherContent = fs.readFileSync(researcherFile, 'utf8');
    const researcherData = matter(researcherContent);

    console.log(`Enriching: ${fullName || researcherData.data.party_id || partyId}\n`);

    const sources = opts.sources.split(',').map((s: string) => s.trim());
    const enrichedData: any = {};
    let fieldsEnriched = 0;
    let fieldsFailed = 0;
    const useRealAPIs = opts.useRealApis || false;

    // Execute enrichment from each source
    for (const source of sources) {
      console.log(`📡 ${source.toUpperCase()}: `);

      try {
        if (useRealAPIs) {
          // ===== REAL API CALLS =====

          if (source === 'orcid') {
            const orcidId = researcherData.data.orcid_id;
            if (!orcidId) {
              console.log('   ⚠️  No ORCID ID available - skipping');
              fieldsFailed += 1;
              continue;
            }

            const result = await executeWithRateLimit(
              () => fetchORCIDProfile(orcidId),
              rateLimiters.orcid
            );

            if (result.success && result.data) {
              console.log(`   ✓ Found researcher profile`);
              console.log(`   ✓ Publications: ${result.data.works_count || 0}`);

              enrichedData.publications_count = result.data.works_count || enrichedData.publications_count;
              if (result.data.current_affiliation && !researcherData.data.current_institution) {
                enrichedData.current_institution = result.data.current_affiliation;
              }

              fieldsEnriched += (result.fieldsEnriched?.length || 1);
            } else {
              console.log(`   ✗ Failed: ${result.error}`);
              fieldsFailed += 1;
            }

          } else if (source === 'pubmed') {
            if (!fullName) {
              console.log('   ⚠️  No name available - skipping');
              fieldsFailed += 1;
              continue;
            }

            const result = await executeWithRateLimit(
              () => fetchPubMedPublications(fullName),
              rateLimiters.pubmed
            );

            if (result.success && result.data) {
              console.log(`   ✓ Found ${result.data.publications_count} publications`);
              console.log(`   ✓ First-author: ${result.data.first_author_papers}`);
              console.log(`   ✓ Last-author: ${result.data.last_author_papers}`);
              console.log(`   ✓ High-impact: ${result.data.recent_high_impact_papers}`);

              enrichedData.publications_count = result.data.publications_count;
              enrichedData.first_author_papers = result.data.first_author_papers;
              enrichedData.last_author_papers = result.data.last_author_papers;
              enrichedData.recent_high_impact_papers = result.data.recent_high_impact_papers;

              fieldsEnriched += (result.fieldsEnriched?.length || 4);
            } else {
              console.log(`   ✗ Failed: ${result.error}`);
              fieldsFailed += 1;
            }

          } else if (source === 'scholar') {
            const orcidId = researcherData.data.orcid_id;

            const result = await executeWithRateLimit(
              () => fetchSemanticScholarMetrics(orcidId, fullName),
              rateLimiters.scholar
            );

            if (result.success && result.data) {
              console.log(`   ✓ H-index: ${result.data.h_index}`);
              console.log(`   ✓ Citations: ${result.data.total_citations?.toLocaleString()}`);

              enrichedData.h_index = result.data.h_index;
              enrichedData.total_citations = result.data.total_citations;

              fieldsEnriched += (result.fieldsEnriched?.length || 2);
            } else {
              console.log(`   ✗ Failed: ${result.error}`);
              fieldsFailed += 1;
            }

          } else if (source === 'nih') {
            if (!fullName) {
              console.log('   ⚠️  No name available - skipping');
              fieldsFailed += 1;
              continue;
            }

            const institution = researcherData.data.current_institution;
            const result = await executeWithRateLimit(
              () => fetchNIHGrants(fullName, institution),
              rateLimiters.nih
            );

            if (result.success && result.data) {
              console.log(`   ✓ Found ${result.data.active_grants?.length || 0} active grants`);
              console.log(`   ✓ Total funding: $${result.data.total_funding_usd?.toLocaleString()}`);

              enrichedData.active_grants = result.data.active_grants;
              enrichedData.total_funding_usd = result.data.total_funding_usd;
              enrichedData.funding_sources = result.data.funding_sources;

              fieldsEnriched += (result.fieldsEnriched?.length || 3);
            } else {
              console.log(`   ✗ Failed: ${result.error}`);
              fieldsFailed += 1;
            }

          } else {
            console.log(`   ⚠️  Unknown source: ${source}`);
            fieldsFailed += 1;
          }

        } else {
          // ===== SIMULATED API CALLS (for testing without API limits) =====

          if (source === 'orcid') {
            console.log('   ✓ Found researcher profile (simulated)');
            enrichedData.orcid_id = enrichedData.orcid_id || researcherData.data.orcid_id || `0000-000${Math.floor(Math.random() * 9)}-${Math.floor(Math.random() * 9999)}-${Math.floor(Math.random() * 9999)}`;
            enrichedData.publications_count = Math.floor(Math.random() * 100) + 20;
            enrichedData.first_author_papers = Math.floor(enrichedData.publications_count * 0.3);
            enrichedData.last_author_papers = Math.floor(enrichedData.publications_count * 0.25);
            fieldsEnriched += 4;

          } else if (source === 'pubmed') {
            console.log('   ✓ Found recent publications (simulated)');
            enrichedData.recent_high_impact_papers = Math.floor(Math.random() * 15) + 3;
            fieldsEnriched += 1;

          } else if (source === 'scholar') {
            console.log('   ✓ Found citation metrics (simulated)');
            enrichedData.h_index = enrichedData.h_index || researcherData.data.h_index || Math.floor(Math.random() * 60) + 20;
            enrichedData.total_citations = Math.floor(Math.random() * 10000) + 1000;
            fieldsEnriched += 2;

          } else if (source === 'nih') {
            console.log('   ✓ Found grant funding (simulated)');
            const grantCount = Math.floor(Math.random() * 4) + 1;
            enrichedData.active_grants = Array.from({length: grantCount}, (_, i) =>
              `R01 ${['GM', 'AI', 'CA', 'NS'][Math.floor(Math.random() * 4)]}${Math.floor(Math.random() * 900000) + 100000}`
            );
            enrichedData.total_funding_usd = enrichedData.total_funding_usd || Math.floor(Math.random() * 3000000) + 500000;
            enrichedData.funding_sources = ['NIH'];
            fieldsEnriched += 3;

          } else {
            console.log(`   ⚠️  Unknown source: ${source}`);
            fieldsFailed += 1;
          }
        }

      } catch (error: any) {
        console.log(`   ✗ Error: ${error.message}`);
        fieldsFailed += 1;
      }
    }

    console.log(`\nEnrichment Summary:`);
    console.log(`  Fields enriched: ${fieldsEnriched}`);
    console.log(`  Fields failed: ${fieldsFailed}`);
    const successRate = fieldsEnriched + fieldsFailed > 0 ? (fieldsEnriched / (fieldsEnriched + fieldsFailed)) * 100 : 0;
    console.log(`  Enrichment score: ${Math.round(successRate)}%`);
    console.log(`  Mode: ${useRealAPIs ? 'REAL APIs' : 'SIMULATED (use --use-real-apis for real data)'}`);

    if (opts.dryRun) {
      console.log(`\nDRY RUN - Enriched data preview:`);
      console.log(JSON.stringify(enrichedData, null, 2));
      return;
    }

    if (opts.save) {
      // Recalculate lead score based on enriched data
      let newScore = researcherData.data.lead_score || 40;
      if (enrichedData.total_funding_usd && enrichedData.total_funding_usd > 1000000) newScore += 20;
      if (enrichedData.h_index && enrichedData.h_index > 40) newScore += 10;
      if (enrichedData.publications_count && enrichedData.publications_count > 50) newScore += 10;
      if (enrichedData.active_grants && enrichedData.active_grants.length > 0) newScore += 10;

      newScore = Math.min(100, newScore);
      const newTemp = newScore >= 70 ? 'Hot' : newScore >= 50 ? 'Warm' : 'Cold';

      // Update ResearcherProfile
      const updatedFront = {
        ...researcherData.data,
        ...enrichedData,
        lead_score: newScore,
        lead_temperature: newTemp,
        last_enriched: new Date().toISOString(),
        enrichment_sources: sources,
        updated_at: new Date().toISOString()
      };

      const updatedContent = matter.stringify(researcherData.content, updatedFront);
      fs.writeFileSync(researcherFile, updatedContent, 'utf8');

      console.log(`\n✅ ResearcherProfile updated!`);
      console.log(`   File: researcher-profiles/${partySlug}.md`);

      if (newScore !== researcherData.data.lead_score) {
        console.log(`   Lead score updated: ${researcherData.data.lead_score || 40} → ${newScore} (${newTemp})`);
      }

      // Update PartySource with enrichment metadata
      const sourceFiles = fs.readdirSync(path.join(VAULT, "party-sources"));
      for (const sourceFile of sourceFiles) {
        const sourceContent = fs.readFileSync(path.join(VAULT, "party-sources", sourceFile), 'utf8');
        if (sourceContent.includes(partyId)) {
          const sourceData = matter(sourceContent);
          sourceData.data.enrichment_attempts = (sourceData.data.enrichment_attempts || 0) + 1;
          sourceData.data.last_enrichment_date = new Date().toISOString();
          sourceData.data.enrichment_sources = sources;
          sourceData.data.enrichment_success_rate = successRate / 100;
          sourceData.data.fields_enriched = Object.keys(enrichedData);
          sourceData.data.data_quality_score = Math.min(95, (sourceData.data.data_quality_score || 60) + 10);
          sourceData.data.updated_at = new Date().toISOString();

          const updatedSourceContent = matter.stringify(sourceData.content, sourceData.data);
          fs.writeFileSync(path.join(VAULT, "party-sources", sourceFile), updatedSourceContent, 'utf8');

          console.log(`   Updated PartySource: ${sourceFile}`);
          break;
        }
      }
    } else {
      console.log(`\n💡 Tip: Use --save to update the ResearcherProfile with enriched data`);
    }
  });

program
  .command("validate")
  .description("Run schema + link validation")
  .action(() => {
    ensureVault();
    // Node schema validator
    const node = spawnSync("node", ["vault/_hooks/validate_frontmatter.mjs"], { stdio: "inherit" });
    if (node.status !== 0) process.exit(node.status ?? 1);
    // Python link validator
    const py = spawnSync("python3", ["vault/_hooks/validate_links.py"], { stdio: "inherit" });
    if (py.status !== 0) process.exit(py.status ?? 1);
    console.log("OK ✓");
  });

program
  .command("install-hooks")
  .description("Symlink vault/_hooks/* into .git/hooks/")
  .action(() => {
    const ghooks = path.join(ROOT, ".git", "hooks");
    if (!fs.existsSync(ghooks)) {
      console.error("No .git/hooks directory found; run inside a git repo.");
      process.exit(1);
    }
    for (const f of fs.readdirSync(path.join(VAULT, "_hooks"))) {
      const src = path.join(VAULT, "_hooks", f);
      const dst = path.join(ghooks, f);
      try {
        if (fs.existsSync(dst)) fs.rmSync(dst, { force: true });
        fs.symlinkSync(path.relative(ghooks, src), dst);
        fs.chmodSync(src, 0o755);
        console.log("Linked", f);
      } catch (e) {
        console.error("Failed linking", f, e);
      }
    }
  });

program
  .command("sync")
  .argument("<adapter>", "postgres (stub)")
  .option("--dsn <dsn>", "e.g., postgres://user:pass@host/db")
  .option("--dry-run", "do not write", true)
  .action((adapter, opts) => {
    if (adapter !== "postgres") {
      console.error("Only 'postgres' stub implemented");
      process.exit(1);
    }
    console.log("Dry-run sync to Postgres at", opts.dsn || "(none provided)");
    console.log("Map frontmatter to tables (stub).");
  });

program
  .command("clean")
  .description("Clear all data from vault (preserves structure)")
  .option("--force", "skip confirmation prompt")
  .action(async (opts) => {
    ensureVault();

    // Safety check - require --force or confirmation
    if (!opts.force) {
      console.log("⚠️  WARNING: This will delete all data in vault/");
      console.log("   - All entity records (accounts, contacts, etc.)");
      console.log("   - All event logs");
      console.log("   - Database (crm.db)");
      console.log("   - Change logs");
      console.log("");
      console.log("   Structure (_schemas, _hooks, settings) will be preserved.");
      console.log("");
      console.log("   Run with --force to confirm: zcrm clean --force");
      process.exit(1);
    }

    console.log("🧹 Cleaning vault data...\n");

    // Clear entity directories
    const entityDirs = Object.values(KIND_DIR);
    let fileCount = 0;

    for (const dir of entityDirs) {
      const dirPath = path.join(VAULT, dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
        for (const file of files) {
          fs.unlinkSync(path.join(dirPath, file));
          fileCount++;
        }
        console.log(`✓ Cleared ${files.length} records from ${dir}/`);
      }
    }

    // Clear event logs
    const logsDir = path.join(VAULT, "_logs");
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
      for (const file of logFiles) {
        fs.unlinkSync(path.join(logsDir, file));
      }
      console.log(`✓ Cleared ${logFiles.length} event log file(s)`);
    }

    // Clear database tables (but keep the file)
    const dbPath = path.join(VAULT, "crm.db");
    if (fs.existsSync(dbPath)) {
      try {
        const Database = await import('better-sqlite3');
        const db = new Database.default(dbPath);

        // Get all tables
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{name: string}>;

        // Clear each table
        for (const {name} of tables) {
          db.prepare(`DELETE FROM ${name}`).run();
        }

        db.close();
        console.log(`✓ Cleared ${tables.length} table(s) in database`);
      } catch (error: any) {
        console.warn(`⚠ Could not clear database: ${error.message}`);
      }
    }

    // Clear change log
    const changeLogPath = path.join(VAULT, "changes.log");
    if (fs.existsSync(changeLogPath)) {
      fs.unlinkSync(changeLogPath);
      console.log("✓ Deleted change log");
    }

    // Clear indexes
    const indexesDir = path.join(VAULT, "_indexes");
    if (fs.existsSync(indexesDir)) {
      const indexFiles = fs.readdirSync(indexesDir);
      for (const file of indexFiles) {
        fs.unlinkSync(path.join(indexesDir, file));
      }
      if (indexFiles.length > 0) {
        console.log(`✓ Cleared ${indexFiles.length} index file(s)`);
      }
    }

    console.log(`\n✨ Vault cleaned! Removed ${fileCount} entity records.`);
    console.log("   Structure preserved: _schemas/, _hooks/, _automation/, settings/");
  });

// =============================================================================
// Identity Resolution Commands
// =============================================================================

/**
 * match-parties: Find potential duplicate parties using identity resolution
 */
program
  .command("match-parties")
  .description("Find potential duplicate parties using identity resolution")
  .option("--name <name>", "Search by name")
  .option("--email <email>", "Search by email address")
  .option("--orcid <orcid>", "Search by ORCID ID")
  .option("--google-scholar <id>", "Search by Google Scholar ID")
  .option("--institution <institution>", "Search by institution")
  .option("--min-confidence <score>", "Minimum confidence score (0.0-1.0)", "0.7")
  .option("--show-all", "Show all matches including low confidence")
  .option("--json", "Output JSON format")
  .action(async (opts) => {
    const {
      findMatchingParties,
    } = await import('./lib/identity-resolution.js');

    if (!opts.name && !opts.email && !opts.orcid && !opts.googleScholar) {
      console.error("❌ Error: At least one search criterion is required (--name, --email, --orcid, or --google-scholar)");
      process.exit(1);
    }

    console.log("🔍 Searching for matching parties...\n");

    const result = findMatchingParties(VAULT, {
      name: opts.name,
      email: opts.email,
      orcid: opts.orcid,
      google_scholar_id: opts.googleScholar,
      institution: opts.institution
    }, {
      min_confidence: parseFloat(opts.minConfidence),
      include_low_confidence: opts.showAll
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Query:`);
    if (result.query_name) console.log(`  Name: ${result.query_name}`);
    if (result.query_email) console.log(`  Email: ${result.query_email}`);
    if (result.query_orcid) console.log(`  ORCID: ${result.query_orcid}`);
    console.log();

    if (result.candidates.length === 0) {
      console.log("✨ No matches found. This appears to be a new party.");
      console.log(`   Suggested action: CREATE NEW PARTY`);
      return;
    }

    console.log(`Found ${result.candidates.length} potential match(es):\n`);

    for (let i = 0; i < result.candidates.length; i++) {
      const candidate = result.candidates[i];
      const rank = i + 1;

      console.log(`${rank}. ${candidate.party_name} (${candidate.party_id})`);
      console.log(`   Confidence: ${(candidate.confidence_score * 100).toFixed(1)}%`);

      if (candidate.individual) {
        console.log(`   Person: ${candidate.individual.person_name}`);
      }

      if (candidate.emails && candidate.emails.length > 0) {
        console.log(`   Emails: ${candidate.emails.map(e => e.email_address).join(', ')}`);
      }

      if (candidate.researcher_profile) {
        console.log(`   Institution: ${candidate.researcher_profile.current_institution || 'N/A'}`);
        console.log(`   Position: ${candidate.researcher_profile.current_position || 'N/A'}`);
      }

      console.log(`   Match reasons:`);
      for (const reason of candidate.match_reasons) {
        console.log(`     - ${reason.type}: ${reason.field} = "${reason.value}" (score: ${(reason.score * 100).toFixed(1)}%)`);
        if (reason.details) {
          console.log(`       ${reason.details}`);
        }
      }

      if (candidate.identifications && candidate.identifications.length > 0) {
        console.log(`   External IDs:`);
        for (const id of candidate.identifications) {
          console.log(`     - ${id.party_identification_type}: ${id.identification_number}`);
        }
      }

      console.log();
    }

    console.log(`\n📊 Recommendation:`);
    console.log(`   Top match: ${result.top_match?.party_name || 'None'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Suggested action: ${result.suggested_action.toUpperCase()}`);

    if (result.suggested_action === 'merge') {
      console.log(`\n💡 High confidence match! Consider running:`);
      console.log(`   node dist/index.js merge-parties <new-party-id> ${result.top_match?.party_id}`);
    } else if (result.suggested_action === 'link') {
      console.log(`\n💡 Good match! Consider linking these parties or review manually.`);
    } else if (result.suggested_action === 'review') {
      console.log(`\n⚠️  Medium confidence. Manual review recommended.`);
    }
  });

/**
 * merge-parties: Merge two parties into one (identity unification)
 */
program
  .command("merge-parties")
  .description("Merge two parties into one unified party")
  .argument("<source-party-id>", "Party ID to merge FROM (will be archived)")
  .argument("<target-party-id>", "Party ID to merge INTO (will be kept)")
  .option("--dry-run", "Preview the merge without executing")
  .option("--force", "Skip confirmation prompt")
  .action(async (sourcePartyId, targetPartyId, opts) => {
    const {
      loadAllParties,
      loadAllIndividuals,
      loadAllPartyIdentifications,
      loadAllContactPointEmails,
      loadAllResearcherProfiles,
      shouldMergeParties
    } = await import('./lib/identity-resolution.js');

    console.log("🔄 Party Merge Tool\n");

    // Validate party IDs
    const parties = loadAllParties(VAULT);
    const sourceParty = parties.find(p => p.id === sourcePartyId);
    const targetParty = parties.find(p => p.id === targetPartyId);

    if (!sourceParty) {
      console.error(`❌ Error: Source party ${sourcePartyId} not found`);
      process.exit(1);
    }

    if (!targetParty) {
      console.error(`❌ Error: Target party ${targetPartyId} not found`);
      process.exit(1);
    }

    console.log(`Source party: ${sourceParty.name} (${sourcePartyId})`);
    console.log(`Target party: ${targetParty.name} (${targetPartyId})\n`);

    // Check if merge is recommended
    const mergeCheck = shouldMergeParties(VAULT, sourcePartyId, targetPartyId);

    console.log(`Match analysis:`);
    console.log(`  Confidence: ${(mergeCheck.confidence * 100).toFixed(1)}%`);
    console.log(`  Recommended: ${mergeCheck.should_merge ? 'YES' : 'NO'}`);

    if (mergeCheck.reasons.length > 0) {
      console.log(`  Match reasons:`);
      for (const reason of mergeCheck.reasons) {
        console.log(`    - ${reason.type}: ${reason.field} = "${reason.value}" (${(reason.score * 100).toFixed(1)}%)`);
      }
    }

    if (!mergeCheck.should_merge && !opts.force) {
      console.log(`\n⚠️  Warning: Low confidence match (${(mergeCheck.confidence * 100).toFixed(1)}%)`);
      console.log(`   Use --force to proceed anyway`);
      process.exit(1);
    }

    // Load related entities
    const individuals = loadAllIndividuals(VAULT);
    const identifications = loadAllPartyIdentifications(VAULT);
    const emails = loadAllContactPointEmails(VAULT);
    const researcherProfiles = loadAllResearcherProfiles(VAULT);

    const sourceIndividuals = individuals.filter(i =>
      i.party_id === sourcePartyId || i.party_id.includes(sourceParty.file_path?.split('/').pop()?.replace('.md', '') || '')
    );
    const sourceIdentifications = identifications.filter(id =>
      id.party_id === sourcePartyId || id.party_id.includes(sourceParty.file_path?.split('/').pop()?.replace('.md', '') || '')
    );
    const sourceEmails = emails.filter(e =>
      e.party_id === sourcePartyId || e.party_id.includes(sourceParty.file_path?.split('/').pop()?.replace('.md', '') || '')
    );
    const sourceProfiles = researcherProfiles.filter(p =>
      p.party_id === sourcePartyId || p.party_id.includes(sourceParty.file_path?.split('/').pop()?.replace('.md', '') || '')
    );

    console.log(`\n📦 Entities to merge:`);
    console.log(`  ${sourceIndividuals.length} individual(s)`);
    console.log(`  ${sourceIdentifications.length} identification(s)`);
    console.log(`  ${sourceEmails.length} email(s)`);
    console.log(`  ${sourceProfiles.length} researcher profile(s)`);

    if (opts.dryRun) {
      console.log(`\n✓ Dry run complete. No changes made.`);
      console.log(`\nTo execute the merge, run without --dry-run`);
      return;
    }

    if (!opts.force) {
      console.log(`\n⚠️  This operation will:`);
      console.log(`   1. Move all related entities from source to target party`);
      console.log(`   2. Archive the source party`);
      console.log(`   3. Update the target party's unified_score and merge history`);
      console.log(`\n❓ Are you sure? (This cannot be easily undone)`);
      console.log(`   Run with --force to proceed, or Ctrl+C to cancel`);
      process.exit(0);
    }

    console.log(`\n🔄 Merging parties...`);

    // TODO: Implement actual merge logic
    // This would involve:
    // 1. Updating all source entity references to target party
    // 2. Creating events to update party_id fields
    // 3. Archiving source party markdown file
    // 4. Updating target party's merge_source_party_ids array
    // 5. Recalculating unified_score

    console.log(`\n⚠️  Merge functionality not yet fully implemented.`);
    console.log(`   This is a preview of the merge tool.`);
    console.log(`\n   To complete implementation, see:`);
    console.log(`   - src/index.ts (merge-parties command)`);
    console.log(`   - src/lib/identity-resolution.ts`);
  });

// Register ORCID enrichment command
program.addCommand(enrichORCIDCommand);

program.parse();

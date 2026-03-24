import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const VAULT = path.join(process.cwd(), 'vault');

// Tool: Get Account Info
export function get_account(account_id: string) {
  try {
    const accountsDir = path.join(VAULT, 'accounts');
    if (!fs.existsSync(accountsDir)) {
      return `Error: Accounts directory not found`;
    }

    const files = fs.readdirSync(accountsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(accountsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id === account_id) {
        return JSON.stringify({
          id: data.id,
          name: data.name,
          owner: data.owner,
          industry: data.industry,
          website: data.website,
          phone: data.phone,
          ...data
        }, null, 2);
      }
    }

    return `Account ${account_id} not found`;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

// Tool: List Opportunities
export function list_opportunities(filters?: {
  stage?: string;
  account_id?: string;
  min_amount?: number;
}) {
  try {
    const oppsDir = path.join(VAULT, 'opportunities');
    if (!fs.existsSync(oppsDir)) {
      return JSON.stringify([]);
    }

    const files = fs.readdirSync(oppsDir);
    let opportunities: any[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(oppsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      // Apply filters
      if (filters?.stage && data.stage !== filters.stage) continue;
      if (filters?.account_id && data.account_id !== filters.account_id) continue;
      if (filters?.min_amount && (data.amount || 0) < filters.min_amount) continue;

      opportunities.push({
        id: data.id,
        name: data.name,
        stage: data.stage,
        amount: data.amount,
        close_date: data.close_date,
        account_id: data.account_id
      });
    }

    return JSON.stringify(opportunities, null, 2);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

// Tool: Get Recent Activity
export function get_recent_activity(entity_id?: string, limit = 10) {
  try {
    const eventsDir = path.join(VAULT, '_logs/events');
    if (!fs.existsSync(eventsDir)) {
      return JSON.stringify([]);
    }

    const files = fs.readdirSync(eventsDir)
      .sort()
      .reverse()
      .slice(0, 100);

    let events: any[] = [];

    for (const file of files) {
      if (events.length >= limit) break;

      const filePath = path.join(eventsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        if (events.length >= limit) break;

        try {
          const event = JSON.parse(line);

          if (entity_id && event.entity_id !== entity_id) continue;

          events.push({
            type: event.type,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            timestamp: event.timestamp,
            status: event.status
          });
        } catch {}
      }
    }

    return JSON.stringify(events, null, 2);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

// Tool: Search Contacts
export function search_contacts(query: string, limit = 10) {
  try {
    const contactsDir = path.join(VAULT, 'contacts');
    if (!fs.existsSync(contactsDir)) {
      return JSON.stringify([]);
    }

    const files = fs.readdirSync(contactsDir);
    let contacts: any[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(contactsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      const searchText = `${data.name || ''} ${data.email || ''} ${data.title || ''}`.toLowerCase();

      if (searchText.includes(lowerQuery)) {
        contacts.push({
          id: data.id,
          name: data.name,
          email: data.email,
          title: data.title,
          account_id: data.account_id
        });

        if (contacts.length >= limit) break;
      }
    }

    return JSON.stringify(contacts, null, 2);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

// Tool: Get Pipeline Summary
export function get_pipeline_summary(owner_id?: string) {
  try {
    const oppsDir = path.join(VAULT, 'opportunities');
    if (!fs.existsSync(oppsDir)) {
      return JSON.stringify({});
    }

    const files = fs.readdirSync(oppsDir);
    const summary: Record<string, { count: number; total_value: number }> = {};

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(oppsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (owner_id && data.owner_id !== owner_id) continue;

      const stage = data.stage || 'Unknown';

      if (!summary[stage]) {
        summary[stage] = { count: 0, total_value: 0 };
      }

      summary[stage].count++;
      summary[stage].total_value += data.amount || 0;
    }

    return JSON.stringify(summary, null, 2);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

// Function map
export const functionsMap: Record<string, Function> = {
  get_account,
  list_opportunities,
  get_recent_activity,
  search_contacts,
  get_pipeline_summary
};

// Tool definitions for Cohere
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_account",
      description: "Retrieves detailed information about a specific account by ID",
      parameters: {
        type: "object",
        properties: {
          account_id: {
            type: "string",
            description: "The account ID (e.g., acc_01HXXX)"
          }
        },
        required: ["account_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_opportunities",
      description: "Lists opportunities with optional filters by stage, account, or amount",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            properties: {
              stage: {
                type: "string",
                description: "Filter by stage (e.g., 'Prospecting', 'Closed Won')"
              },
              account_id: {
                type: "string",
                description: "Filter by account ID"
              },
              min_amount: {
                type: "number",
                description: "Minimum opportunity amount"
              }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_recent_activity",
      description: "Gets recent activity/events, optionally filtered by entity ID",
      parameters: {
        type: "object",
        properties: {
          entity_id: {
            type: "string",
            description: "Optional entity ID to filter events"
          },
          limit: {
            type: "number",
            description: "Maximum number of events to return (default 10)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search contacts by name, email, or title",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to match against contact name, email, or title"
          },
          limit: {
            type: "number",
            description: "Maximum number of contacts to return (default 10)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pipeline_summary",
      description: "Get a summary of the pipeline grouped by stage with counts and total values",
      parameters: {
        type: "object",
        properties: {
          owner_id: {
            type: "string",
            description: "Optional owner ID to filter opportunities"
          }
        }
      }
    }
  }
];

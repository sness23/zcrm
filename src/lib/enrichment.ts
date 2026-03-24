/**
 * Research Intelligence Enrichment APIs
 *
 * This module provides real API integrations for enriching researcher profiles
 * from public data sources:
 *
 * - ORCID: Researcher identifiers, affiliations, publications
 * - PubMed: Publication metadata, co-authors, citations
 * - NIH RePORTER: Grant funding data
 * - Semantic Scholar: Citation networks, h-index
 */

import fetch from 'node-fetch';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EnrichmentResult {
  source: string;
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  fieldsEnriched?: string[];
}

export interface ORCIDProfile {
  orcid_id: string;
  given_names?: string;
  family_name?: string;
  current_affiliation?: string;
  works_count?: number;
  works?: ORCIDWork[];
}

export interface ORCIDWork {
  title: string;
  publication_date?: { year: string };
  type?: string;
  doi?: string;
}

export interface PubMedPublication {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  citations?: number;
}

export interface NIHGrant {
  project_num: string;
  project_title: string;
  pi_name: string;
  organization_name: string;
  award_amount: number;
  fiscal_year: number;
  award_notice_date: string;
}

// ============================================================================
// ORCID API Integration
// ============================================================================

/**
 * Fetch researcher profile from ORCID public API
 *
 * ORCID API Documentation: https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/
 *
 * Rate limits: 5,000 requests per hour (no authentication required for public data)
 *
 * @param orcidId - ORCID identifier (format: 0000-0002-1234-5678)
 * @returns ORCID profile data or null if not found
 */
export async function fetchORCIDProfile(orcidId: string): Promise<EnrichmentResult> {
  try {
    // Validate ORCID format
    const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/;
    if (!orcidPattern.test(orcidId)) {
      return {
        source: 'orcid',
        success: false,
        error: `Invalid ORCID format: ${orcidId}`
      };
    }

    // Fetch from ORCID public API
    const url = `https://pub.orcid.org/v3.0/${orcidId}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          source: 'orcid',
          success: false,
          error: `ORCID not found: ${orcidId}`
        };
      }
      throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    // Extract profile information
    const profile: ORCIDProfile = {
      orcid_id: orcidId
    };

    // Extract name
    if (data.person?.name) {
      profile.given_names = data.person.name['given-names']?.value;
      profile.family_name = data.person.name['family-name']?.value;
    }

    // Extract current affiliation
    if (data.person?.['employments-summary']?.['employment-summary']?.[0]) {
      const employment = data.person['employments-summary']['employment-summary'][0];
      profile.current_affiliation = employment['organization']?.name;
    }

    // Fetch works (publications)
    const worksUrl = `https://pub.orcid.org/v3.0/${orcidId}/works`;
    const worksResponse = await fetch(worksUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (worksResponse.ok) {
      const worksData: any = await worksResponse.json();
      const works = worksData.group || [];
      profile.works_count = works.length;

      // Extract work details (first 50 for performance)
      profile.works = works.slice(0, 50).map((workGroup: any) => {
        const workSummary = workGroup['work-summary']?.[0];
        return {
          title: workSummary?.title?.title?.value || 'Untitled',
          publication_date: workSummary?.['publication-date'],
          type: workSummary?.type,
          doi: workSummary?.['external-ids']?.['external-id']?.find((id: any) => id['external-id-type'] === 'doi')?.['external-id-value']
        };
      });
    }

    // Calculate enriched fields
    const fieldsEnriched = ['orcid_id'];
    if (profile.current_affiliation) fieldsEnriched.push('current_institution');
    if (profile.works_count) fieldsEnriched.push('publications_count');

    return {
      source: 'orcid',
      success: true,
      data: profile,
      fieldsEnriched
    };

  } catch (error) {
    return {
      source: 'orcid',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Search ORCID by name and institution
 *
 * @param name - Researcher full name
 * @param institution - Institution name (optional)
 * @returns Array of ORCID IDs matching the search
 */
export async function searchORCID(name: string, institution?: string): Promise<string[]> {
  try {
    // Build search query
    let query = `family-name:${name.split(' ').pop()} AND given-names:${name.split(' ')[0]}`;
    if (institution) {
      query += ` AND affiliation-org-name:${institution}`;
    }

    const url = `https://pub.orcid.org/v3.0/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`ORCID search error: ${response.status}`);
    }

    const data: any = await response.json();
    const results = data.result || [];

    return results
      .slice(0, 10) // Limit to top 10 results
      .map((result: any) => result['orcid-identifier']?.path)
      .filter(Boolean);

  } catch (error) {
    console.error('ORCID search failed:', error);
    return [];
  }
}

// ============================================================================
// PubMed API Integration
// ============================================================================

/**
 * Fetch publications from PubMed by author name
 *
 * PubMed E-utilities Documentation: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 *
 * Rate limits: No hard limit, but please limit to 3 requests per second
 *
 * @param authorName - Full author name
 * @param maxResults - Maximum publications to return (default: 50)
 * @returns Enrichment result with publication data
 */
export async function fetchPubMedPublications(
  authorName: string,
  maxResults: number = 50
): Promise<EnrichmentResult> {
  try {
    // Step 1: Search for PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?` +
      `db=pubmed&term=${encodeURIComponent(authorName + '[Author]')}&retmax=${maxResults}&retmode=json`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`);
    }

    const searchData: any = await searchResponse.json();
    const pmids = searchData.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return {
        source: 'pubmed',
        success: false,
        error: 'No publications found'
      };
    }

    // Step 2: Fetch publication details (summary)
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?` +
      `db=pubmed&id=${pmids.join(',')}&retmode=json`;

    const summaryResponse = await fetch(summaryUrl);
    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary error: ${summaryResponse.status}`);
    }

    const summaryData: any = await summaryResponse.json();
    const publications: PubMedPublication[] = [];

    // Parse publication data
    for (const pmid of pmids) {
      const pub = summaryData.result?.[pmid];
      if (!pub) continue;

      publications.push({
        pmid,
        title: pub.title || 'Untitled',
        authors: pub.authors?.map((a: any) => a.name) || [],
        journal: pub.fulljournalname || pub.source || 'Unknown',
        year: parseInt(pub.pubdate?.split(' ')[0]) || 0,
        doi: pub.elocationid || undefined
      });
    }

    // Analyze authorship positions
    const firstAuthorPapers = publications.filter(p =>
      p.authors[0]?.toLowerCase().includes(authorName.split(' ').pop()?.toLowerCase() || '')
    ).length;

    const lastAuthorPapers = publications.filter(p =>
      p.authors[p.authors.length - 1]?.toLowerCase().includes(authorName.split(' ').pop()?.toLowerCase() || '')
    ).length;

    // Count recent high-impact papers (Nature, Science, Cell journals)
    const highImpactJournals = ['nature', 'science', 'cell', 'lancet', 'nejm'];
    const recentHighImpact = publications.filter(p =>
      p.year >= new Date().getFullYear() - 5 &&
      highImpactJournals.some(j => p.journal.toLowerCase().includes(j))
    ).length;

    return {
      source: 'pubmed',
      success: true,
      data: {
        publications_count: publications.length,
        first_author_papers: firstAuthorPapers,
        last_author_papers: lastAuthorPapers,
        recent_high_impact_papers: recentHighImpact,
        publications: publications.slice(0, 20) // Return top 20 for details
      },
      fieldsEnriched: ['publications_count', 'first_author_papers', 'last_author_papers', 'recent_high_impact_papers']
    };

  } catch (error) {
    return {
      source: 'pubmed',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// NIH RePORTER API Integration
// ============================================================================

/**
 * Fetch grant funding from NIH RePORTER
 *
 * NIH RePORTER API Documentation: https://api.reporter.nih.gov/
 *
 * Rate limits: No authentication required, reasonable use policy
 *
 * @param piName - Principal Investigator name
 * @param institution - Institution name (optional, improves accuracy)
 * @returns Enrichment result with grant data
 */
export async function fetchNIHGrants(
  piName: string,
  institution?: string
): Promise<EnrichmentResult> {
  try {
    // Build search criteria
    const criteria: any = {
      pi_names: [{ any_name: piName }]
    };

    if (institution) {
      criteria.org_names = [institution];
    }

    // Only fetch active grants (current fiscal year and previous year)
    const currentYear = new Date().getFullYear();
    criteria.fiscal_years = [currentYear, currentYear - 1];

    const url = 'https://api.reporter.nih.gov/v2/projects/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        criteria,
        offset: 0,
        limit: 50,
        sort_field: 'award_amount',
        sort_order: 'desc'
      })
    });

    if (!response.ok) {
      throw new Error(`NIH RePORTER error: ${response.status}`);
    }

    const data: any = await response.json();
    const projects = data.results || [];

    if (projects.length === 0) {
      return {
        source: 'nih',
        success: false,
        error: 'No grants found'
      };
    }

    // Extract grant information
    const grants: NIHGrant[] = projects.map((proj: any) => ({
      project_num: proj.project_num || '',
      project_title: proj.project_title || 'Untitled',
      pi_name: proj.principal_investigators?.[0]?.full_name || piName,
      organization_name: proj.organization?.org_name || '',
      award_amount: proj.award_amount || 0,
      fiscal_year: proj.fiscal_year || currentYear,
      award_notice_date: proj.award_notice_date || ''
    }));

    // Calculate total funding
    const totalFunding = grants.reduce((sum, grant) => sum + grant.award_amount, 0);

    // Get active grant numbers
    const activeGrants = grants.map(g => g.project_num);

    return {
      source: 'nih',
      success: true,
      data: {
        active_grants: activeGrants,
        total_funding_usd: totalFunding,
        funding_sources: ['NIH'],
        grants: grants.slice(0, 10) // Return top 10 for details
      },
      fieldsEnriched: ['active_grants', 'total_funding_usd', 'funding_sources']
    };

  } catch (error) {
    return {
      source: 'nih',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Semantic Scholar API Integration
// ============================================================================

/**
 * Fetch citation metrics from Semantic Scholar
 *
 * Semantic Scholar API Documentation: https://api.semanticscholar.org/
 *
 * Rate limits: 100 requests per 5 minutes (no authentication)
 *
 * @param orcidId - ORCID identifier (preferred) or author name
 * @returns Enrichment result with citation data
 */
export async function fetchSemanticScholarMetrics(
  orcidId?: string,
  authorName?: string
): Promise<EnrichmentResult> {
  try {
    if (!orcidId && !authorName) {
      return {
        source: 'semantic-scholar',
        success: false,
        error: 'Either ORCID ID or author name required'
      };
    }

    // Search by ORCID (most accurate)
    if (orcidId) {
      const url = `https://api.semanticscholar.org/graph/v1/author/ORCID:${orcidId}?fields=name,hIndex,citationCount,paperCount`;
      const response = await fetch(url);

      if (response.ok) {
        const data: any = await response.json();
        return {
          source: 'semantic-scholar',
          success: true,
          data: {
            h_index: data.hIndex || 0,
            total_citations: data.citationCount || 0,
            publications_count: data.paperCount || 0
          },
          fieldsEnriched: ['h_index', 'total_citations']
        };
      }
    }

    // Fallback: Search by name
    if (authorName) {
      const searchUrl = `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(authorName)}&fields=name,hIndex,citationCount,paperCount&limit=1`;
      const response = await fetch(searchUrl);

      if (response.ok) {
        const data: any = await response.json();
        const author = data.data?.[0];

        if (author) {
          return {
            source: 'semantic-scholar',
            success: true,
            data: {
              h_index: author.hIndex || 0,
              total_citations: author.citationCount || 0,
              publications_count: author.paperCount || 0
            },
            fieldsEnriched: ['h_index', 'total_citations']
          };
        }
      }
    }

    return {
      source: 'semantic-scholar',
      success: false,
      error: 'Author not found'
    };

  } catch (error) {
    return {
      source: 'semantic-scholar',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Rate Limiting & Retry Logic
// ============================================================================

/**
 * Simple rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      // Wait until we have a token
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 1;
    }

    this.tokens -= 1;
  }
}

// Rate limiters for each API
const orcidLimiter = new RateLimiter(5000, 5000 / 3600); // 5k per hour
const pubmedLimiter = new RateLimiter(3, 3); // 3 per second
const nihLimiter = new RateLimiter(10, 10); // Conservative: 10 per second
const scholarLimiter = new RateLimiter(100, 100 / 300); // 100 per 5 minutes

/**
 * Execute API call with rate limiting and retry logic
 */
export async function executeWithRateLimit<T>(
  apiCall: () => Promise<T>,
  limiter: RateLimiter,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await limiter.waitForToken();

    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff
      const backoff = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }

  throw new Error('Max retries exceeded');
}

// Export rate limiters for use in enrichment commands
export const rateLimiters = {
  orcid: orcidLimiter,
  pubmed: pubmedLimiter,
  nih: nihLimiter,
  scholar: scholarLimiter
};

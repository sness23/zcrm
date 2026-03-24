import axios from 'axios';
import { ORCIDPerson, ORCIDWork, ORCIDProfile } from './types.js';

const ORCID_API_BASE = 'https://pub.orcid.org/v3.0';
const ORCID_SEARCH_BASE = 'https://pub.orcid.org/v3.0/search';

export class ORCIDClient {
  private cache: Map<string, any> = new Map();
  private rateLimitDelay = 50; // 20 requests/sec = 50ms between requests

  /**
   * Search for ORCID by name and email
   */
  async searchByNameAndEmail(
    firstName: string,
    lastName: string,
    email?: string
  ): Promise<string | null> {
    // Build search query
    let query = `given-names:${firstName} AND family-name:${lastName}`;
    if (email) {
      query += ` AND email:${email}`;
    }

    const cacheKey = `search:${query}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    await this.rateLimit();

    try {
      const response = await axios.get(ORCID_SEARCH_BASE, {
        params: { q: query },
        headers: { Accept: 'application/json' },
      });

      const results = response.data.result;
      if (results && results.length > 0) {
        const orcid = results[0]['orcid-identifier'].path;
        this.cache.set(cacheKey, orcid);
        return orcid;
      }

      return null;
    } catch (error: any) {
      console.error('ORCID search error:', error.message);
      return null;
    }
  }

  /**
   * Fetch full ORCID profile
   */
  async getProfile(orcid: string): Promise<ORCIDProfile | null> {
    const cacheKey = `profile:${orcid}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    await this.rateLimit();

    try {
      // Fetch person record
      const personResponse = await axios.get(
        `${ORCID_API_BASE}/${orcid}/person`,
        { headers: { Accept: 'application/json' } }
      );

      const person: ORCIDPerson = personResponse.data;

      // Fetch works
      const worksResponse = await axios.get(
        `${ORCID_API_BASE}/${orcid}/works`,
        { headers: { Accept: 'application/json' } }
      );

      const works: ORCIDWork[] = worksResponse.data.group?.map(
        (g: any) => g['work-summary'][0]
      ) || [];

      // Build profile
      const profile: ORCIDProfile = {
        orcid,
        name: `${person.name['given-names'].value} ${person.name['family-name'].value}`,
        email: person.emails?.email?.[0]?.email || null,
        affiliations: [], // TODO: Extract from employments/educations
        works,
        verified: person.emails?.email?.[0]?.verified || false,
      };

      this.cache.set(cacheKey, profile);
      return profile;
    } catch (error: any) {
      console.error(`ORCID profile fetch error for ${orcid}:`, error.message);
      return null;
    }
  }

  private async rateLimit() {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }
}

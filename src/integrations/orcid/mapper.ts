import { ORCIDProfile } from './types.js';

/**
 * Map ORCID profile to ResearcherProfile frontmatter updates
 */
export function mapORCIDToResearcherProfile(profile: ORCIDProfile) {
  return {
    orcid_id: profile.orcid,
    total_publications: profile.works.length,
    verified_email: profile.verified,
    last_orcid_sync: new Date().toISOString(),
  };
}

/**
 * Extract publications for PartyEngagement entities
 */
export function extractPublications(profile: ORCIDProfile) {
  return profile.works.map(work => {
    const doi = work['external-ids']?.['external-id']?.find(
      id => id['external-id-type'] === 'doi'
    )?.['external-id-value'];

    const pmid = work['external-ids']?.['external-id']?.find(
      id => id['external-id-type'] === 'pmid'
    )?.['external-id-value'];

    return {
      title: work.title.title.value,
      journal: work['journal-title']?.value || 'Unknown',
      year: work['publication-date']?.year?.value,
      doi,
      pmid,
      source: 'orcid',
    };
  });
}

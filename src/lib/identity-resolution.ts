/**
 * Identity Resolution Engine for Zax CRM
 *
 * Implements Salesforce Data Cloud-style identity matching for researchers:
 * - Exact matching (email, ORCID, Google Scholar ID, etc.)
 * - Fuzzy name matching (Levenshtein distance)
 * - Institutional matching
 * - Co-authorship network analysis
 *
 * Based on the Party Model architecture described in:
 * docs/salesforce_party_leads_opportunities_summary.md
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Party {
  id: string;
  name: string;
  canonical_name?: string;
  party_type: string;
  unified_score?: number;
  file_path?: string;
}

export interface Individual {
  id: string;
  name: string;
  party_id: string;
  person_name: string;
  canonical_name?: string;
  person_given_name?: string;
  person_family_name?: string;
  file_path?: string;
}

export interface PartyIdentification {
  id: string;
  party_id: string;
  identification_number: string;
  party_identification_type: string;
  confidence_score?: number;
  match_method?: string;
  source_url?: string;
  is_verified?: boolean;
}

export interface ContactPointEmail {
  id: string;
  party_id: string;
  email_address: string;
  is_primary?: boolean;
}

export interface ResearcherProfile {
  id: string;
  party_id: string;
  current_institution?: string;
  current_position?: string;
  primary_research_area?: string;
}

export interface MatchCandidate {
  party_id: string;
  party_name: string;
  confidence_score: number;
  match_reasons: MatchReason[];
  individual?: Individual;
  identifications?: PartyIdentification[];
  emails?: ContactPointEmail[];
  researcher_profile?: ResearcherProfile;
}

export interface MatchReason {
  type: 'exact_id' | 'exact_email' | 'fuzzy_name' | 'institutional' | 'co_authorship';
  field: string;
  value: string;
  score: number;
  details?: string;
}

export interface MatchResult {
  query_party_id?: string;
  query_name?: string;
  query_email?: string;
  query_orcid?: string;
  candidates: MatchCandidate[];
  top_match?: MatchCandidate;
  suggested_action: 'merge' | 'link' | 'new' | 'review';
  confidence: number;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize name for matching (lowercase, remove accents, trim spaces)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Calculate name similarity score (0.0 - 1.0)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1.0;

  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 0.0;

  const distance = levenshteinDistance(n1, n2);
  return 1.0 - (distance / maxLen);
}

/**
 * Calculate first+last name similarity (handles "John Smith" vs "Smith, John")
 */
export function calculateFullNameSimilarity(
  givenName1: string | undefined,
  familyName1: string | undefined,
  fullName1: string,
  givenName2: string | undefined,
  familyName2: string | undefined,
  fullName2: string
): number {
  // If we have structured names, compare those
  if (givenName1 && familyName1 && givenName2 && familyName2) {
    const givenSim = calculateNameSimilarity(givenName1, givenName2);
    const familySim = calculateNameSimilarity(familyName1, familyName2);
    return (givenSim + familySim) / 2;
  }

  // Otherwise fall back to full name comparison
  return calculateNameSimilarity(fullName1, fullName2);
}

/**
 * Load all parties from vault
 */
export function loadAllParties(vaultPath: string): Party[] {
  const partiesDir = path.join(vaultPath, 'parties');
  if (!fs.existsSync(partiesDir)) return [];

  const files = fs.readdirSync(partiesDir).filter(f => f.endsWith('.md'));
  const parties: Party[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(partiesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id && data.name) {
        parties.push({
          ...data as Party,
          file_path: filePath
        });
      }
    } catch (error) {
      console.error(`Error loading party from ${file}:`, error);
    }
  }

  return parties;
}

/**
 * Load all individuals from vault
 */
export function loadAllIndividuals(vaultPath: string): Individual[] {
  const individualsDir = path.join(vaultPath, 'individuals');
  if (!fs.existsSync(individualsDir)) return [];

  const files = fs.readdirSync(individualsDir).filter(f => f.endsWith('.md'));
  const individuals: Individual[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(individualsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id && data.party_id) {
        individuals.push({
          ...data as Individual,
          file_path: filePath
        });
      }
    } catch (error) {
      console.error(`Error loading individual from ${file}:`, error);
    }
  }

  return individuals;
}

/**
 * Load all party identifications from vault
 */
export function loadAllPartyIdentifications(vaultPath: string): PartyIdentification[] {
  const idDir = path.join(vaultPath, 'party-identifications');
  if (!fs.existsSync(idDir)) return [];

  const files = fs.readdirSync(idDir).filter(f => f.endsWith('.md'));
  const identifications: PartyIdentification[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(idDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id && data.party_id) {
        identifications.push(data as PartyIdentification);
      }
    } catch (error) {
      console.error(`Error loading party identification from ${file}:`, error);
    }
  }

  return identifications;
}

/**
 * Load all contact point emails from vault
 */
export function loadAllContactPointEmails(vaultPath: string): ContactPointEmail[] {
  const emailsDir = path.join(vaultPath, 'contact-point-emails');
  if (!fs.existsSync(emailsDir)) return [];

  const files = fs.readdirSync(emailsDir).filter(f => f.endsWith('.md'));
  const emails: ContactPointEmail[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(emailsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id && data.party_id && data.email_address) {
        emails.push(data as ContactPointEmail);
      }
    } catch (error) {
      console.error(`Error loading email from ${file}:`, error);
    }
  }

  return emails;
}

/**
 * Load all researcher profiles from vault
 */
export function loadAllResearcherProfiles(vaultPath: string): ResearcherProfile[] {
  const profilesDir = path.join(vaultPath, 'researcher-profiles');
  if (!fs.existsSync(profilesDir)) return [];

  const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.md'));
  const profiles: ResearcherProfile[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(profilesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      if (data.id && data.party_id) {
        profiles.push(data as ResearcherProfile);
      }
    } catch (error) {
      console.error(`Error loading researcher profile from ${file}:`, error);
    }
  }

  return profiles;
}

/**
 * Extract party ID from wikilink format: [[parties/slug]] → pty_xxx
 */
export function extractPartyIdFromWikilink(wikilink: string, parties: Party[]): string | null {
  const match = wikilink.match(/\[\[parties\/([^\]]+)\]\]/);
  if (!match) return null;

  const slug = match[1];
  const party = parties.find(p => p.file_path?.includes(`/${slug}.md`));
  return party?.id || null;
}

/**
 * Find matching parties for a given set of criteria
 */
export function findMatchingParties(
  vaultPath: string,
  criteria: {
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    orcid?: string;
    google_scholar_id?: string;
    institution?: string;
  },
  options: {
    min_confidence?: number;
    include_low_confidence?: boolean;
  } = {}
): MatchResult {
  const minConfidence = options.min_confidence || 0.7;
  const includeLowConfidence = options.include_low_confidence || false;

  // Load all data
  const parties = loadAllParties(vaultPath);
  const individuals = loadAllIndividuals(vaultPath);
  const identifications = loadAllPartyIdentifications(vaultPath);
  const emails = loadAllContactPointEmails(vaultPath);
  const researcherProfiles = loadAllResearcherProfiles(vaultPath);

  // Build party -> individual/email/id mappings
  const partyMap = new Map<string, {
    party: Party;
    individual?: Individual;
    identifications: PartyIdentification[];
    emails: ContactPointEmail[];
    researcherProfile?: ResearcherProfile;
  }>();

  for (const party of parties) {
    partyMap.set(party.id, {
      party,
      identifications: [],
      emails: []
    });
  }

  for (const individual of individuals) {
    // Extract party ID from wikilink or use direct ULID
    let partyId = individual.party_id;
    if (partyId.startsWith('[[')) {
      partyId = extractPartyIdFromWikilink(partyId, parties) || partyId;
    }

    const entry = partyMap.get(partyId);
    if (entry) {
      entry.individual = individual;
    }
  }

  for (const id of identifications) {
    let partyId = id.party_id;
    if (partyId.startsWith('[[')) {
      partyId = extractPartyIdFromWikilink(partyId, parties) || partyId;
    }

    const entry = partyMap.get(partyId);
    if (entry) {
      entry.identifications.push(id);
    }
  }

  for (const email of emails) {
    let partyId = email.party_id;
    if (partyId.startsWith('[[')) {
      partyId = extractPartyIdFromWikilink(partyId, parties) || partyId;
    }

    const entry = partyMap.get(partyId);
    if (entry) {
      entry.emails.push(email);
    }
  }

  for (const profile of researcherProfiles) {
    let partyId = profile.party_id;
    if (partyId.startsWith('[[')) {
      partyId = extractPartyIdFromWikilink(partyId, parties) || partyId;
    }

    const entry = partyMap.get(partyId);
    if (entry) {
      entry.researcherProfile = profile;
    }
  }

  // Match candidates
  const candidates: MatchCandidate[] = [];

  for (const [partyId, data] of partyMap.entries()) {
    const matchReasons: MatchReason[] = [];
    let totalScore = 0;
    let matchCount = 0;

    // 1. Exact ID matching (highest confidence)
    if (criteria.orcid) {
      const orcidMatch = data.identifications.find(
        id => id.party_identification_type === 'ORCID' &&
              id.identification_number === criteria.orcid
      );
      if (orcidMatch) {
        matchReasons.push({
          type: 'exact_id',
          field: 'ORCID',
          value: criteria.orcid,
          score: 1.0,
          details: 'Exact ORCID match'
        });
        totalScore += 1.0;
        matchCount++;
      }
    }

    if (criteria.google_scholar_id) {
      const scholarMatch = data.identifications.find(
        id => id.party_identification_type === 'GoogleScholar' &&
              id.identification_number === criteria.google_scholar_id
      );
      if (scholarMatch) {
        matchReasons.push({
          type: 'exact_id',
          field: 'GoogleScholar',
          value: criteria.google_scholar_id,
          score: 0.95,
          details: 'Exact Google Scholar ID match'
        });
        totalScore += 0.95;
        matchCount++;
      }
    }

    // 2. Exact email matching (high confidence)
    if (criteria.email) {
      const emailMatch = data.emails.find(
        e => e.email_address.toLowerCase() === criteria.email!.toLowerCase()
      );
      if (emailMatch) {
        matchReasons.push({
          type: 'exact_email',
          field: 'email',
          value: criteria.email,
          score: 0.90,
          details: 'Exact email match'
        });
        totalScore += 0.90;
        matchCount++;
      }
    }

    // 3. Fuzzy name matching (medium confidence)
    if (criteria.name && data.individual) {
      const nameSim = calculateFullNameSimilarity(
        criteria.given_name,
        criteria.family_name,
        criteria.name,
        data.individual.person_given_name,
        data.individual.person_family_name,
        data.individual.person_name
      );

      if (nameSim > 0.75) {
        matchReasons.push({
          type: 'fuzzy_name',
          field: 'name',
          value: criteria.name,
          score: nameSim * 0.70, // Weight fuzzy matches lower
          details: `Name similarity: ${(nameSim * 100).toFixed(0)}%`
        });
        totalScore += nameSim * 0.70;
        matchCount++;
      }
    }

    // 4. Institutional matching (low-medium confidence)
    if (criteria.institution && data.researcherProfile?.current_institution) {
      const instSim = calculateNameSimilarity(
        criteria.institution,
        data.researcherProfile.current_institution
      );

      if (instSim > 0.80) {
        matchReasons.push({
          type: 'institutional',
          field: 'institution',
          value: criteria.institution,
          score: instSim * 0.50, // Weight institutional matches lower
          details: `Institution similarity: ${(instSim * 100).toFixed(0)}%`
        });
        totalScore += instSim * 0.50;
        matchCount++;
      }
    }

    // Calculate overall confidence score
    if (matchCount > 0) {
      const confidenceScore = totalScore / matchCount;

      if (confidenceScore >= minConfidence || includeLowConfidence) {
        candidates.push({
          party_id: partyId,
          party_name: data.party.name,
          confidence_score: confidenceScore,
          match_reasons: matchReasons,
          individual: data.individual,
          identifications: data.identifications,
          emails: data.emails,
          researcher_profile: data.researcherProfile
        });
      }
    }
  }

  // Sort by confidence score (descending)
  candidates.sort((a, b) => b.confidence_score - a.confidence_score);

  // Determine suggested action
  let suggestedAction: 'merge' | 'link' | 'new' | 'review' = 'new';
  let topMatch: MatchCandidate | undefined = undefined;
  let overallConfidence = 0;

  if (candidates.length > 0) {
    topMatch = candidates[0];
    overallConfidence = topMatch.confidence_score;

    if (overallConfidence >= 0.95) {
      suggestedAction = 'merge'; // Very high confidence - auto-merge candidate
    } else if (overallConfidence >= 0.80) {
      suggestedAction = 'link'; // High confidence - suggest linking
    } else {
      suggestedAction = 'review'; // Medium confidence - needs review
    }
  }

  return {
    query_name: criteria.name,
    query_email: criteria.email,
    query_orcid: criteria.orcid,
    candidates,
    top_match: topMatch,
    suggested_action: suggestedAction,
    confidence: overallConfidence
  };
}

/**
 * Check if two parties should be merged based on matching criteria
 */
export function shouldMergeParties(
  vaultPath: string,
  partyId1: string,
  partyId2: string
): {
  should_merge: boolean;
  confidence: number;
  reasons: MatchReason[];
} {
  // Load parties
  const parties = loadAllParties(vaultPath);
  const party1 = parties.find(p => p.id === partyId1);
  const party2 = parties.find(p => p.id === partyId2);

  if (!party1 || !party2) {
    return {
      should_merge: false,
      confidence: 0,
      reasons: []
    };
  }

  // Use the existing matching engine to compare
  const result = findMatchingParties(vaultPath, {
    name: party2.name || party2.canonical_name
  }, {
    min_confidence: 0.70,
    include_low_confidence: true
  });

  const match = result.candidates.find(c => c.party_id === partyId1);

  if (match) {
    return {
      should_merge: match.confidence_score >= 0.85,
      confidence: match.confidence_score,
      reasons: match.match_reasons
    };
  }

  return {
    should_merge: false,
    confidence: 0,
    reasons: []
  };
}

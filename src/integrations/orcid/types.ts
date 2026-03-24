// ORCID API response types
export interface ORCIDPerson {
  'orcid-identifier': {
    path: string; // "0000-0002-1234-5678"
  };
  name: {
    'given-names': { value: string };
    'family-name': { value: string };
  };
  emails: {
    email: Array<{ email: string; verified: boolean }>;
  };
}

export interface ORCIDWork {
  'put-code': number;
  title: { title: { value: string } };
  'journal-title': { value: string };
  'publication-date': {
    year: { value: string };
    month: { value: string };
  };
  'external-ids': {
    'external-id': Array<{
      'external-id-type': string; // "doi", "pmid"
      'external-id-value': string;
    }>;
  };
}

export interface ORCIDProfile {
  orcid: string;
  name: string;
  email: string | null;
  affiliations: string[];
  works: ORCIDWork[];
  verified: boolean;
}

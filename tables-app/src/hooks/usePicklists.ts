import { useState, useEffect } from 'react';

interface PicklistValue {
  value: string;
  label: string;
  default?: boolean;
  probability?: number;
}

interface PicklistDefinition {
  type: 'standard' | 'multi-select' | 'dependent';
  restricted: boolean;
  label: string;
  values: PicklistValue[];
}

interface PicklistsMap {
  [entityType: string]: {
    [field: string]: PicklistDefinition;
  };
}

const API_BASE_URL = 'http://localhost:9600';

export function usePicklists() {
  const [picklists, setPicklists] = useState<PicklistsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/picklists`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load picklists');
        }
        return res.json();
      })
      .then(data => {
        setPicklists(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading picklists:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { picklists, loading, error };
}

export function useEntityPicklists(entityType: string) {
  const [picklists, setPicklists] = useState<Record<string, PicklistDefinition> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/picklists/${entityType}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load picklists for ${entityType}`);
        }
        return res.json();
      })
      .then(data => {
        setPicklists(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(`Error loading picklists for ${entityType}:`, err);
        setError(err.message);
        setLoading(false);
      });
  }, [entityType]);

  return { picklists, loading, error };
}

export function useFieldPicklist(entityType: string, field: string) {
  const [picklist, setPicklist] = useState<PicklistDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/picklists/${entityType}/${field}`)
      .then(res => {
        if (!res.ok) {
          // Field might not be a picklist - that's okay
          if (res.status === 404) {
            setPicklist(null);
            setLoading(false);
            return null;
          }
          throw new Error(`Failed to load picklist for ${entityType}.${field}`);
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setPicklist(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(`Error loading picklist for ${entityType}.${field}:`, err);
        setError(err.message);
        setLoading(false);
      });
  }, [entityType, field]);

  return { picklist, loading, error };
}

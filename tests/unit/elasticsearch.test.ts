import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@elastic/elasticsearch';

// Mock the Elasticsearch client
vi.mock('@elastic/elasticsearch', () => {
  const mockIndices = {
    exists: vi.fn(),
    create: vi.fn(),
  };

  const mockCluster = {
    health: vi.fn(),
  };

  const MockClient = vi.fn().mockImplementation(() => ({
    indices: mockIndices,
    cluster: mockCluster,
    index: vi.fn(),
    search: vi.fn(),
    delete: vi.fn(),
  }));

  return {
    Client: MockClient,
  };
});

// Import after mocking
import {
  esClient,
  initializeIndex,
  indexDocument,
  searchDocuments,
  deleteDocument,
  checkHealth
} from '../../src/lib/elasticsearch.js';

describe('Elasticsearch Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('esClient', () => {
    it('should create an Elasticsearch client', () => {
      expect(esClient).toBeDefined();
      expect(esClient.indices).toBeDefined();
      expect(esClient.cluster).toBeDefined();
    });
  });

  describe('initializeIndex', () => {
    it('should create index if it does not exist', async () => {
      const mockIndices = esClient.indices as any;
      mockIndices.exists.mockResolvedValue(false);
      mockIndices.create.mockResolvedValue({ acknowledged: true });

      await initializeIndex();

      expect(mockIndices.exists).toHaveBeenCalledWith({ index: 'crm-vault' });
      expect(mockIndices.create).toHaveBeenCalled();
    });

    it('should not create index if it already exists', async () => {
      const mockIndices = esClient.indices as any;
      mockIndices.exists.mockResolvedValue(true);

      await initializeIndex();

      expect(mockIndices.exists).toHaveBeenCalledWith({ index: 'crm-vault' });
      expect(mockIndices.create).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const mockIndices = esClient.indices as any;
      mockIndices.exists.mockRejectedValue(new Error('Connection failed'));

      await expect(initializeIndex()).rejects.toThrow('Connection failed');
    });
  });

  describe('indexDocument', () => {
    it('should index a document successfully', async () => {
      const mockIndex = esClient.index as any;
      mockIndex.mockResolvedValue({ _id: 'doc123', result: 'created' });

      const doc = {
        id: 'acc_123',
        type: 'account',
        name: 'Test Account',
        path: 'accounts/test-account.md',
        content: 'Account content here',
        frontmatter: { industry: 'Technology' }
      };

      await indexDocument(doc);

      expect(mockIndex).toHaveBeenCalled();
      const callArgs = mockIndex.mock.calls[0][0];
      expect(callArgs.index).toBe('crm-vault');
      expect(callArgs.id).toBe('acc_123');
      expect(callArgs.document.name).toBe('Test Account');
      expect(callArgs.document.updated_at).toBeDefined();
    });

    it('should throw error on indexing failure', async () => {
      const mockIndex = esClient.index as any;
      mockIndex.mockRejectedValue(new Error('Index error'));

      const doc = {
        id: 'acc_123',
        type: 'account',
        name: 'Test Account',
        path: 'accounts/test-account.md',
        content: 'Content'
      };

      await expect(indexDocument(doc)).rejects.toThrow('Index error');
    });
  });

  describe('searchDocuments', () => {
    it('should search documents with default options', async () => {
      const mockSearch = esClient.search as any;
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: 'doc1',
              _score: 1.5,
              _source: {
                name: 'Test Document',
                type: 'account',
                content: 'Some content here'
              },
              highlight: {
                content: ['<em>Test</em> content']
              }
            },
            {
              _id: 'doc2',
              _score: 1.2,
              _source: {
                name: 'Another Document',
                type: 'contact',
                content: 'More content'
              }
            }
          ]
        }
      });

      const result = await searchDocuments('test query');

      expect(mockSearch).toHaveBeenCalled();
      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('doc1');
      expect(result.results[0].score).toBe(1.5);
      expect(result.results[0].snippet).toContain('<em>Test</em>');
    });

    it('should respect pagination options', async () => {
      const mockSearch = esClient.search as any;
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 100 },
          hits: []
        }
      });

      await searchDocuments('test', { from: 10, size: 20 });

      const callArgs = mockSearch.mock.calls[0][0];
      expect(callArgs.from).toBe(10);
      expect(callArgs.size).toBe(20);
    });

    it('should handle total as number', async () => {
      const mockSearch = esClient.search as any;
      mockSearch.mockResolvedValue({
        hits: {
          total: 5,
          hits: []
        }
      });

      const result = await searchDocuments('test');

      expect(result.total).toBe(5);
    });

    it('should use content substring as snippet fallback', async () => {
      const mockSearch = esClient.search as any;
      const longContent = 'A'.repeat(200);
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'doc1',
              _score: 1.0,
              _source: {
                name: 'Test',
                content: longContent
              }
            }
          ]
        }
      });

      const result = await searchDocuments('test');

      expect(result.results[0].snippet).toHaveLength(150);
    });

    it('should throw error on search failure', async () => {
      const mockSearch = esClient.search as any;
      mockSearch.mockRejectedValue(new Error('Search error'));

      await expect(searchDocuments('test')).rejects.toThrow('Search error');
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document successfully', async () => {
      const mockDelete = esClient.delete as any;
      mockDelete.mockResolvedValue({ result: 'deleted' });

      await deleteDocument('doc123');

      expect(mockDelete).toHaveBeenCalledWith({
        index: 'crm-vault',
        id: 'doc123'
      });
    });

    it('should throw error on deletion failure', async () => {
      const mockDelete = esClient.delete as any;
      mockDelete.mockRejectedValue(new Error('Delete error'));

      await expect(deleteDocument('doc123')).rejects.toThrow('Delete error');
    });
  });

  describe('checkHealth', () => {
    it('should return health status', async () => {
      const mockCluster = esClient.cluster as any;
      const healthStatus = {
        cluster_name: 'test-cluster',
        status: 'green',
        number_of_nodes: 1
      };
      mockCluster.health.mockResolvedValue(healthStatus);

      const result = await checkHealth();

      expect(mockCluster.health).toHaveBeenCalled();
      expect(result).toEqual(healthStatus);
    });

    it('should return null on health check failure', async () => {
      const mockCluster = esClient.cluster as any;
      mockCluster.health.mockRejectedValue(new Error('Connection error'));

      const result = await checkHealth();

      expect(result).toBeNull();
    });
  });
});

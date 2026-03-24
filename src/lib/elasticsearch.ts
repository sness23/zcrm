import { Client } from '@elastic/elasticsearch';

const ES_HOST = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = 'crm-vault';

// Create Elasticsearch client
export const esClient = new Client({
  node: ES_HOST,
});

/**
 * Initialize the Elasticsearch index with mapping
 */
export async function initializeIndex() {
  try {
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            name: { type: 'text' },
            path: { type: 'keyword' },
            content: { type: 'text' },
            frontmatter: { type: 'object', enabled: false },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
          },
        },
      });
      console.log(`Created index: ${INDEX_NAME}`);
    }
  } catch (error) {
    console.error('Error initializing Elasticsearch index:', error);
    throw error;
  }
}

/**
 * Index a single document
 */
export async function indexDocument(doc: {
  id: string;
  type: string;
  name: string;
  path: string;
  content: string;
  frontmatter?: any;
}) {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: doc.id,
      document: {
        ...doc,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error indexing document:', error);
    throw error;
  }
}

/**
 * Search documents
 */
export async function searchDocuments(query: string, options: { from?: number; size?: number } = {}) {
  try {
    const { from = 0, size = 50 } = options;

    const result = await esClient.search({
      index: INDEX_NAME,
      from,
      size,
      query: {
        multi_match: {
          query,
          fields: ['name^3', 'content'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      },
      highlight: {
        fields: {
          content: {
            fragment_size: 150,
            number_of_fragments: 1,
          },
          name: {},
        },
      },
    });

    return {
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0,
      results: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        snippet: hit.highlight?.content?.[0] || hit.highlight?.name?.[0] || hit._source.content?.substring(0, 150),
      })),
    };
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string) {
  try {
    await esClient.delete({
      index: INDEX_NAME,
      id,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

/**
 * Check Elasticsearch health
 */
export async function checkHealth() {
  try {
    const health = await esClient.cluster.health();
    return health;
  } catch (error) {
    console.error('Error checking Elasticsearch health:', error);
    return null;
  }
}

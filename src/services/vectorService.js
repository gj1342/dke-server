import { getCollection, getChromaClient } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/app.js';

const toPrimitiveMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      out[key] = value.map(v => (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ? v : JSON.stringify(v)).join(',');
    } else {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
};

export class VectorService {
  constructor() {
    this.collection = null;
    this.client = null;
    this.cleanupTimer = null;
  }

  async initialize() {
    try {
      this.collection = await getCollection();
      this.client = getChromaClient();
      logger.info('Vector service initialized');
      this.startCleanupJob();
    } catch (error) {
      logger.error('Failed to initialize vector service', { error: error.message });
      throw error;
    }
  }

  startCleanupJob() {
    if (this.cleanupTimer) return;
    const intervalMs = (config.retention.cleanupIntervalMinutes || 60) * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.deleteExpiredChunks().catch(e => logger.warn('Cleanup job failed', { error: e.message })), intervalMs);
  }

  async deleteExpiredChunks() {
    if (!this.collection) return;
    const nowIso = new Date().toISOString();
    logger.info('Running retention cleanup', { now: nowIso });
    try {
      await this.collection.delete({ where: { expiresAt: { $lt: nowIso } } });
      logger.info('Retention cleanup completed');
    } catch (error) {
      logger.warn('Retention cleanup error', { error: error.message });
    }
  }

  async addDocuments(documents) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!Array.isArray(documents) || documents.length === 0) {
        throw new Error('Documents must be a non-empty array');
      }

      logger.info('Adding documents to vector database', { count: documents.length });

      const ids = [];
      const embeddings = [];
      const metadatas = [];
      const documents_text = [];

      for (const doc of documents) {
        if (!doc.id || !doc.embedding || !doc.text) {
          throw new Error('Document must have id, embedding, and text');
        }

        ids.push(doc.id);
        embeddings.push(doc.embedding);
        metadatas.push(toPrimitiveMetadata({
          text: doc.text,
          source: doc.source || 'unknown',
          timestamp: doc.timestamp || new Date().toISOString(),
          ...doc.metadata
        }));
        documents_text.push(doc.text);
      }

      const result = await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents: documents_text
      });

      logger.info('Documents added successfully', { 
        count: documents.length, 
        result: result 
      });

      return result;
    } catch (error) {
      logger.error('Failed to add documents', { 
        error: error.message, 
        documentCount: documents?.length 
      });
      throw error;
    }
  }

  async searchSimilar(queryEmbedding, maxResults = 5, filter = null) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        throw new Error('Query embedding must be a non-empty array');
      }

      const nowMs = Date.now();
      const where = { expiresAtMs: { $gt: nowMs }, ...(filter || {}) };

      logger.info('Searching for similar documents', { 
        maxResults, 
        filter: Object.keys(where).length ? 'with filter' : 'no filter' 
      });

      const searchParams = {
        queryEmbeddings: [queryEmbedding],
        nResults: maxResults,
        where
      };

      const results = await this.collection.query(searchParams);

      if (!results || !results.documents || !results.documents[0]) {
        logger.warn('No search results found');
        return [];
      }

      const documents = results.documents[0];
      const metadatas = results.metadatas[0];
      const distances = results.distances[0];
      const ids = results.ids[0];

      const searchResults = documents.map((doc, index) => ({
        id: ids[index],
        text: doc,
        metadata: metadatas[index],
        distance: distances[index],
        relevance: 1 - distances[index]
      }));

      logger.info('Search completed successfully', { 
        resultsCount: searchResults.length,
        averageRelevance: searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length
      });

      return searchResults;
    } catch (error) {
      logger.error('Failed to search similar documents', { 
        error: error.message, 
        maxResults 
      });
      throw error;
    }
  }

  async getDocument(id) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!id) {
        throw new Error('Document ID is required');
      }

      logger.debug('Retrieving document', { id });

      const result = await this.collection.get({
        ids: [id]
      });

      if (!result.documents || result.documents.length === 0) {
        logger.warn('Document not found', { id });
        return null;
      }

      const document = {
        id: result.ids[0],
        text: result.documents[0],
        metadata: result.metadatas[0]
      };

      logger.debug('Document retrieved successfully', { id });
      return document;
    } catch (error) {
      logger.error('Failed to retrieve document', { error: error.message, id });
      throw error;
    }
  }

  async getAllDocuments() {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      logger.debug('Retrieving all documents from collection');

      const count = await this.collection.count();
      
      if (count === 0) {
        return [];
      }

      const results = await this.collection.get({
        limit: count
      });

      if (!results.documents || results.documents.length === 0) {
        return [];
      }

      const documents = results.documents.map((doc, index) => ({
        id: results.ids[index],
        text: doc,
        metadata: results.metadatas[index] || {}
      }));

      logger.debug('All documents retrieved successfully', { count: documents.length });
      return documents;

    } catch (error) {
      logger.error('Failed to retrieve all documents', { error: error.message });
      throw error;
    }
  }

  async deleteMultipleDocuments(ids) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Document IDs must be a non-empty array');
      }

      logger.info('Deleting multiple documents', { count: ids.length });

      const result = await this.collection.delete({
        ids: ids
      });

      logger.info('Multiple documents deleted successfully', { 
        count: ids.length, 
        result 
      });

      return result;

    } catch (error) {
      logger.error('Failed to delete multiple documents', { 
        error: error.message, 
        count: ids?.length 
      });
      throw error;
    }
  }

  async updateDocument(id, updates) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!id || !updates) {
        throw new Error('Document ID and updates are required');
      }

      logger.info('Updating document', { id, updateFields: Object.keys(updates) });

      const updateParams = {
        ids: [id]
      };

      if (updates.text) {
        updateParams.documents = [updates.text];
      }

      if (updates.metadata) {
        updateParams.metadatas = [toPrimitiveMetadata(updates.metadata)];
      }

      if (updates.embedding) {
        updateParams.embeddings = [updates.embedding];
      }

      const result = await this.collection.update(updateParams);

      logger.info('Document updated successfully', { id, result });
      return result;
    } catch (error) {
      logger.error('Failed to update document', { error: error.message, id });
      throw error;
    }
  }

  async deleteDocument(id) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!id) {
        throw new Error('Document ID is required');
      }

      logger.info('Deleting document', { id });

      const result = await this.collection.delete({
        ids: [id]
      });

      logger.info('Document deleted successfully', { id, result });
      return result;
    } catch (error) {
      logger.error('Failed to delete document', { error: error.message, id });
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      const count = await this.collection.count();
      
      logger.debug('Collection stats retrieved', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to get collection stats', { error: error.message });
      throw error;
    }
  }

  async clearCollection() {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      logger.warn('Clearing entire collection');

      const result = await this.collection.delete({
        where: {}
      });

      logger.info('Collection cleared successfully', { result });
      return result;
    } catch (error) {
      logger.error('Failed to clear collection', { error: error.message });
      throw error;
    }
  }
}

export const vectorService = new VectorService();

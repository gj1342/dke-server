import { getMistralClient, aiConfig } from '../config/ai.js';
import { embeddingService } from './embeddingService.js';
import { vectorService } from './vectorService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/app.js';

export class RAGService {
  constructor() {
    this.mistralClient = null;
    this.model = aiConfig.mistral.model;
    this.maxTokens = aiConfig.mistral.maxTokens;
    this.temperature = aiConfig.mistral.temperature;
    this.performanceMetrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalTokensUsed: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      lastQueryTime: null,
      startTime: new Date().toISOString()
    };
    this.queryHistory = new Map();
    this.historyTTL = 30 * 24 * 60 * 60 * 1000;
  }

  isRetryableError(error) {
    if (!error || !error.message) return false;
    const msg = String(error.message).toLowerCase();
    const retryableSnippets = [
      'timeout',
      'timed out',
      'rate limit',
      'too many requests',
      'ecconnreset',
      'socket hang up',
      'network',
      'service unavailable',
      'gateway timeout',
      'bad gateway',
      'temporary',
      'fetch failed'
    ];
    return retryableSnippets.some(s => msg.includes(s));
  }

  async initialize() {
    try {
      this.mistralClient = getMistralClient();
      logger.info('RAG service initialized', { model: this.model });
    } catch (error) {
      logger.error('Failed to initialize RAG service', { error: error.message });
      throw error;
    }
  }

  async processQuery(query, maxResults = 5, includeMetadata = false) {
    const startTime = Date.now();
    const maxRetries = 3;
    let attempt = 0;
    const { documentId } = typeof query === 'object' ? query : (arguments[3] || {});
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        logger.info('Processing RAG query', { 
          query: query.substring(0, 100), 
          maxResults, 
          attempt,
          ...(documentId && { documentId })
        });

        if (!this.mistralClient) {
          await this.initialize();
        }

        if (!query || typeof query !== 'string') {
          throw new Error('Query must be a non-empty string');
        }

        const queryEmbedding = await this.generateEmbeddingWithRetry(query, maxRetries);
        
        if (!queryEmbedding || queryEmbedding.length === 0) {
          throw new Error('Failed to generate query embedding');
        }

        logger.debug('Query embedding generated', { embeddingLength: queryEmbedding.length });

        const whereFilter = documentId ? { documentId } : null;
        const searchResults = await this.searchDocumentsWithRetryWithFilter(queryEmbedding, maxResults, maxRetries, whereFilter);
        
        if (!searchResults || searchResults.length === 0) {
          logger.warn('No relevant documents found for query', { query: query.substring(0, 100) });
          return {
            query,
            answer: 'I could not find any relevant information to answer your question.',
            sources: [],
            confidence: 0,
            processingTime: Date.now() - startTime
          };
        }

        logger.info('Relevant documents found', { 
          resultCount: searchResults.length,
          averageRelevance: searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length
        });

        const context = this.prepareContext(searchResults, includeMetadata);
        
        const aiResponse = await this.generateResponseWithRetry(query, context, searchResults, maxRetries);
        
        const processingTime = Date.now() - startTime;
        
        const result = {
          query,
          answer: aiResponse.answer,
          sources: this.formatSources(searchResults, includeMetadata),
          confidence: aiResponse.confidence,
          processingTime,
          metadata: {
            documentsRetrieved: searchResults.length,
            totalTokensUsed: aiResponse.tokensUsed,
            model: this.model,
            attempts: attempt,
            ...(documentId && { scopedDocumentId: documentId })
          }
        };

        logger.info('RAG query processed successfully', {
          query: query.substring(0, 100),
          processingTime,
          answerLength: aiResponse.answer.length,
          sourcesCount: searchResults.length,
          attempts: attempt
        });

        this.saveQueryHistory(query, result, processingTime);
        this.updatePerformanceMetrics(result, processingTime, true);
        return result;

      } catch (error) {
        const processingTime = Date.now() - startTime;
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn('RAG query failed, retrying', {
            query: query?.substring(0, 100),
            error: error.message,
            attempt,
            maxRetries,
            delay,
            processingTime
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        logger.error('RAG query processing failed permanently', {
          query: query?.substring(0, 100),
          error: error.message,
          attempts: attempt,
          processingTime
        });

        throw error;
      }
    }
  }

  async generateEmbeddingWithRetry(text, maxRetries = 3) {
    let lastError;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        return await embeddingService.generateEmbedding(text);
      } catch (error) {
        lastError = error;
        if (i < maxRetries && this.isRetryableError(error)) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  async searchDocumentsWithRetryWithFilter(queryEmbedding, maxResults, maxRetries = 3, whereFilter = null) {
    let lastError;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        return await vectorService.searchSimilar(queryEmbedding, maxResults, whereFilter);
      } catch (error) {
        lastError = error;
        if (i < maxRetries && this.isRetryableError(error)) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  async generateResponseWithRetry(query, context, searchResults, maxRetries = 3) {
    let lastError;
    for (let i = 1; i <= maxRetries; i++) {
      try {
        return await this.generateResponse(query, context, searchResults);
      } catch (error) {
        lastError = error;
        if (i < maxRetries && this.isRetryableError(error)) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  prepareContext(searchResults, includeMetadata = false) {
    try {
      let context = 'Based on the following information:\n\n';
      
      searchResults.forEach((result, index) => {
        context += `Source ${index + 1}:\n${result.text}\n\n`;
        
        if (includeMetadata && result.metadata) {
          context += `Metadata: ${JSON.stringify(result.metadata)}\n\n`;
        }
      });

      context += 'Please answer the question using only the information provided above. If the information is not sufficient to answer the question, please say so.';

      return context;
    } catch (error) {
      logger.error('Failed to prepare context', { error: error.message });
      throw error;
    }
  }

  async generateResponse(query, context, searchResults) {
    try {
      const prompt = this.buildPrompt(query, context);
      
      logger.debug('Generating AI response', { 
        promptLength: prompt.length,
        model: this.model 
      });

      let response;
      if (this.mistralClient && this.mistralClient.chat && typeof this.mistralClient.chat.complete === 'function') {
        response = await this.mistralClient.chat.complete({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant that answers questions based on provided context. Always cite your sources and be accurate.' },
            { role: 'user', content: prompt }
          ],
          maxTokens: this.maxTokens,
          temperature: this.temperature
        });
      } else if (this.mistralClient && typeof this.mistralClient.chat === 'function') {
        response = await this.mistralClient.chat({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant that answers questions based on provided context. Always cite your sources and be accurate.' },
            { role: 'user', content: prompt }
          ],
          maxTokens: this.maxTokens,
          temperature: this.temperature
        });
      } else {
        throw new Error('Mistral client does not support chat API');
      }

      let answer = '';
      let tokensUsed = 0;

      if (response) {
        if (typeof response.output_text === 'string') {
          answer = response.output_text;
        } else if (Array.isArray(response.choices) && response.choices[0]?.message?.content) {
          answer = response.choices[0].message.content;
        } else if (response.message?.content) {
          answer = response.message.content;
        } else if (response.output && Array.isArray(response.output) && response.output[0]?.content) {
          // Some SDKs return output array with content
          answer = response.output[0].content;
        }
        tokensUsed = response.usage?.totalTokens || response.usage?.total_tokens || 0;
      }

      if (!answer || typeof answer !== 'string') {
        throw new Error('Invalid response from Mistral AI');
      }
      
      const averageRelevance = searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length;
      const confidence = Math.min(averageRelevance * 0.8 + 0.2, 1.0);

      logger.debug('AI response generated', { 
        answerLength: answer.length,
        tokensUsed,
        confidence 
      });

      return {
        answer,
        confidence,
        tokensUsed
      };

    } catch (error) {
      logger.error('Failed to generate AI response', { error: error.message });
      throw error;
    }
  }

  buildPrompt(query, context) {
    return `Question: ${query}

${context}

Please provide a comprehensive answer based on the sources above. If you need to reference specific sources, mention them by number (e.g., "According to Source 1..."). If the information provided is insufficient to answer the question, please state that clearly.

Answer:`;
  }

  formatSources(searchResults, includeMetadata = false) {
    return searchResults.map((result, index) => ({
      id: result.id,
      source: result.metadata?.source || 'Unknown',
      relevance: result.relevance,
      text: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''),
      ...(includeMetadata && { metadata: result.metadata })
    }));
  }

  async batchProcessQueries(queries, maxResults = 5) {
    try {
      logger.info('Starting batch RAG processing', { queryCount: queries.length });

      const results = [];
      const batchSize = 3;

      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queries.length / batchSize)}`, {
          batchSize: batch.length,
          totalProcessed: i
        });

        const batchResults = await Promise.allSettled(
          batch.map(query => this.processQuery(query, maxResults))
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Batch RAG processing failed for query', {
              query: batch[index],
              error: result.reason.message
            });
            results.push({
              query: batch[index],
              status: 'failed',
              error: result.reason.message
            });
          }
        });

        if (i + batchSize < queries.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successCount = results.filter(r => r.status !== 'failed').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      logger.info('Batch RAG processing completed', {
        totalQueries: queries.length,
        successCount,
        failureCount
      });

      return results;

    } catch (error) {
      logger.error('Batch RAG processing failed', {
        error: error.message,
        queryCount: queries.length
      });
      throw error;
    }
  }

  async getQueryHistory(limit = 50) {
    try {
      logger.debug('Query history requested', { limit });
      
      this.cleanupExpiredHistory();
      
      const historyEntries = Array.from(this.queryHistory.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      
      logger.debug('Query history retrieved', { 
        requested: limit, 
        returned: historyEntries.length,
        total: this.queryHistory.size 
      });
      
      return {
        queries: historyEntries,
        total: this.queryHistory.size,
        limit: limit,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Failed to retrieve query history', { error: error.message });
      throw error;
    }
  }

  saveQueryHistory(query, result, processingTime) {
    try {
      const historyEntry = {
        id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: query.substring(0, 200),
        answer: result.answer.substring(0, 500),
        sources: result.sources.length,
        confidence: result.confidence,
        processingTime,
        timestamp: new Date().toISOString(),
        model: this.model,
        tokensUsed: result.metadata?.totalTokensUsed || 0
      };
      
      this.queryHistory.set(historyEntry.id, historyEntry);
      
      if (this.queryHistory.size > 1000) {
        const oldestKey = this.queryHistory.keys().next().value;
        this.queryHistory.delete(oldestKey);
      }
      
      logger.debug('Query history saved', { 
        id: historyEntry.id, 
        queryLength: query.length 
      });
      
    } catch (error) {
      logger.warn('Failed to save query history', { error: error.message });
    }
  }

  cleanupExpiredHistory() {
    try {
      const now = Date.now();
      const expiredKeys = [];
      
      for (const [key, entry] of this.queryHistory.entries()) {
        const entryAge = now - new Date(entry.timestamp).getTime();
        if (entryAge > this.historyTTL) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach(key => this.queryHistory.delete(key));
      
      if (expiredKeys.length > 0) {
        logger.debug('Cleaned up expired query history', { 
          expiredCount: expiredKeys.length,
          remainingCount: this.queryHistory.size 
        });
      }
      
    } catch (error) {
      logger.warn('Failed to cleanup expired history', { error: error.message });
    }
  }

  updatePerformanceMetrics(result, processingTime, success = true) {
    try {
      this.performanceMetrics.totalQueries++;
      this.performanceMetrics.lastQueryTime = new Date().toISOString();
      
      if (success) {
        this.performanceMetrics.successfulQueries++;
        this.performanceMetrics.totalTokensUsed += result.metadata?.totalTokensUsed || 0;
        
        const currentAvg = this.performanceMetrics.averageProcessingTime;
        const newAvg = (currentAvg * (this.performanceMetrics.successfulQueries - 1) + processingTime) / this.performanceMetrics.successfulQueries;
        this.performanceMetrics.averageProcessingTime = Math.round(newAvg);
        
        const currentConfAvg = this.performanceMetrics.averageConfidence;
        const newConfAvg = (currentConfAvg * (this.performanceMetrics.successfulQueries - 1) + result.confidence) / this.performanceMetrics.successfulQueries;
        this.performanceMetrics.averageConfidence = Math.round(newConfAvg * 100) / 100;
      } else {
        this.performanceMetrics.failedQueries++;
      }
      
      logger.debug('Performance metrics updated', { 
        totalQueries: this.performanceMetrics.totalQueries,
        successRate: (this.performanceMetrics.successfulQueries / this.performanceMetrics.totalQueries * 100).toFixed(2) + '%'
      });
      
    } catch (error) {
      logger.warn('Failed to update performance metrics', { error: error.message });
    }
  }

  async getRAGStats() {
    try {
      const vectorStats = await vectorService.getCollectionStats();
      const embeddingStats = embeddingService.getCacheStats();
      
      const successRate = this.performanceMetrics.totalQueries > 0 
        ? (this.performanceMetrics.successfulQueries / this.performanceMetrics.totalQueries * 100).toFixed(2)
        : 0;

      return {
        vectorDatabase: {
          totalDocuments: vectorStats.count,
          collectionName: config.chroma.collectionName
        },
        embeddings: {
          cacheSize: embeddingStats.size,
          model: embeddingStats.model
        },
        ai: {
          model: this.model,
          maxTokens: this.maxTokens,
          temperature: this.temperature
        },
        performance: {
          totalQueries: this.performanceMetrics.totalQueries,
          successfulQueries: this.performanceMetrics.successfulQueries,
          failedQueries: this.performanceMetrics.failedQueries,
          successRate: `${successRate}%`,
          averageProcessingTime: `${this.performanceMetrics.averageProcessingTime}ms`,
          totalTokensUsed: this.performanceMetrics.totalTokensUsed,
          averageConfidence: this.performanceMetrics.averageConfidence,
          lastQueryTime: this.performanceMetrics.lastQueryTime,
          uptime: new Date().toISOString(),
          startTime: this.performanceMetrics.startTime
        },
        queryHistory: {
          totalEntries: this.queryHistory.size,
          ttl: `${this.historyTTL / (1000 * 60 * 60)} hours`
        }
      };
    } catch (error) {
      logger.error('Failed to get RAG stats', { error: error.message });
      throw error;
    }
  }

  async clearHistory() {
    try {
      logger.info('Clearing RAG query history and resetting metrics');
      
      this.queryHistory.clear();
      this.performanceMetrics = {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        totalTokensUsed: 0,
        averageProcessingTime: 0,
        averageConfidence: 0,
        lastQueryTime: null,
        startTime: new Date().toISOString()
      };
      
      logger.info('RAG history cleared successfully');
      return { success: true, message: 'History and metrics reset' };
    } catch (error) {
      logger.error('Failed to clear RAG history', { error: error.message });
      throw error;
    }
  }
}

export const ragService = new RAGService();

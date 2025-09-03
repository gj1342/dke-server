import { getHuggingfaceClient, aiConfig } from '../config/ai.js';
import { logger } from '../utils/logger.js';

export class EmbeddingService {
  constructor() {
    this.client = null;
    this.model = aiConfig.huggingface.embeddingModel;
    this.maxLength = aiConfig.huggingface.maxLength;
    this.embeddingCache = new Map();
  }

  async initialize() {
    try {
      this.client = getHuggingfaceClient();
      logger.info('Embedding service initialized', { model: this.model });
    } catch (error) {
      logger.error('Failed to initialize embedding service', { error: error.message });
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      const cleanedText = this.cleanText(text);
      
      if (cleanedText.length === 0) {
        throw new Error('Text is empty after cleaning');
      }

      const cacheKey = this.generateCacheKey(cleanedText);
      if (this.embeddingCache.has(cacheKey)) {
        logger.debug('Embedding retrieved from cache', { textLength: cleanedText.length });
        return this.embeddingCache.get(cacheKey);
      }

      const truncatedText = this.truncateText(cleanedText);
      
      logger.debug('Generating embedding', {
        originalLength: cleanedText.length,
        truncatedLength: truncatedText.length,
        model: this.model
      });

      const maxRetries = 3;
      let lastError;
      let response = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await this.client.featureExtraction({
            model: this.model,
            inputs: truncatedText,
            wait_for_model: true
          });
          break;
        } catch (error) {
          lastError = error;
          const msg = String(error?.message || '').toLowerCase();
          const retryable = msg.includes('timeout') || msg.includes('rate') || msg.includes('429') || msg.includes('network') || msg.includes('http error') || msg.includes('fetch');
          if (attempt < maxRetries && retryable) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
            continue;
          }
          throw error;
        }
      }

      let embedding = Array.isArray(response?.[0]) ? response[0] : response;

      if (!Array.isArray(embedding) || embedding.length === 0 || typeof embedding[0] !== 'number') {
        throw new Error('Generated embedding is invalid');
      }

      this.embeddingCache.set(cacheKey, embedding);
      
      if (this.embeddingCache.size > 1000) {
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
      }

      logger.info('Embedding generated successfully', { 
        textLength: cleanedText.length, 
        embeddingLength: embedding.length 
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { 
        error: error.message, 
        textLength: text?.length 
      });
      throw error;
    }
  }

  async generateEmbeddings(texts) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts must be a non-empty array');
      }

      logger.info('Generating embeddings for multiple texts', { count: texts.length });

      const embeddings = [];
      const batchSize = 5;

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);

        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info('Batch embeddings generated successfully', { 
        totalCount: texts.length, 
        batchCount: Math.ceil(texts.length / batchSize) 
      });

      return embeddings;
    } catch (error) {
      logger.error('Failed to generate batch embeddings', { 
        error: error.message, 
        textCount: texts.length 
      });
      throw error;
    }
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim();
  }

  truncateText(text) {
    if (text.length <= this.maxLength) {
      return text;
    }
    
    const sentences = text.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= this.maxLength) {
        truncated += sentence + '.';
      } else {
        break;
      }
    }
    
    if (truncated.length === 0) {
      const words = text.split(' ');
      for (const word of words) {
        if ((truncated + word + ' ').length <= this.maxLength) {
          truncated += word + ' ';
        } else {
          break;
        }
      }
      truncated = truncated.trim();
    }
    
    return truncated || text.substring(0, this.maxLength);
  }

  generateCacheKey(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  clearCache() {
    this.embeddingCache.clear();
    logger.info('Embedding cache cleared');
  }

  getCacheStats() {
    return {
      size: this.embeddingCache.size,
      model: this.model,
      maxLength: this.maxLength
    };
  }
}

export const embeddingService = new EmbeddingService();

import { ragService } from '../services/ragService.js';
import { logger } from '../utils/logger.js';

export const queryRAG = async (req, res) => {
  try {
    const { query, maxResults = 5, includeMetadata = false } = req.body;
    
    logger.info('RAG query request received', { 
      query: query?.substring(0, 100), 
      maxResults, 
      includeMetadata 
    });

    const result = await ragService.processQuery(query, maxResults, includeMetadata);
    
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('RAG query failed', { 
      error: error.message, 
      query: req.body?.query?.substring(0, 100) 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process RAG query',
      message: error.message
    });
  }
};

export const batchQueryRAG = async (req, res) => {
  try {
    const { queries, maxResults = 5 } = req.body;
    
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid queries',
        message: 'Queries must be a non-empty array'
      });
    }

    if (queries.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Too many queries',
        message: 'Maximum 10 queries allowed per batch'
      });
    }

    logger.info('Batch RAG query request received', { 
      queryCount: queries.length, 
      maxResults 
    });

    const results = await ragService.batchProcessQueries(queries, maxResults);
    
    res.status(200).json({
      success: true,
      data: {
        results,
        summary: {
          total: queries.length,
          successful: results.filter(r => r.status !== 'failed').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      }
    });

  } catch (error) {
    logger.error('Batch RAG query failed', { 
      error: error.message, 
      queryCount: req.body?.queries?.length 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process batch RAG queries',
      message: error.message
    });
  }
};

export const getRAGStats = async (req, res) => {
  try {
    logger.info('RAG stats request');

    const stats = await ragService.getRAGStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('RAG stats retrieval failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RAG stats',
      message: error.message
    });
  }
};

export const getQueryHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    logger.info('Query history request', { limit });

    const history = await ragService.getQueryHistory(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Query history retrieval failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve query history',
      message: error.message
    });
  }
};

export const clearHistory = async (req, res) => {
  try {
    logger.info('Clear RAG history request');

    const result = await ragService.clearHistory();
    
    res.status(200).json({
      success: true,
      message: 'RAG history cleared successfully',
      data: result
    });

  } catch (error) {
    logger.error('Clear RAG history failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to clear RAG history',
      message: error.message
    });
  }
};

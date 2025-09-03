import { logger } from '../utils/logger.js';

export const validateRAGQuery = (req, res, next) => {
  const { query, maxResults = 5, documentId } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Invalid query',
      message: 'Query must be a non-empty string'
    });
  }
  
  if (query.trim().length < 3) {
    return res.status(400).json({
      error: 'Query too short',
      message: 'Query must be at least 3 characters long'
    });
  }
  
  if (query.length > 1000) {
    return res.status(400).json({
      error: 'Query too long',
      message: 'Query must be less than 1000 characters'
    });
  }
  
  if (maxResults && (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 20)) {
    return res.status(400).json({
      error: 'Invalid maxResults',
      message: 'maxResults must be a number between 1 and 20'
    });
  }

  if (documentId && typeof documentId !== 'string') {
    return res.status(400).json({
      error: 'Invalid documentId',
      message: 'documentId must be a string'
    });
  }
  
  req.body.query = query.trim();
  req.body.maxResults = Math.min(Math.max(parseInt(maxResults) || 5, 1), 20);
  if (documentId) req.body.documentId = documentId.trim();
  
  logger.debug('RAG query validation passed', { 
    query: req.body.query, 
    maxResults: req.body.maxResults,
    ...(req.body.documentId && { documentId: req.body.documentId })
  });
  
  next();
};

export const validateDocumentMetadata = (req, res, next) => {
  const { title, description } = req.body;
  let { tags } = req.body;
  
  if (title && typeof title !== 'string') {
    return res.status(400).json({
      error: 'Invalid title',
      message: 'Title must be a string'
    });
  }
  
  if (title && title.length > 200) {
    return res.status(400).json({
      error: 'Title too long',
      message: 'Title must be less than 200 characters'
    });
  }
  
  if (description && typeof description !== 'string') {
    return res.status(400).json({
      error: 'Invalid description',
      message: 'Description must be a string'
    });
  }
  
  if (description && description.length > 1000) {
    return res.status(400).json({
      error: 'Description too long',
      message: 'Description must be less than 1000 characters'
    });
  }
  
  // Normalize tags: accept array, comma-separated string, or JSON string
  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        tags = Array.isArray(parsed) ? parsed : [trimmed];
      } catch {
        tags = trimmed.length ? trimmed.split(',') : [];
      }
    } else {
      tags = trimmed.length ? trimmed.split(',') : [];
    }
  }
  
  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({
      error: 'Invalid tags',
      message: 'Tags must be an array'
    });
  }
  
  if (tags && tags.length > 10) {
    return res.status(400).json({
      error: 'Too many tags',
      message: 'Maximum 10 tags allowed'
    });
  }
  
  if (tags) {
    const normalized = tags.map(tag => typeof tag === 'string' ? tag.trim() : tag).filter(Boolean);
    const invalidTags = normalized.filter(tag => typeof tag !== 'string' || tag.length > 50);
    if (invalidTags.length > 0) {
      return res.status(400).json({
        error: 'Invalid tag format',
        message: 'Tags must be strings less than 50 characters'
      });
    }
    req.body.tags = normalized;
  }
  
  if (req.body.title) req.body.title = req.body.title.trim();
  if (req.body.description) req.body.description = req.body.description.trim();
  
  next();
};

export const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      error: 'Invalid page',
      message: 'Page must be a positive number'
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      error: 'Invalid limit',
      message: 'Limit must be a number between 1 and 100'
    });
  }
  
  req.query.page = pageNum;
  req.query.limit = limitNum;
  
  next();
};

export const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };
  
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }
  
  next();
};

import express from 'express';
import { 
  queryRAG, 
  batchQueryRAG, 
  getRAGStats, 
  getQueryHistory,
  clearHistory
} from '../controllers/ragController.js';
import { 
  validateRAGQuery, 
  sanitizeInput 
} from '../middleware/validation.js';

const router = express.Router();

// Apply validation middleware to all routes
router.use(sanitizeInput);

// RAG query endpoints
router.post('/query', validateRAGQuery, queryRAG);
router.post('/batch-query', validateRAGQuery, batchQueryRAG);

// RAG system information
router.get('/stats', getRAGStats);
router.get('/history', getQueryHistory);
router.delete('/history', clearHistory);

export default router;

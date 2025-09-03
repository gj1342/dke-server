import express from 'express';
import { 
  uploadDocument, 
  getDocuments, 
  getAllDocuments,
  getDocumentInfo, 
  deleteDocument, 
  getSystemStats 
} from '../controllers/documentController.js';
import { 
  uploadMiddleware, 
  handleUploadError, 
  validateUploadedFile 
} from '../middleware/upload.js';
import { 
  validateDocumentMetadata, 
  validatePagination, 
  sanitizeInput 
} from '../middleware/validation.js';

const router = express.Router();

// Apply validation middleware to all routes
router.use(sanitizeInput);

// Document upload with file handling
router.post('/upload', 
  uploadMiddleware, 
  handleUploadError, 
  validateUploadedFile, 
  validateDocumentMetadata, 
  uploadDocument
);

// Document retrieval and management
router.get('/', validatePagination, getDocuments);
router.get('/all', getAllDocuments);
router.get('/stats', getSystemStats);
router.get('/:documentId', getDocumentInfo);
router.delete('/:documentId', deleteDocument);

export default router;

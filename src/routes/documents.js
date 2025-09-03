import express from 'express';
import { 
  uploadDocument, 
  getDocuments, 
  getAllDocuments,
  getDocumentInfo, 
  deleteDocument, 
  getSystemStats,
  resetDocuments
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

router.use(sanitizeInput);

router.post('/upload', 
  uploadMiddleware, 
  handleUploadError, 
  validateUploadedFile, 
  validateDocumentMetadata, 
  uploadDocument
);

router.get('/', validatePagination, getDocuments);
router.get('/all', getAllDocuments);
router.get('/stats', getSystemStats);
router.delete('/', resetDocuments);
router.get('/:documentId', getDocumentInfo);
router.delete('/:documentId', deleteDocument);

export default router;

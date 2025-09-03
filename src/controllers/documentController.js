import { documentService } from '../services/documentService.js';
import { logger } from '../utils/logger.js';

export const uploadDocument = async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;

    const rawTags = req.body.tags;
    let normalizedTags = [];
    if (Array.isArray(rawTags)) {
      normalizedTags = rawTags.map(tag => String(tag).trim()).filter(Boolean);
    } else if (typeof rawTags === 'string') {
      const trimmed = rawTags.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          normalizedTags = Array.isArray(parsed) ? parsed.map(t => String(t).trim()).filter(Boolean) : [];
        } catch {
          normalizedTags = trimmed.length ? trimmed.split(',').map(t => t.trim()).filter(Boolean) : [];
        }
      } else {
        normalizedTags = trimmed.length ? trimmed.split(',').map(t => t.trim()).filter(Boolean) : [];
      }
    }

    const metadata = {
      title: req.body.title,
      description: req.body.description,
      tags: normalizedTags,
      uploadedBy: req.body.uploadedBy || 'anonymous',
      uploadedAt: new Date().toISOString(),
      originalName
    };

    logger.info('Document upload request received', {
      originalName: req.file.originalname,
      size: req.file.size,
      metadata
    });

    const result = await documentService.processDocumentBuffer(fileBuffer, originalName, metadata);

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: result
    });

  } catch (error) {
    logger.error('Document upload failed', { 
      error: error.message, 
      file: req.file?.originalname 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process document',
      message: error.message
    });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    logger.info('Document retrieval request', { page, limit });

    const stats = await documentService.getSystemStats();
    
    res.status(200).json({
      success: true,
      data: {
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.vectorDatabase.totalDocuments
        }
      }
    });

  } catch (error) {
    logger.error('Document retrieval failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents',
      message: error.message
    });
  }
};

export const getDocumentInfo = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    logger.info('Document info request', { documentId });

    const documentInfo = await documentService.getDocumentInfo(documentId);
    
    if (!documentInfo) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        message: `Document with ID ${documentId} not found`
      });
    }

    res.status(200).json({
      success: true,
      data: documentInfo
    });

  } catch (error) {
    logger.error('Document info retrieval failed', { 
      error: error.message, 
      documentId: req.params.documentId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve document info',
      message: error.message
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    logger.info('Document deletion request', { documentId });

    const result = await documentService.deleteDocument(documentId);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: result
    });

  } catch (error) {
    logger.error('Document deletion failed', { 
      error: error.message, 
      documentId: req.params.documentId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      message: error.message
    });
  }
};

export const getSystemStats = async (req, res) => {
  try {
    logger.info('System stats request');

    const stats = await documentService.getSystemStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('System stats retrieval failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system stats',
      message: error.message
    });
  }
};

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { documentParser } from '../utils/documentParser.js';
import { textChunker } from '../utils/textChunker.js';
import { embeddingService } from './embeddingService.js';
import { vectorService } from './vectorService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/app.js';

const require = createRequire(import.meta.url);

export class DocumentService {
  constructor() {
    this.processingQueue = new Map();
  }

  async processDocumentBuffer(fileBuffer, originalName, metadata = {}) {
    const documentId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting document processing (buffer)', { documentId, originalName });

      const extension = path.extname(originalName).toLowerCase().substring(1);
      const fileType = extension;

      let extractedText = '';
      if (fileType === 'pdf') {
        const pdf = require('pdf-parse');
        const data = await pdf(fileBuffer);
        extractedText = data.text || '';
      } else if (fileType === 'docx') {
        const mammoth = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value || '';
      } else if (fileType === 'html') {
        const html = fileBuffer.toString('utf-8');
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        $('script, style').remove();
        extractedText = $('body').length ? $('body').text() : $.text();
      } else if (fileType === 'txt') {
        extractedText = fileBuffer.toString('utf-8');
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      extractedText = extractedText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      if (!extractedText) {
        throw new Error('No text content extracted from document');
      }

      const textChunks = textChunker.splitText(extractedText);
      if (textChunks.length === 0) throw new Error('No text chunks generated');

      logger.info('Text extracted and chunked', { documentId, originalLength: extractedText.length, chunkCount: textChunks.length });

      const embeddings = await embeddingService.generateEmbeddings(textChunks);
      if (embeddings.length !== textChunks.length) throw new Error('Embedding count mismatch with text chunks');

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + config.retention.days * 24 * 60 * 60 * 1000);

      const documents = textChunks.map((chunk, index) => ({
        id: `${documentId}-chunk-${index}`,
        text: chunk,
        embedding: embeddings[index],
        source: originalName,
        timestamp: createdAt.toISOString(),
        metadata: {
          documentId,
          chunkIndex: index,
          totalChunks: textChunks.length,
          fileType,
          originalSize: extractedText.length,
          chunkSize: chunk.length,
          createdAt: createdAt.toISOString(),
          createdAtMs: createdAt.getTime(),
          expiresAt: expiresAt.toISOString(),
          expiresAtMs: expiresAt.getTime(),
          ...metadata
        }
      }));

      await vectorService.addDocuments(documents);

      const processingTime = Date.now() - startTime;
      return {
        documentId,
        status: 'success',
        processingTime,
        stats: {
          originalTextLength: extractedText.length,
          chunkCount: textChunks.length,
          embeddingCount: embeddings.length,
          fileType,
          source: originalName
        },
        metadata
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Document processing (buffer) failed', { documentId, file: originalName, error: error.message, processingTime });
      throw error;
    }
  }

  async processDocument(filePath, metadata = {}) {
    const documentId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting document processing', { documentId, filePath });

      const fileType = documentParser.validateFile(filePath);
      
      const extractedText = await documentParser.parseDocument(filePath, fileType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content extracted from document');
      }

      const textChunks = textChunker.splitText(extractedText);
      
      if (textChunks.length === 0) {
        throw new Error('No text chunks generated');
      }

      logger.info('Text extracted and chunked', { 
        documentId, 
        originalLength: extractedText.length,
        chunkCount: textChunks.length 
      });

      const embeddings = await embeddingService.generateEmbeddings(textChunks);
      
      if (embeddings.length !== textChunks.length) {
        throw new Error('Embedding count mismatch with text chunks');
      }

      logger.info('Embeddings generated', { 
        documentId, 
        embeddingCount: embeddings.length 
      });

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + config.retention.days * 24 * 60 * 60 * 1000);

      const documents = textChunks.map((chunk, index) => ({
        id: `${documentId}-chunk-${index}`,
        text: chunk,
        embedding: embeddings[index],
        source: path.basename(filePath),
        timestamp: createdAt.toISOString(),
        metadata: {
          documentId,
          chunkIndex: index,
          totalChunks: textChunks.length,
          fileType,
          originalSize: extractedText.length,
          chunkSize: chunk.length,
          createdAt: createdAt.toISOString(),
          createdAtMs: createdAt.getTime(),
          expiresAt: expiresAt.toISOString(),
          expiresAtMs: expiresAt.getTime(),
          ...metadata
        }
      }));

      await vectorService.addDocuments(documents);

      this.cleanupFile(filePath);

      const processingTime = Date.now() - startTime;
      
      const result = {
        documentId,
        status: 'success',
        processingTime,
        stats: {
          originalTextLength: extractedText.length,
          chunkCount: textChunks.length,
          embeddingCount: embeddings.length,
          fileType,
          source: path.basename(filePath)
        },
        metadata
      };

      logger.info('Document processing completed successfully', { 
        documentId, 
        processingTime,
        chunkCount: textChunks.length 
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Document processing failed', { 
        documentId, 
        filePath, 
        error: error.message,
        processingTime 
      });

      this.cleanupFile(filePath);

      throw error;
    }
  }

  async processMultipleDocuments(filePaths, metadata = {}) {
    try {
      logger.info('Starting batch document processing', { fileCount: filePaths.length });

      const results = [];
      const batchSize = 3; 

      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)}`, {
          batchSize: batch.length,
          totalProcessed: i
        });

        const batchResults = await Promise.allSettled(
          batch.map(filePath => this.processDocument(filePath, metadata))
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Batch processing failed for file', {
              filePath: batch[index],
              error: result.reason.message
            });
            results.push({
              status: 'failed',
              filePath: batch[index],
              error: result.reason.message
            });
          }
        });

        
        if (i + batchSize < filePaths.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      logger.info('Batch document processing completed', {
        totalFiles: filePaths.length,
        successCount,
        failureCount
      });

      return results;

    } catch (error) {
      logger.error('Batch document processing failed', { 
        error: error.message, 
        fileCount: filePaths.length 
      });
      throw error;
    }
  }

  async getDocumentInfo(documentId) {
    try {
      logger.debug('Retrieving document info', { documentId });

      const allDocuments = await vectorService.getAllDocuments();
      
      const documentChunks = allDocuments.filter(doc => 
        doc.metadata && doc.metadata.documentId === documentId
      );
      
      if (documentChunks.length === 0) {
        logger.warn('Document not found', { documentId });
        return null;
      }
      
      const totalChunks = documentChunks.length;
      const totalTextLength = documentChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
      const firstChunk = documentChunks[0];
      const lastChunk = documentChunks[totalChunks - 1];
      
      const documentInfo = {
        documentId,
        totalChunks,
        totalTextLength,
        fileType: firstChunk.metadata?.fileType || 'unknown',
        source: firstChunk.metadata?.source || 'unknown',
        createdAt: firstChunk.metadata?.timestamp || new Date().toISOString(),
        lastModified: lastChunk.metadata?.timestamp || new Date().toISOString(),
        status: 'processed',
        averageChunkSize: Math.round(totalTextLength / totalChunks),
        metadata: firstChunk.metadata || {}
      };

      logger.debug('Document info retrieved', { documentId, documentInfo });
      return documentInfo;

    } catch (error) {
      logger.error('Failed to get document info', { 
        error: error.message, 
        documentId 
      });
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      logger.info('Deleting document', { documentId });
      
      const allDocuments = await vectorService.getAllDocuments();
      const documentChunks = allDocuments.filter(doc => 
        doc.metadata && doc.metadata.documentId === documentId
      );
      
      if (documentChunks.length === 0) {
        logger.warn('No chunks found for document', { documentId });
        return { success: true, documentId, chunksDeleted: 0 };
      }
      
      const chunkIds = documentChunks.map(chunk => chunk.id);
      await vectorService.deleteMultipleDocuments(chunkIds);
      
      logger.info('Document deletion completed', { 
        documentId, 
        chunksDeleted: documentChunks.length 
      });
      
      return { 
        success: true, 
        documentId, 
        chunksDeleted: documentChunks.length,
        totalTextLength: documentChunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
      };

    } catch (error) {
      logger.error('Failed to delete document', { 
        error: error.message, 
        documentId 
      });
      throw error;
    }
  }

  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug('Temporary file cleaned up', { filePath });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temporary file', { filePath, error: error.message });
    }
  }

  getProcessingStatus(documentId) {
    return this.processingQueue.get(documentId) || { status: 'not_found' };
  }

  async getSystemStats() {
    try {
      const vectorStats = await vectorService.getCollectionStats();
      const embeddingStats = embeddingService.getCacheStats();

      return {
        vectorDatabase: {
          totalDocuments: vectorStats.count,
          collectionName: config.chroma.collectionName
        },
        embeddings: {
          cacheSize: embeddingStats.size,
          model: embeddingStats.model,
          maxLength: embeddingStats.maxLength
        },
        processing: {
          activeJobs: this.processingQueue.size
        }
      };
    } catch (error) {
      logger.error('Failed to get system stats', { error: error.message });
      throw error;
    }
  }

  async getAllDocuments() {
    try {
      const documents = await vectorService.getAllDocuments();
      
      return documents.map(doc => ({
        id: doc.id,
        title: doc.metadata?.source || 'Unknown',
        filename: doc.metadata?.source || 'Unknown',
        size: doc.metadata?.originalSize || 0,
        type: doc.metadata?.fileType || 'unknown',
        uploadDate: doc.metadata?.timestamp || new Date().toISOString(),
        status: 'processed'
      }));
    } catch (error) {
      logger.error('Failed to get all documents', { error: error.message });
      throw error;
    }
  }

  async resetDocuments() {
    try {
      logger.warn('Resetting all documents from vector database');
      
      const result = await vectorService.clearCollection();
      
      logger.info('Document reset completed successfully');
      return result;
    } catch (error) {
      logger.error('Failed to reset documents', { error: error.message });
      throw error;
    }
  }
}

export const documentService = new DocumentService();

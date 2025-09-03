import swaggerUi from 'swagger-ui-express';
import { config } from './app.js';

const buildOpenApiSpec = () => ({
  openapi: '3.0.0',
  info: {
    title: 'D Knowledge Engine API',
    version: '1.0.0',
    description: 'API documentation for D Knowledge Engine server'
  },
  servers: [
    { 
      url: 'https://dke-server-production.up.railway.app/api/v1', 
      description: 'Production (Railway)' 
    },
    { 
      url: `http://localhost:${config.server.port}/api/v1`, 
      description: 'Local Development' 
    }
  ],
  components: {
    schemas: {
      UploadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              documentId: { type: 'string' },
              status: { type: 'string' },
              processingTime: { type: 'number' }
            }
          }
        }
      },
      RAGQuery: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          maxResults: { type: 'integer', minimum: 1, maximum: 20 },
          includeMetadata: { type: 'boolean' },
          documentId: { type: 'string' }
        }
      },
      RAGResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              answer: { type: 'string' },
              confidence: { type: 'number' },
              processingTime: { type: 'number' }
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': { get: { summary: 'Health check', responses: { 200: { description: 'Service healthy' } } } },
    '/documents/upload': {
      post: {
        summary: 'Upload a document',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  document: { type: 'string', format: 'binary' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  tags: { type: 'string', description: 'Comma-separated or JSON array' }
                },
                required: ['document']
              }
            }
          }
        },
        responses: { 201: { description: 'Uploaded' }, 400: { description: 'Bad request' } }
      }
    },
    '/documents': { get: { summary: 'Get documents (stats + pagination)', responses: { 200: { description: 'OK' } } } },
    '/documents/all': { get: { summary: 'Get all documents list', responses: { 200: { description: 'OK' } } } },
    '/documents/stats': { get: { summary: 'Get system stats', responses: { 200: { description: 'OK' } } } },
    '/documents': { delete: { summary: 'Reset all documents (clear collection)', responses: { 200: { description: 'All documents cleared' } } } },
    '/documents/{documentId}': {
      get: { summary: 'Get document info', parameters: [ { in: 'path', name: 'documentId', required: true, schema: { type: 'string' } } ], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      delete: { summary: 'Delete a document', parameters: [ { in: 'path', name: 'documentId', required: true, schema: { type: 'string' } } ], responses: { 200: { description: 'Deleted' } } }
    },
    '/rag/query': {
      post: {
        summary: 'Query the RAG engine',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RAGQuery' } } } },
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/RAGResponse' } } } } }
      }
    },
    '/rag/batch-query': {
      post: {
        summary: 'Batch RAG queries',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { queries: { type: 'array', items: { type: 'string' } }, maxResults: { type: 'integer' } }, required: ['queries'] } } } },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/rag/stats': { get: { summary: 'Get RAG stats', responses: { 200: { description: 'OK' } } } },
    '/rag/history': { get: { summary: 'Get query history', parameters: [ { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } } ], responses: { 200: { description: 'OK' } } } },
    '/rag/history': { delete: { summary: 'Clear query history', responses: { 200: { description: 'History cleared' } } } },
  }
});

export const mountSwagger = (app) => {
  const spec = buildOpenApiSpec();
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
};

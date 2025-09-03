import 'dotenv/config';

export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  ai: {
    mistralApiKey: process.env.MISTRAL_API_KEY,
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
  },

  chroma: {
    url: process.env.CHROMA_URL || null,
    host: process.env.CHROMA_HOST || 'localhost',
    port: process.env.CHROMA_PORT || 8000,
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'documents',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt,html').split(','),
  },

  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },

  retention: {
    days: parseInt(process.env.RETENTION_DAYS) || 7,
    cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 60
  }
};

export const validateConfig = () => {
  const required = ['MISTRAL_API_KEY', 'HUGGINGFACE_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Environment configuration validated');
  return true;
};

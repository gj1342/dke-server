import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, validateConfig } from './config/app.js';
import { initializeChromaDB } from './config/database.js';
import { initializeAIClients } from './config/ai.js';
import healthRoutes from './routes/health.js';
import documentRoutes from './routes/documents.js';
import ragRoutes from './routes/rag.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mountSwagger } from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

validateConfig();

app.use(helmet());
app.use(cors({ 
  origin: config.server.corsOrigin,
  credentials: true 
}));
app.use(express.json({ limit: config.upload.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: config.upload.maxFileSize }));

app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.uploadPath)));

mountSwagger(app);

app.get('/', (req, res) => {
  res.json({ 
    message: 'D Knowledge Engine Server',
    status: 'running',
    environment: config.server.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/rag', ragRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    console.log('🚀 Starting D Knowledge Engine Server...');
    
    await initializeChromaDB();
    await initializeAIClients();
    
    app.listen(config.server.port, () => {
      console.log(`🚀 Server running on port ${config.server.port}`);
      console.log(`📖 Swagger docs: http://localhost:${config.server.port}/docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;

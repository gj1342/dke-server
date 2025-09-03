import { ChromaClient } from 'chromadb';
import { config } from './app.js';

let chromaClient = null;

export const initializeChromaDB = async () => {
  try {
    if (config.chroma.url) {
      const parsed = new URL(config.chroma.url.replace(/\/$/, ''));
      const isHttps = parsed.protocol === 'https:';
      const host = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);
      chromaClient = new ChromaClient({ host, port, ssl: isHttps });
    } else {
      const host = config.chroma.host;
      const port = Number(config.chroma.port);
      const ssl = false;
      chromaClient = new ChromaClient({ host, port, ssl });
    }

    if (typeof chromaClient.heartbeat === 'function') {
      await chromaClient.heartbeat();
    }

    const info = config.chroma.url ? config.chroma.url : `http://${config.chroma.host}:${config.chroma.port}`;
    console.log(`✅ ChromaDB client initialized for ${info}`);
    return chromaClient;
  } catch (error) {
    console.error('❌ Failed to connect to ChromaDB:', error.message);
    throw error;
  }
};

export const getChromaClient = () => {
  if (!chromaClient) {
    throw new Error('ChromaDB not initialized. Call initializeChromaDB() first.');
  }
  return chromaClient;
};

export const getCollection = async (collectionName = config.chroma.collectionName) => {
  const client = getChromaClient();
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        metadata: {
          description: 'Document embeddings for RAG system'
        },
        embeddingFunction: null
      });
      return collection;
    } catch (error) {
      lastError = error;
      console.error(`❌ Collection operation attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Retrying collection operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  console.error('❌ Failed to get/create collection after all retries:', lastError.message);
  throw lastError;
};

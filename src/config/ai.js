import { HfInference } from '@huggingface/inference';
import { config } from './app.js';

let mistralClient = null;
let huggingfaceClient = null;

export const initializeAIClients = async () => {
  try {
    const pkg = await import('@mistralai/mistralai');
    const MistralCtor = pkg.Mistral || pkg.MistralClient || pkg.default;

    if (!MistralCtor) {
      throw new Error('Unable to resolve Mistral SDK constructor');
    }

    try {
      mistralClient = new MistralCtor(config.ai.mistralApiKey);
    } catch {
      mistralClient = new MistralCtor({ apiKey: config.ai.mistralApiKey });
    }

    huggingfaceClient = new HfInference(config.ai.huggingfaceApiKey);
    
    console.log('✅ AI clients initialized: Mistral ✓, HuggingFace ✓');
    return { mistralClient, huggingfaceClient };
  } catch (error) {
    console.error('❌ Failed to initialize AI clients:', error.message);
    throw error;
  }
};

export const getMistralClient = () => {
  if (!mistralClient) {
    throw new Error('Mistral client not initialized. Call initializeAIClients() first.');
  }
  return mistralClient;
};

export const getHuggingfaceClient = () => {
  if (!huggingfaceClient) {
    throw new Error('HuggingFace client not initialized. Call initializeAIClients() first.');
  }
  return huggingfaceClient;
};

export const aiConfig = {
  mistral: {
    model: 'mistral-large-latest',
    maxTokens: 4096,
    temperature: 0.7,
  },
  huggingface: {
    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
    maxLength: 512,
  },
};

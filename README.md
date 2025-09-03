# D Knowledge Engine Server

A powerful **Retrieval-Augmented Generation (RAG)** system built with Node.js, Express, ChromaDB, and AI services. This server processes documents, generates embeddings, stores them in a vector database, and provides intelligent question-answering capabilities.

## 🚀 Features

- **Multi-format Document Processing**: PDF, DOCX, HTML, TXT support
- **AI-Powered Embeddings**: Hugging Face integration for text vectorization
- **Vector Database**: ChromaDB for efficient similarity search
- **RAG System**: Mistral AI integration for intelligent responses
- **File Upload**: Secure document upload with validation
- **Batch Processing**: Handle multiple documents and queries efficiently
- **Comprehensive Logging**: Structured logging with file output
- **Environment Configuration**: Flexible configuration management
- **Security**: Input validation, sanitization, and rate limiting

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Express API   │    │   AI Services   │
│                 │◄──►│                 │◄──►│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Document      │    │   Vector DB     │
                       │   Processing    │    │   (ChromaDB)    │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── app.js              # Environment configuration
│   │   ├── ai.js               # AI service configuration
│   │   └── database.js         # ChromaDB configuration
│   ├── controllers/
│   │   ├── documentController.js    # Document HTTP handling
│   │   ├── ragController.js         # RAG query handling
│   │   └── healthController.js      # Health checks
│   ├── services/
│   │   ├── documentService.js       # Document processing logic
│   │   ├── embeddingService.js      # Text embedding generation
│   │   ├── ragService.js            # RAG orchestration
│   │   └── vectorService.js         # ChromaDB operations
│   ├── middleware/
│   │   ├── upload.js               # File upload handling
│   │   ├── errorHandler.js          # Global error handling
│   │   └── validation.js            # Input validation
│   ├── utils/
│   │   ├── documentParser.js        # Document parsing
│   │   ├── textChunker.js           # Text splitting
│   │   └── logger.js                # Logging utilities
│   ├── routes/
│   │   ├── documents.js             # Document endpoints
│   │   ├── rag.js                   # RAG endpoints
│   │   └── health.js                # Health endpoints
│   └── app.js                       # Main Express app
├── uploads/                          # Temporary file storage
├── logs/                            # Application logs
├── .env                             # Environment variables
└── package.json
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+ 
- ChromaDB server running
- Mistral AI API key
- Hugging Face API key

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd server
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env_sample .env
   # Edit .env with your API keys and configuration
   ```

3. **Start ChromaDB server:**
   ```bash
   # Option 1: Docker
   docker run -p 8000:8000 chromadb/chroma
   
   # Option 2: Local installation
   # Follow ChromaDB documentation
   ```

4. **Start the server:**
   ```bash
   npm start          # Production
   npm run dev        # Development with auto-restart
   ```

## ⚙️ Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# AI API Keys
MISTRAL_API_KEY=your_mistral_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# ChromaDB Configuration
CHROMA_URL=
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=documents

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=pdf,docx,txt,html

# Security Settings (set to the client origin that will call this API)
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
```

Notes:
- If `CHROMA_URL` is set (e.g., `https://your-chroma.domain`), it takes precedence over `CHROMA_HOST/CHROMA_PORT`.
- Use only hostname in `CHROMA_HOST` (no protocol); default port is `8000`.
- The server pings Chroma on startup (heartbeat) and expects server mode; embeddings are generated by this app and sent to Chroma.

## 📚 API Endpoints

All endpoints are prefixed with `/api/v1`.

### Health Check
- `GET /api/v1/health` - Server health status

### Document Management
- `POST /api/v1/documents/upload` - Upload and process document
- `GET /api/v1/documents` - Get document statistics
- `GET /api/v1/documents/stats` - Get system statistics
- `GET /api/v1/documents/:id` - Get document information
- `DELETE /api/v1/documents/:id` - Delete document

### RAG Queries
- `POST /api/v1/rag/query` - Single RAG query
- `POST /api/v1/rag/batch-query` - Multiple RAG queries
- `GET /api/v1/rag/stats` - RAG system statistics
- `GET /api/v1/rag/history` - Query history

## 🔧 Usage Examples

### Upload Document

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -F "document=@/path/to/document.pdf" \
  -F "title=Sample Document" \
  -F "description=This is a sample document" \
  -F "tags=research,ai,technology"
```

### RAG Query

```bash
curl -X POST http://localhost:3000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main topics discussed in the documents?",
    "maxResults": 5,
    "includeMetadata": true
  }'
```

### Batch RAG Queries

```bash
curl -X POST http://localhost:3000/api/v1/rag/batch-query \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      "What is the main topic?",
      "What are the key findings?",
      "What are the conclusions?"
    ],
    "maxResults": 3
  }'
```

## 🔍 How It Works

### 1. Document Processing
1. **Upload**: File uploaded via API
2. **Parsing**: Text extracted based on file type
3. **Chunking**: Text split into manageable chunks
4. **Embedding**: AI generates vector embeddings
5. **Storage**: Chunks stored in ChromaDB with metadata

### 2. RAG Query Processing
1. **Query Embedding**: User question converted to vector
2. **Vector Search**: Similar documents retrieved from ChromaDB
3. **Context Preparation**: Relevant text chunks formatted
4. **AI Generation**: Mistral AI generates answer using context
5. **Response**: Structured response with sources and confidence

## 🚨 Error Handling

The system includes comprehensive error handling:
- **Input Validation**: Request data validation
- **File Validation**: File type and size checks
- **AI Service Errors**: Graceful handling of API failures
- **Database Errors**: ChromaDB connection and operation errors
- **Logging**: Detailed error logging for debugging

## 📊 Monitoring & Logging

- **Structured Logging**: JSON format with different levels
- **File Logging**: Logs saved to `./logs/app.log`
- **Performance Metrics**: Processing times and token usage
- **System Statistics**: Database counts and cache status

## 🔒 Security Features

- **Input Sanitization**: XSS protection
- **File Validation**: Type and size restrictions
- **CORS Configuration**: Cross-origin request control
- **Rate Limiting**: API request throttling
- **Error Masking**: Sensitive information protection

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
```

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: Secure API key management
2. **Logging**: Configure log rotation and monitoring
3. **Rate Limiting**: Adjust based on expected load
4. **Monitoring**: Health checks and metrics
5. **Scaling**: Consider load balancing for high traffic

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Add tests for new features
5. Submit a pull request

## 🆘 Support

For issues and questions:
- Check the logs in `./logs/app.log`
- Verify environment configuration
- Ensure ChromaDB is running
- Check API key validity

## 🔮 Future Enhancements

- **User Authentication**: Multi-user support
- **Document Versioning**: Track document changes
- **Advanced Search**: Filters and faceted search
- **Real-time Updates**: WebSocket support
- **Analytics Dashboard**: Usage statistics and insights
- **Plugin System**: Extensible document processors

## Swagger API Docs

- Swagger UI (local): http://localhost:3000/docs
- Server base URL (local): http://localhost:3000/api/v1
- Swagger UI (production): https://dke-server-production.up.railway.app/docs
- Server base URL (production): https://dke-server-production.up.railway.app/api/v1
- Endpoints you can try (all prefixed with /api/v1):
  - POST `/api/v1/documents/upload` (multipart form-data)
  - GET `/api/v1/documents/stats`
  - GET `/api/v1/documents/{documentId}` / DELETE `/api/v1/documents/{documentId}`
  - POST `/api/v1/rag/query` (supports `documentId` to scope results)
  - POST `/api/v1/rag/batch-query`
  - GET `/api/v1/rag/stats`, GET `/api/v1/rag/history`
  - GET `/api/v1/health`

## Upload pipeline (serverless‑friendly)

- Uploads now use in‑memory storage (no local disk). Parsers read directly from the uploaded Buffer.
- Supported formats: PDF (pdf-parse), DOCX (mammoth), HTML (cheerio), TXT.
- After parsing/indexing, the original file is not stored; only embeddings persist in Chroma.

## Running Chroma with Docker (required)

- Start Chroma (local option):
```
docker run -d --name chroma -p 8000:8000 -v chroma_data:/chroma ghcr.io/chroma-core/chroma:latest
```
- Verify:
```
curl http://localhost:8000/api/v1/heartbeat
```
- Reset (wipe all vectors):
```
docker stop chroma && docker rm chroma && docker volume rm chroma_data
```

Using a managed/service Chroma (e.g., Railway):
- Set `CHROMA_URL` to your service URL (e.g., `https://your-chroma.up.railway.app`).
- Ensure the Chroma service allows your API origin via `CHROMA_SERVER_CORS_ALLOW_ORIGINS` when called from browsers.

## Environment

Add these (alongside existing keys) to `.env`:
```
# Retention policy (automatic chunk cleanup)
RETENTION_DAYS=7
CLEANUP_INTERVAL_MINUTES=60
```
- Retention applies to indexed chunks, not the uploaded files. Uploaded files are deleted immediately after processing.
- The system adds `createdAt/expiresAt` (and numeric `createdAtMs/expiresAtMs`) to chunk metadata and:
  - Excludes expired chunks in searches
  - Periodically deletes expired chunks in the background

## Document‑scoped RAG (avoid cross‑document mixing)

To restrict answers to a single uploaded document, pass its `documentId` from the upload response:
```
POST /rag/query
{
  "query": "Summarize this document",
  "maxResults": 5,
  "includeMetadata": false,
  "documentId": "<documentId>"
}
```
- Without `documentId`, search runs across the whole collection.
- Set `includeMetadata: true` to inject filename (`source`) into the context so the model can cite it.

## Uploads and persistence

- `uploads/` is temporary; files are removed after processing (success or failure).
- Parsed chunks + embeddings persist in Chroma until they expire (retention) or are deleted via API or DB reset.

## Notes on libraries

- Cheerio (ESM): `import * as cheerio from 'cheerio'` in `documentParser`.
- pdf-parse (CJS): loaded via `createRequire` at call‑time to avoid ESM side effects.
- Mistral SDK: code supports both `client.chat.complete(...)` and legacy `client.chat(...)`, and parses multiple response shapes.
- Hugging Face embeddings: code accepts both 1D and 2D arrays from `featureExtraction`.

## Troubleshooting

- "Failed to connect to chromadb":
  - If using local Docker, ensure it's reachable at `http://localhost:8000`.
  - If using a remote service, set `CHROMA_URL=https://<your-service>` (no trailing slash recommended).
  - Our client initializes with `host/port/ssl` (server mode) and heartbeats on startup.
- "Expected metadata to be a string...": metadata is now normalized to primitives before insert; if you add custom fields, keep them string/number/boolean/null.
- "Generated embedding is invalid": ensure HF key is set; the app now normalizes response shapes.
- "Cannot instantiate a collection with the DefaultEmbeddingFunction": we now create collections with `embeddingFunction: null` for server mode; you provide embeddings.
- "CORS / Failed to fetch" in Swagger when calling production from local UI: either open production Swagger (`/docs`) or set `CORS_ORIGIN` appropriately. For Chroma server CORS from browsers, set `CHROMA_SERVER_CORS_ALLOW_ORIGINS` on the Chroma service.
- "Filename not in answers": set `includeMetadata: true` or we can always prepend filenames in context.

## Security & Ops

- Inputs validated and sanitized.
- Rate limits configurable via `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`.
- Retention/cleanup configurable via `RETENTION_DAYS`, `CLEANUP_INTERVAL_MINUTES`.
- Consider adding auth (API token) before exposing admin operations (e.g., clear collection) publicly.

## Railway deployment notes

- Backend
  - Set `PORT` per Railway, and `CORS_ORIGIN` to your frontend origin (or the backend domain if only using built-in Swagger).
  - Set `MISTRAL_API_KEY`, `HUGGINGFACE_API_KEY`.
  - For Chroma, prefer `CHROMA_URL=https://<your-chroma>.up.railway.app`.
- Chroma service
  - Expose over HTTPS (Railway default), and optionally set `CHROMA_SERVER_CORS_ALLOW_ORIGINS` if you will call Chroma directly from browsers (not required for server-to-server use).
  - No default embeddings; collections are created with `embeddingFunction: null`.

## Embedding reliability

- Embeddings generation uses Hugging Face with `wait_for_model=true` and retry/backoff for transient errors.
- You can swap the model via `aiConfig.huggingface.embeddingModel` or env override if added.

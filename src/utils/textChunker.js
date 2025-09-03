import { config } from '../config/app.js';
import { logger } from './logger.js';

export class TextChunker {
  constructor(options = {}) {
    this.maxChunkSize = options.maxChunkSize || 1000;
    this.overlapSize = options.overlapSize || 200;
    this.separators = options.separators || ['\n\n', '\n', '. ', '! ', '? ', '; ', ': ', ', ', ' '];
  }

  splitText(text) {
    if (!text || typeof text !== 'string') {
      logger.warn('Invalid text provided to chunker', { text: typeof text });
      return [];
    }

    const cleanedText = this.cleanText(text);
    
    if (cleanedText.length <= this.maxChunkSize) {
      return [cleanedText];
    }

    return this.createChunks(cleanedText);
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  createChunks(text) {
    const chunks = [];
    let currentChunk = '';
    let lastSeparatorIndex = -1;

    for (let i = 0; i < text.length; i++) {
      currentChunk += text[i];

      if (currentChunk.length >= this.maxChunkSize) {
        const chunk = this.findBestSplitPoint(currentChunk, text, i);
        
        if (chunk) {
          chunks.push(chunk);
          currentChunk = this.createOverlap(chunk, text, i);
          lastSeparatorIndex = i;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    logger.debug('Text chunking completed', { 
      originalLength: text.length, 
      chunkCount: chunks.length,
      averageChunkSize: Math.round(text.length / chunks.length)
    });

    return chunks;
  }

  findBestSplitPoint(chunk, fullText, currentIndex) {
    for (const separator of this.separators) {
      const lastIndex = chunk.lastIndexOf(separator);
      if (lastIndex > 0 && lastIndex < chunk.length - this.overlapSize) {
        return chunk.substring(0, lastIndex + separator.length).trim();
      }
    }

    return chunk.trim();
  }

  createOverlap(lastChunk, fullText, currentIndex) {
    const overlapStart = Math.max(0, lastChunk.length - this.overlapSize);
    return lastChunk.substring(overlapStart);
  }

  chunkByParagraphs(text) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    const chunks = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length <= this.maxChunkSize) {
        chunks.push(paragraph.trim());
      } else {
        chunks.push(...this.splitText(paragraph));
      }
    }

    return chunks;
  }

  chunkBySentences(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      if (currentChunk.length + trimmedSentence.length <= this.maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
          currentChunk = trimmedSentence;
        } else {
          chunks.push(trimmedSentence + '.');
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return chunks;
  }
}

export const textChunker = new TextChunker();

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { config } from '../config/app.js';
import { logger } from './logger.js';
 
const require = createRequire(import.meta.url);
 
export class DocumentParser {
  constructor() {
    this.supportedFormats = config.upload.allowedFileTypes;
  }
 
  async parseDocument(filePath, fileType) {
    try {
      logger.info('Starting document parsing', { filePath, fileType });
      
      if (!this.isSupportedFormat(fileType)) {
        throw new Error(`Unsupported file format: ${fileType}`);
      }
 
      const fileBuffer = fs.readFileSync(filePath);
      let extractedText = '';
 
      switch (fileType.toLowerCase()) {
        case 'pdf':
          extractedText = await this.parsePDF(fileBuffer);
          break;
        case 'docx':
          extractedText = await this.parseDOCX(fileBuffer);
          break;
        case 'html':
          extractedText = await this.parseHTML(fileBuffer);
          break;
        case 'txt':
          extractedText = await this.parseTXT(fileBuffer);
          break;
        default:
          throw new Error(`Parser not implemented for format: ${fileType}`);
      }
 
      const cleanedText = this.cleanExtractedText(extractedText);
      
      logger.info('Document parsing completed', { 
        filePath, 
        fileType, 
        originalLength: extractedText.length,
        cleanedLength: cleanedText.length 
      });
 
      return cleanedText;
    } catch (error) {
      logger.error('Document parsing failed', { filePath, fileType, error: error.message });
      throw error;
    }
  }
 
  isSupportedFormat(fileType) {
    return this.supportedFormats.includes(fileType.toLowerCase());
  }
 
  async parsePDF(buffer) {
    try {
      const pdf = require('pdf-parse');
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      logger.error('PDF parsing failed', { error: error.message });
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }
 
  async parseDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.error('DOCX parsing failed', { error: error.message });
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
  }
 
  async parseHTML(buffer) {
    try {
      const html = buffer.toString('utf-8');
      const $ = cheerio.load(html);
      
      $('script, style').remove();
      
      const text = $('body').length ? $('body').text() : $.text();
      
      return text;
    } catch (error) {
      logger.error('HTML parsing failed', { error: error.message });
      throw new Error(`Failed to parse HTML: ${error.message}`);
    }
  }
 
  parseTXT(buffer) {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      logger.error('TXT parsing failed', { error: error.message });
      throw new Error(`Failed to parse TXT: ${error.message}`);
    }
  }
 
  cleanExtractedText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
 
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
 
  getFileTypeFromPath(filePath) {
    const extension = path.extname(filePath).toLowerCase().substring(1);
    return extension;
  }
 
  validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
 
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File is empty');
    }
 
    if (stats.size > config.upload.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${config.upload.maxFileSize / 1024 / 1024}MB`);
    }
 
    const fileType = this.getFileTypeFromPath(filePath);
    if (!this.isSupportedFormat(fileType)) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
 
    return fileType;
  }
}
 
export const documentParser = new DocumentParser();

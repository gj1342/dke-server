import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/app.js';
import { logger } from '../utils/logger.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = config.upload.allowedFileTypes;
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    const error = new Error(`File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const limits = {
  fileSize: config.upload.maxFileSize,
  files: 1
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits
}).single('document');

export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: `File size exceeds maximum allowed size of ${config.upload.maxFileSize / 1024 / 1024}MB`
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Only one file can be uploaded at a time'
      });
    }

    return res.status(400).json({
      error: 'Upload error',
      message: error.message
    });
  }

  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }

  logger.error('Upload middleware error', { error: error.message });
  return res.status(500).json({
    error: 'Internal server error',
    message: 'Failed to process file upload'
  });
};

export const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select a file to upload'
    });
  }

  logger.info('File upload received', {
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });

  next();
};

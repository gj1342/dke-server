import { validateRAGQuery, validateDocumentMetadata } from '../src/middleware/validation.js';

const mock = () => {
  const req = { body: {}, query: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  return { req, res, next };
};

describe('validation middleware', () => {
  describe('validateRAGQuery', () => {
    test('passes valid query', () => {
      const { req, res, next } = mock();
      req.body = { query: 'hello world', maxResults: 5 };
      validateRAGQuery(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.query).toBe('hello world');
      expect(req.body.maxResults).toBe(5);
    });

    test('rejects short query', () => {
      const { req, res, next } = mock();
      req.body = { query: 'hi' };
      validateRAGQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('accepts documentId', () => {
      const { req, res, next } = mock();
      req.body = { query: 'ok query', documentId: 'abc-123' };
      validateRAGQuery(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.documentId).toBe('abc-123');
    });
  });

  describe('validateDocumentMetadata', () => {
    test('accepts comma-separated tags', () => {
      const { req, res, next } = mock();
      req.body = { title: 't', description: 'd', tags: 'a, b , c' };
      validateDocumentMetadata(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.tags).toEqual(['a', 'b', 'c']);
    });

    test('accepts JSON string tags', () => {
      const { req, res, next } = mock();
      req.body = { tags: '["x","y"]' };
      validateDocumentMetadata(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.tags).toEqual(['x', 'y']);
    });

    test('rejects too many tags', () => {
      const { req, res, next } = mock();
      req.body = { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) };
      validateDocumentMetadata(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

import { TextChunker } from '../src/utils/textChunker.js';

describe('TextChunker', () => {
  test('returns whole text if shorter than maxChunkSize', () => {
    const chunker = new TextChunker({ maxChunkSize: 100 });
    const chunks = chunker.splitText('short text');
    expect(chunks).toEqual(['short text']);
  });

  test('splits long text roughly by sentence boundaries', () => {
    const chunker = new TextChunker({ maxChunkSize: 20, overlapSize: 5 });
    const text = 'This is sentence one. This is sentence two. This is sentence three.';
    const chunks = chunker.splitText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('chunkBySentences groups sentences without exceeding maxChunkSize', () => {
    const chunker = new TextChunker({ maxChunkSize: 30 });
    const text = 'A. B. C. D. E.';
    const chunks = chunker.chunkBySentences(text);
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(31));
  });
});

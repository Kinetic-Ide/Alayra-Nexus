import { describe, it, expect } from 'vitest';
import { stripTrailingSlash, assertHttpUrl } from './url';

describe('stripTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(stripTrailingSlash('https://api.example.com/')).toBe('https://api.example.com');
  });

  it('removes multiple trailing slashes', () => {
    expect(stripTrailingSlash('https://api.example.com///')).toBe('https://api.example.com');
  });

  it('leaves a slash-free string untouched', () => {
    expect(stripTrailingSlash('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  it('handles an empty string', () => {
    expect(stripTrailingSlash('')).toBe('');
  });
});

describe('assertHttpUrl', () => {
  it('accepts https and http URLs', () => {
    expect(assertHttpUrl('https://api.anthropic.com/v1').protocol).toBe('https:');
    expect(assertHttpUrl('http://localhost:11434/v1').protocol).toBe('http:');
  });

  it('rejects non-http schemes', () => {
    expect(() => assertHttpUrl('file:///etc/passwd')).toThrow();
    expect(() => assertHttpUrl('gopher://internal')).toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => assertHttpUrl('not a url')).toThrow();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/ui.js', () => ({
  printToolHeader: vi.fn(),
  printToolSuccess: vi.fn(),
  printToolError: vi.fn(),
  printToolBlocked: vi.fn(),
  printRejected: vi.fn(),
  printDimOutput: vi.fn(),
  printSeparator: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { execute } from '../../../src/tools/webSearch.js';

const approve = async () => true;

const makeGeminiResponse = (text: string, sources: string[] = []) => ({
  ok: true,
  json: async () => ({
    candidates: [{
      content: { parts: [{ text }] },
      groundingMetadata: {
        groundingChunks: sources.map(uri => ({ web: { uri, title: 'Source' } })),
      },
    }],
  }),
});

describe('webSearch tool', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('sends a request with the correct query and returns parsed output', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiResponse('Search result text'));
    const result = await execute({ query: 'latest node version' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('Search result text');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(JSON.parse(opts.body).contents[0].parts[0].text).toContain('latest node version');
  });

  it('includes sources in output when grounding metadata is present', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiResponse('Result', ['https://example.com']));
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('https://example.com');
  });

  it('returns isError: true on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
  });

  it('returns isError: true when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('GEMINI_API_KEY');
  });

  it('returns isError: true when user rejects', async () => {
    const result = await execute({ query: 'test' }, async () => false);
    expect(result.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns isError: true on HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
  });

  it('returns isError: true when query is an empty string', async () => {
    const result = await execute({ query: '' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('no search query');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns isError: true when Gemini returns empty text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [] }, groundingMetadata: {} }],
      }),
    });
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
  });

  it('handles response with no candidates (?? [] fallback)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: 'quota exceeded' } }),
    });
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
  });

  it('filters out grounding chunks that lack a web.uri', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'some result' }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://example.com' } },
              { web: {} },
              {},
            ],
          },
        }],
      }),
    });
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('https://example.com');
  });

  it('handles response where groundingChunks is absent (?? [] fallback at line 114)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'some result' }] },
          groundingMetadata: {},
        }],
      }),
    });
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('some result');
  });

  it('uses String(err) for non-Error throw from fetch', async () => {
    mockFetch.mockRejectedValueOnce('network-string-error');
    const result = await execute({ query: 'test' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('network-string-error');
  });
});

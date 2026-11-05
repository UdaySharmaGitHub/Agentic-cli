import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock openai module so no real HTTP is issued
vi.mock('openai', () => {
  return { default: vi.fn() };
});

// Mock tools so the definitions come through cleanly
vi.mock('../../src/tools/index.js', () => ({
  getToolDefinitions: () => [
    {
      name: 'read_file',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: { filepath: { type: 'string', description: 'path' } },
        required: ['filepath'],
      },
    },
  ],
}));

import { streamMessage, createClient } from '../../src/openai.js';
import OpenAI from 'openai';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStream(chunks: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function makeClient(streamFn: ReturnType<typeof vi.fn>) {
  return {
    chat: { completions: { create: streamFn } },
  } as unknown as OpenAI;
}

describe('openai — createClient', () => {
  it('creates an OpenAI instance without throwing', () => {
    vi.mocked(OpenAI).mockImplementation(function () { return {} as OpenAI; } as unknown as typeof OpenAI);
    process.env.API_KEY = 'test-key';
    const client = createClient('gpt-4.1-mini');
    expect(client).toBeDefined();
  });

  it('falls back to empty API key when API_KEY is not set', () => {
    vi.mocked(OpenAI).mockImplementation(function () { return {} as OpenAI; } as unknown as typeof OpenAI);
    const saved = process.env.API_KEY;
    delete process.env.API_KEY;
    delete process.env.BASE_URL;
    const client = createClient('gpt-4');
    expect(client).toBeDefined();
    if (saved !== undefined) process.env.API_KEY = saved;
  });

  it('uses BASE_URL when set', () => {
    vi.mocked(OpenAI).mockImplementation(function () { return {} as OpenAI; } as unknown as typeof OpenAI);
    process.env.API_KEY = 'key';
    process.env.BASE_URL = 'https://proxy.example.com/v1';
    const client = createClient('gpt-4');
    expect(client).toBeDefined();
    delete process.env.BASE_URL;
  });
});

describe('openai — streamMessage', () => {
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createSpy = vi.fn();
  });

  it('collects text chunks and calls onText for each', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ' World' } }] },
      { choices: [{}] },
    ]));
    const collected: string[] = [];
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], t => collected.push(t));
    expect(result.text).toBe('Hello World');
    expect(collected).toEqual(['Hello', ' World']);
    expect(result.toolCalls).toHaveLength(0);
  });

  it('collects tool call chunks across multiple deltas', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read_file', arguments: '{"file' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'path":"/tmp/f.txt"}' } }] } }] },
      { choices: [{}] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('read_file');
    expect(result.toolCalls[0].function.arguments).toBe('{"filepath":"/tmp/f.txt"}');
    expect(result.toolCalls[0].id).toBe('call-1');
  });

  it('accumulates name across chunked tool call deltas', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'read', arguments: '' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: '_file', arguments: '{}' } }] } }] },
      { choices: [{}] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.toolCalls[0].function.name).toBe('read_file');
  });

  it('captures usage from the last chunk', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'hi' } }] },
      { choices: [{}], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('omits usage when not provided in any chunk', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'ok' } }] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.usage).toBeUndefined();
  });

  it('includes a system message when systemPrompt is non-empty', async () => {
    createSpy.mockResolvedValue(makeStream([{ choices: [{}] }]));
    await streamMessage(makeClient(createSpy), 'test-model', 'You are a helper.', [], () => {});
    const callArgs = createSpy.mock.calls[0][0];
    expect(callArgs.messages[0]).toMatchObject({ role: 'system', content: 'You are a helper.' });
  });

  it('omits system message when systemPrompt is empty string', async () => {
    createSpy.mockResolvedValue(makeStream([{ choices: [{}] }]));
    await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    const callArgs = createSpy.mock.calls[0][0];
    expect(callArgs.messages.find((m: { role: string }) => m.role === 'system')).toBeUndefined();
  });

  it('passes tools from getToolDefinitions to the API call', async () => {
    createSpy.mockResolvedValue(makeStream([{ choices: [{}] }]));
    await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    const callArgs = createSpy.mock.calls[0][0];
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].function.name).toBe('read_file');
  });

  it('handles multiple parallel tool calls (different indices)', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c0', function: { name: 'read_file', arguments: '{"filepath":"a"}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: 'c1', function: { name: 'read_file', arguments: '{"filepath":"b"}' } }] } }] },
      { choices: [{}] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].id).toBe('c0');
    expect(result.toolCalls[1].id).toBe('c1');
  });

  it('returns empty text and no tool calls for a completely empty stream', async () => {
    createSpy.mockResolvedValue(makeStream([]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.text).toBe('');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('uses empty-string fallbacks when tool call delta has no id or function', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0 }] } }] }, // no id, no function
      { choices: [{}] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.toolCalls[0].id).toBe('');
    expect(result.toolCalls[0].function.name).toBe('');
    expect(result.toolCalls[0].function.arguments).toBe('');
  });

  it('skips argument/name concat when existing-entry delta has empty values', async () => {
    createSpy.mockResolvedValue(makeStream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'fn', arguments: 'abc' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: '', arguments: '' } }] } }] },
      { choices: [{}] },
    ]));
    const result = await streamMessage(makeClient(createSpy), 'test-model', '', [], () => {});
    expect(result.toolCalls[0].function.arguments).toBe('abc');
    expect(result.toolCalls[0].function.name).toBe('fn');
  });
});

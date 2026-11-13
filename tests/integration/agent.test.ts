import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '../../src/memory.js';

// Mock OpenAI module
vi.mock('openai', () => {
  return { default: vi.fn() };
});

// Mock chalk and ora so the agent loop runs silently
vi.mock('chalk', () => {
  const c = (s: string) => s;
  c.bold = c; c.dim = c; c.green = Object.assign(c, { bold: c }); c.red = c;
  c.cyan = Object.assign(c, { bold: c }); c.yellow = c;
  return { default: c };
});
vi.mock('ora', () => ({ default: () => ({ start: () => ({ stop: vi.fn(), text: '' }), stop: vi.fn() }) }));

// Mock tools/index so no real filesystem or shell ops run
vi.mock('../../src/tools/index.js', () => ({
  getToolDefinitions: () => [],
  executeTool: vi.fn(),
}));

// Mock openai.js streamMessage
vi.mock('../../src/openai.js', () => ({
  streamMessage: vi.fn(),
}));

import { runAgentTurn } from '../../src/agent.js';
import { streamMessage } from '../../src/openai.js';
import { executeTool } from '../../src/tools/index.js';
import OpenAI from 'openai';

const mockStreamMessage = vi.mocked(streamMessage);
const mockExecuteTool = vi.mocked(executeTool);

const makeClient = () => ({} as OpenAI);
const confirm = async () => true;

function textResponse(text: string) {
  return { text, toolCalls: [], usage: undefined };
}

function toolCallResponse(name: string, args: Record<string, unknown>, text = '') {
  return {
    text,
    toolCalls: [{
      id: `call-${Date.now()}`,
      type: 'function' as const,
      function: { name, arguments: JSON.stringify(args) },
    }],
    usage: undefined,
  };
}

describe('agent integration — runAgentTurn', () => {
  let messages: ChatMessage[];

  beforeEach(() => {
    messages = [];
    mockStreamMessage.mockReset();
    mockExecuteTool.mockReset();
  });

  it('single-turn: LLM returns text only — loop exits after one step', async () => {
    mockStreamMessage.mockResolvedValueOnce(textResponse('Done!'));
    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false });
    expect(mockStreamMessage).toHaveBeenCalledOnce();
    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Done!' });
  });

  it('tool call → result → final answer', async () => {
    mockStreamMessage
      .mockResolvedValueOnce(toolCallResponse('read_file', { filepath: '/tmp/f.txt' }))
      .mockResolvedValueOnce(textResponse('I read the file.'));
    mockExecuteTool.mockResolvedValueOnce({ output: 'file contents', isError: false });

    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false });

    expect(mockStreamMessage).toHaveBeenCalledTimes(2);
    expect(mockExecuteTool).toHaveBeenCalledOnce();
    const toolMsg = messages.find(m => m.role === 'tool') as Extract<ChatMessage, { role: 'tool' }>;
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toBe('file contents');
  });

  it('multi-step: two tool calls before final answer', async () => {
    mockStreamMessage
      .mockResolvedValueOnce(toolCallResponse('read_file', { filepath: '/tmp/a.txt' }))
      .mockResolvedValueOnce(toolCallResponse('read_file', { filepath: '/tmp/b.txt' }))
      .mockResolvedValueOnce(textResponse('All done.'));
    mockExecuteTool
      .mockResolvedValueOnce({ output: 'content-a', isError: false })
      .mockResolvedValueOnce({ output: 'content-b', isError: false });

    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 10, confirm, showRaw: false });

    expect(mockStreamMessage).toHaveBeenCalledTimes(3);
    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
  });

  it('maxSteps guard: aborts after maxSteps even if LLM keeps calling tools', async () => {
    // Always return a tool call so the loop would run forever without the guard
    mockStreamMessage.mockResolvedValue(toolCallResponse('read_file', { filepath: '/tmp/x.txt' }));
    mockExecuteTool.mockResolvedValue({ output: 'ok', isError: false });

    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 3, confirm, showRaw: false });

    expect(mockStreamMessage).toHaveBeenCalledTimes(3);
  });

  it('tool error propagation: error result is sent back as tool message', async () => {
    mockStreamMessage
      .mockResolvedValueOnce(toolCallResponse('read_file', { filepath: '/bad/path' }))
      .mockResolvedValueOnce(textResponse('Could not read the file.'));
    mockExecuteTool.mockResolvedValueOnce({ output: 'ERROR — file not found', isError: true });

    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false });

    const toolMsg = messages.find(m => m.role === 'tool') as Extract<ChatMessage, { role: 'tool' }>;
    expect(toolMsg.content).toContain('ERROR');
  });

  it('streaming onText callback is invoked when LLM streams text', async () => {
    // mockStreamMessage calls onText twice: first call triggers textStarted path, second covers the else branch
    mockStreamMessage.mockImplementationOnce(async (_client, _model, _sys, _msgs, onText) => {
      onText('streamed ');
      onText('text');
      return { text: 'streamed text', toolCalls: [], usage: undefined };
    });
    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false });
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', content: 'streamed text' });
  });

  it('API error: gracefully returns when streamMessage throws', async () => {
    mockStreamMessage.mockRejectedValueOnce(new Error('Connection refused'));
    await expect(
      runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false })
    ).resolves.toBeUndefined();
    expect(messages).toHaveLength(0);
  });

  it('API error: handles non-Error throw from streamMessage (String(err) branch)', async () => {
    mockStreamMessage.mockRejectedValueOnce('non-error-api-failure');
    await expect(
      runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: false })
    ).resolves.toBeUndefined();
    expect(messages).toHaveLength(0);
  });

  it('showRaw: logs raw response when showRaw is true', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockStreamMessage.mockResolvedValueOnce(textResponse('Done'));
    await runAgentTurn(makeClient(), messages, '', { model: 'gpt-4.1-mini', maxSteps: 5, confirm, showRaw: true });
    consoleSpy.mockRestore();
    // showRaw path executed — no assertion on console (mocked), just ensure no throw
    expect(messages.at(-1)).toMatchObject({ role: 'assistant' });
  });
});

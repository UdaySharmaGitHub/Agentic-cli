import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';
import { emit, onEvent } from '../../../src/tui/events.js';
import type { AgentEvent } from '../../../src/tui/events.js';

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// A minimal test component that listens to agent events and renders them
function TestConsumer() {
  const [msgs, setMsgs] = React.useState<string[]>([]);
  const [thinking, setThinking] = React.useState(false);

  React.useEffect(() => {
    const unsub = onEvent((e: AgentEvent) => {
      if (e.type === 'agent:thinking') setThinking(true);
      if (e.type === 'agent:stream:end') {
        setThinking(false);
        setMsgs(prev => [...prev, e.fullText]);
      }
      if (e.type === 'agent:error') {
        setThinking(false);
        setMsgs(prev => [...prev, `ERROR: ${e.msg}`]);
      }
    });
    return unsub;
  }, []);

  return (
    <Box flexDirection="column">
      {thinking && <Text>Thinking...</Text>}
      {msgs.map((m, i) => <Text key={i}>{m}</Text>)}
    </Box>
  );
}

describe('TUI agentRunner integration', () => {
  it('renders without crashing on initial mount', async () => {
    const { lastFrame } = render(<TestConsumer />);
    await delay(30);
    expect(lastFrame()).toBeDefined();
  });

  it('displays Thinking... while agent is running', async () => {
    const { lastFrame } = render(<TestConsumer />);
    await delay(30);
    emit({ type: 'agent:thinking' });
    await delay(100);
    expect(lastFrame()).toContain('Thinking...');
  });

  it('renders agent output messages after stream ends', async () => {
    const { lastFrame } = render(<TestConsumer />);
    await delay(30);
    emit({ type: 'agent:thinking' });
    emit({ type: 'agent:stream:start' });
    emit({ type: 'agent:stream:end', fullText: 'Hello world' });
    await delay(100);
    expect(lastFrame()).toContain('Hello world');
  });

  it('renders error messages on agent:error', async () => {
    const { lastFrame } = render(<TestConsumer />);
    await delay(30);
    emit({ type: 'agent:error', msg: 'API timeout' });
    await delay(100);
    expect(lastFrame()).toContain('ERROR: API timeout');
  });

  it('event bus emits and receives events correctly', () => {
    const received: AgentEvent[] = [];
    const unsub = onEvent(e => received.push(e));
    emit({ type: 'agent:thinking' });
    emit({ type: 'agent:complete', steps: 2 });
    unsub();
    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('agent:thinking');
    expect(received[1].type).toBe('agent:complete');
  });
});

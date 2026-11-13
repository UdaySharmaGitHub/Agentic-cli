import { describe, it, expect } from 'vitest';
import { emit, onEvent, makeConfirmFn } from '../../../src/tui/events.js';
import type { AgentEvent } from '../../../src/tui/events.js';

describe('events bus', () => {
  it('onEvent receives emitted events', () => {
    const received: AgentEvent[] = [];
    const unsub = onEvent(e => received.push(e));
    emit({ type: 'agent:thinking' });
    unsub();
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('agent:thinking');
  });

  it('unsub stops receiving events', () => {
    const received: AgentEvent[] = [];
    const unsub = onEvent(e => received.push(e));
    emit({ type: 'agent:thinking' });
    unsub();
    emit({ type: 'agent:complete', steps: 1 });
    expect(received).toHaveLength(1);
  });

  it('multiple listeners each receive the event', () => {
    const a: AgentEvent[] = [];
    const b: AgentEvent[] = [];
    const u1 = onEvent(e => a.push(e));
    const u2 = onEvent(e => b.push(e));
    emit({ type: 'step:start', step: 2, max: 5 });
    u1(); u2();
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('makeConfirmFn resolves true when confirm:response answer is true', async () => {
    const fn = makeConfirmFn();
    // Register responder BEFORE calling fn — EventEmitter fires synchronously
    const unsub = onEvent(e => {
      if (e.type === 'confirm:request') {
        emit({ type: 'confirm:response', id: e.id, answer: true });
        unsub();
      }
    });
    expect(await fn('Allow this?')).toBe(true);
  });

  it('makeConfirmFn resolves false when confirm:response answer is false', async () => {
    const fn = makeConfirmFn();
    const unsub = onEvent(e => {
      if (e.type === 'confirm:request') {
        emit({ type: 'confirm:response', id: e.id, answer: false });
        unsub();
      }
    });
    expect(await fn('Deny this?')).toBe(false);
  });
});

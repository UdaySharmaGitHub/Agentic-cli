import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ConfirmFn } from '../tools/types.js';

export type AgentEvent =
  | { type: 'agent:thinking' }
  | { type: 'agent:stream:start' }
  | { type: 'agent:stream:token'; text: string }
  | { type: 'agent:stream:end'; fullText: string }
  | { type: 'agent:complete'; steps: number }
  | { type: 'agent:maxsteps'; max: number }
  | { type: 'agent:error'; msg: string }
  | { type: 'step:start'; step: number; max: number }
  | { type: 'tool:call'; name: string; description: string }
  | { type: 'tool:result'; name: string; output: string }
  | { type: 'tool:blocked'; reason: string }
  | { type: 'tool:rejected' }
  | { type: 'confirm:request'; id: string; message: string }
  | { type: 'confirm:response'; id: string; answer: boolean }
  | { type: 'info'; text: string; variant: 'success' | 'error' | 'warning' | 'dim' }
  | { type: 'export:success'; files: string[] }
  | { type: 'export:empty' }
  | { type: 'replay:header'; task: string; count: number }
  | { type: 'replay:step'; current: number; total: number; reasoning: string; command: string }
  | { type: 'replay:complete'; done: number; total: number };

const _bus = new EventEmitter();
_bus.setMaxListeners(50);

export function emit(event: AgentEvent): void {
  _bus.emit('e', event);
}

export function onEvent(handler: (e: AgentEvent) => void): () => void {
  _bus.on('e', handler);
  return () => _bus.off('e', handler);
}

export function makeConfirmFn(): ConfirmFn {
  return (message: string) => {
    const id = randomUUID();
    return new Promise<boolean>((resolve) => {
      const unsub = onEvent((e) => {
        if (e.type === 'confirm:response' && e.id === id) {
          unsub();
          resolve(e.answer);
        }
      });
      emit({ type: 'confirm:request', id, message });
    });
  };
}

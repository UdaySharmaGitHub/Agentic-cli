// ─────────────────────────────────────────────────────────────────────────────
//  Memory — chat history persistence (OpenAI message format)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';

// ── OpenAI-compatible message types ──────────────────────────────────────────

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

let messages: ChatMessage[] = [];

export function getMessages(): ChatMessage[] {
  return messages;
}

export function pushMessage(msg: ChatMessage): void {
  messages.push(msg);
}

export function clearMessages(): void {
  messages.length = 0;
}

export function messageCount(): number {
  return messages.length;
}

/** Load history from <sessionPath>/chat_history.json into module-level messages. */
export async function loadHistory(sessionPath: string): Promise<void> {
  try {
    const file = path.join(sessionPath, 'chat_history.json');
    const data = await fs.readFile(file, 'utf-8');
    const loaded = JSON.parse(data) as ChatMessage[];
    messages.length = 0;
    messages.push(...loaded);
  } catch {
    messages.length = 0;
  }
}

/** Persist module-level messages to <sessionPath>/chat_history.json. */
export async function saveHistory(sessionPath: string): Promise<void> {
  try {
    const file = path.join(sessionPath, 'chat_history.json');
    await fs.mkdir(sessionPath, { recursive: true });
    await fs.writeFile(file, JSON.stringify(messages, null, 2), 'utf-8');
  } catch {
    // Silently fail — history is not critical
  }
}

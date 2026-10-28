// ─────────────────────────────────────────────────────────────────────────────
//  Tokens — per-turn and session-level token usage tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface TurnUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Accumulated across all API calls in the session
let sessionPrompt = 0;
let sessionCompletion = 0;
let lastTurn: TurnUsage | null = null;

export function recordUsage(u: TurnUsage): void {
  sessionPrompt += u.promptTokens;
  sessionCompletion += u.completionTokens;
  lastTurn = { ...u };
}

export function getLastTurn(): TurnUsage | null {
  return lastTurn;
}

export function getSession(): TurnUsage {
  return {
    promptTokens: sessionPrompt,
    completionTokens: sessionCompletion,
    totalTokens: sessionPrompt + sessionCompletion,
  };
}

export function resetTokens(): void {
  sessionPrompt = 0;
  sessionCompletion = 0;
  lastTurn = null;
}

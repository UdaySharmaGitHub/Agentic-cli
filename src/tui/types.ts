export type LogItem =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string }
  | { id: string; kind: 'tool-header'; name: string; description: string }
  | { id: string; kind: 'tool-result'; name: string; output: string }
  | { id: string; kind: 'step'; step: number; max: number }
  | { id: string; kind: 'info'; text: string; variant: 'success' | 'error' | 'warning' | 'dim' }
  | { id: string; kind: 'separator' };

export type LogItemInput =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool-header'; name: string; description: string }
  | { kind: 'tool-result'; name: string; output: string }
  | { kind: 'step'; step: number; max: number }
  | { kind: 'info'; text: string; variant: 'success' | 'error' | 'warning' | 'dim' }
  | { kind: 'separator' };


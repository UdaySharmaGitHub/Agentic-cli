import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Static, useApp } from 'ink';
import OpenAI from 'openai';
import {
  onEvent,
  emit,
  makeConfirmFn,
  type AgentEvent,
} from './events.js';
import type { LogItem, LogItemInput } from './types.js';
import type { ChatMessage } from '../memory.js';
import { runAgentTurn } from './agentRunner.js';
import {
  setCurrentTask,
  hasSteps,
  exportMarkdown,
  exportShell,
  exportHtml,
} from '../runbook.js';
import { parseShellRunbook } from '../replay.js';
import { executeTool } from '../tools/index.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { LogItemView } from './components/LogItemView.js';
import { ThinkingSpinner } from './components/Spinner.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { InputBar } from './components/InputBar.js';
import { NarrowWarning } from './components/NarrowWarning.js';

interface Props {
  client: OpenAI;
  modelId: string;
  yolo: boolean;
}

let _idCounter = 0;
function nextId() { return String(++_idCounter); }

export function App({ client, modelId, yolo }: Props) {
  const { exit } = useApp();
  const { columns } = useTerminalSize();

  const [staticLog, setStaticLog] = useState<LogItem[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [confirmReq, setConfirmReq] = useState<{ id: string; message: string } | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);

  const historyRef = useRef<ChatMessage[]>([]);
  const confirmFnRef = useRef(yolo ? async () => true : makeConfirmFn());

  const appendLog = useCallback((item: LogItemInput) => {
    setStaticLog(prev => [...prev, { ...item, id: nextId() } as LogItem]);
  }, []);

  // Subscribe to agent events
  useEffect(() => {
    const unsub = onEvent((e: AgentEvent) => {
      switch (e.type) {
        case 'agent:thinking':
          setThinking(true);
          setStreaming(null);
          break;

        case 'agent:stream:start':
          setThinking(false);
          setStreaming('');
          break;

        case 'agent:stream:token':
          setStreaming(prev => (prev ?? '') + e.text);
          break;

        case 'agent:stream:end':
          setStreaming(null);
          appendLog({ kind: 'assistant', text: e.fullText });
          break;

        case 'agent:complete':
          appendLog({ kind: 'info', text: `✔ Task complete after ${e.steps} step(s).`, variant: 'success' });
          break;

        case 'agent:maxsteps':
          appendLog({ kind: 'info', text: `⚠️  Reached max steps (${e.max}). Stopping.`, variant: 'warning' });
          break;

        case 'agent:error':
          setThinking(false);
          setStreaming(null);
          appendLog({ kind: 'info', text: `❌ Error: ${e.msg}`, variant: 'error' });
          break;

        case 'step:start':
          appendLog({ kind: 'step', step: e.step, max: e.max });
          break;

        case 'tool:call':
          appendLog({ kind: 'tool-header', name: e.name, description: e.description });
          break;

        case 'tool:result':
          appendLog({ kind: 'tool-result', name: e.name, output: e.output });
          break;

        case 'tool:blocked':
          appendLog({ kind: 'info', text: `🚫 BLOCKED: ${e.reason}`, variant: 'error' });
          break;

        case 'tool:rejected':
          appendLog({ kind: 'info', text: '✖ Action rejected by user.', variant: 'warning' });
          break;

        case 'confirm:request':
          setConfirmReq({ id: e.id, message: e.message });
          break;

        case 'info':
          appendLog({ kind: 'info', text: e.text, variant: e.variant });
          break;

        case 'export:success':
          appendLog({ kind: 'info', text: '✔ Runbook exported:', variant: 'success' });
          for (const f of e.files) appendLog({ kind: 'info', text: `    ${f}`, variant: 'dim' });
          break;

        case 'export:empty':
          appendLog({ kind: 'info', text: '⚠  Nothing to export — run a task first.', variant: 'warning' });
          break;

        case 'replay:header':
          appendLog({ kind: 'separator' });
          appendLog({ kind: 'info', text: `  ┌─ Replay: ${e.task} (${e.count} steps)`, variant: 'dim' });
          break;

        case 'replay:step':
          appendLog({ kind: 'info', text: `  ── Command ${e.current} / ${e.total}`, variant: 'dim' });
          if (e.reasoning) appendLog({ kind: 'info', text: `  Reasoning: ${e.reasoning}`, variant: 'dim' });
          appendLog({ kind: 'info', text: `  $ ${e.command}`, variant: 'warning' });
          break;

        case 'replay:complete':
          appendLog({ kind: 'info', text: `✔ Replay complete — ${e.done}/${e.total} command(s) executed.`, variant: 'success' });
          break;
      }
    });
    return unsub;
  }, [appendLog]);

  const handleConfirmAnswer = useCallback((answer: boolean) => {
    if (!confirmReq) return;
    emit({ type: 'confirm:response', id: confirmReq.id, answer });
    setConfirmReq(null);
  }, [confirmReq]);

  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed || !inputEnabled) return;

    // --- Slash commands (sync) ---
    if (trimmed === '/exit' || trimmed === '/quit') {
      exit();
      return;
    }

    if (trimmed === '/clear') {
      setStaticLog([]);
      historyRef.current = [];
      return;
    }

    if (trimmed === '/help') {
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Agentic CLI', variant: 'success' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Tools available:', variant: 'dim' });
      for (const t of [
        '    read_file       — Read file contents',
        '    write_file      — Create or overwrite a file',
        '    append_file     — Append to a file',
        '    modify_file     — Find-and-replace in a file',
        '    list_directory  — List directory contents',
        '    run_command     — Execute a shell command',
        '    search_files    — Glob-based file search',
        '    web_search      — Real-time web search',
      ]) appendLog({ kind: 'info', text: t, variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  REPL commands:', variant: 'dim' });
      for (const c of [
        '    /exit /quit     — Exit the CLI',
        '    /clear          — Clear conversation history',
        '    /help           — Show this help',
        '    /export [html|md|sh|both]  — Export session as runbook',
        '    /replay <file.sh>          — Replay a runbook step by step',
      ]) appendLog({ kind: 'info', text: c, variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Flags:', variant: 'dim' });
      appendLog({ kind: 'info', text: '    --yolo          — Auto-approve all actions', variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      return;
    }

    if (trimmed === '/status') {
      appendLog({ kind: 'info', text: `  Model:    ${modelId}`, variant: 'dim' });
      appendLog({ kind: 'info', text: `  History:  ${historyRef.current.length} messages`, variant: 'dim' });
      return;
    }

    // --- Async commands ---
    setInputEnabled(false);

    if (trimmed.startsWith('/export')) {
      const arg = trimmed.slice('/export'.length).trim().toLowerCase() || 'html';
      if (!['md', 'sh', 'html', 'both'].includes(arg)) {
        appendLog({ kind: 'info', text: '  Usage: /export [html|md|sh|both]', variant: 'dim' });
        setInputEnabled(true);
        return;
      }
      (async () => {
        try {
          if (!hasSteps()) { emit({ type: 'export:empty' }); return; }
          const exported: string[] = [];
          if (arg === 'md')   exported.push(await exportMarkdown());
          if (arg === 'sh')   exported.push(await exportShell());
          if (arg === 'html') exported.push(await exportHtml());
          if (arg === 'both') {
            exported.push(await exportMarkdown());
            exported.push(await exportShell());
            exported.push(await exportHtml());
          }
          emit({ type: 'export:success', files: exported });
        } catch (err) {
          emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
        } finally {
          setInputEnabled(true);
        }
      })();
      return;
    }

    if (trimmed.startsWith('/replay')) {
      const filePath = trimmed.slice('/replay'.length).trim();
      if (!filePath) {
        appendLog({ kind: 'info', text: '  Usage: /replay <path-to-runbook.sh>', variant: 'dim' });
        setInputEnabled(true);
        return;
      }
      (async () => {
        try {
          const runbook = await parseShellRunbook(filePath);
          if (runbook.steps.length === 0) {
            emit({ type: 'info', text: '❌ No commands found in that runbook.', variant: 'error' });
            return;
          }
          emit({ type: 'replay:header', task: runbook.task, count: runbook.steps.length });
          let done = 0;
          for (const step of runbook.steps) {
            emit({ type: 'replay:step', current: done + 1, total: runbook.steps.length, reasoning: step.reasoning, command: step.command });
            const approved = await confirmFnRef.current(`Run: ${step.command}`);
            if (!approved) { emit({ type: 'tool:rejected' }); continue; }
            const result = await executeTool('run_command', { command: step.command }, confirmFnRef.current);
            emit({ type: 'tool:result', name: 'run_command', output: result.output });
            done++;
          }
          emit({ type: 'replay:complete', done, total: runbook.steps.length });
        } catch (err) {
          emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
        } finally {
          setInputEnabled(true);
        }
      })();
      return;
    }

    // --- Agent turn ---
    appendLog({ kind: 'user', text: trimmed });
    setCurrentTask(trimmed);
    historyRef.current.push({ role: 'user', content: trimmed });

    runAgentTurn(client, modelId, historyRef.current, confirmFnRef.current).finally(() => {
      setThinking(false);
      setStreaming(null);
      setInputEnabled(true);
    });
  }, [inputEnabled, appendLog, client, modelId, exit]);

  if (columns < 40) return <NarrowWarning />;

  return (
    <Box flexDirection="column">
      {/* Immutable history — rendered once, never re-rendered */}
      <Static items={staticLog}>
        {(item) => <LogItemView key={item.id} item={item} columns={columns} />}
      </Static>

      {/* Live area */}
      {thinking && <ThinkingSpinner />}
      {streaming !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{'  🤖 Agent:'}</Text>
          <Text>{' '}</Text>
          <Text color="white">{streaming}</Text>
        </Box>
      )}
      {confirmReq && (
        <ConfirmDialog
          message={confirmReq.message}
          onAnswer={handleConfirmAnswer}
        />
      )}
      {inputEnabled && !confirmReq && (
        <InputBar onSubmit={handleSubmit} />
      )}
    </Box>
  );
}

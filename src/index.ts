#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { executeTool } from "./tools/index.js";
import type { ConfirmFn } from "./tools/types.js";
import { createClient, streamMessage } from "./openai.js";
import { DEFAULT_MODEL } from "./config.js";
import {
  printBanner,
  printWelcome,
  printHelp,
  printStatus,
  printAgentStep,
  printAgentComplete,
  printAgentMaxSteps,
  printAgentError,
  printToolResult,
  printRejected,
  createSpinner,
  formatConfirmPrompt,
  printExportSuccess,
  printExportEmpty,
  printExportUsage,
  printReplayHeader,
  printReplayStep,
  printReplayComplete,
  printReplayUsage,
  printTokenLine,
  printCompactSuccess,
  printCompactSkipped,
} from "./ui.js";
import {
  initSession,
  setCurrentTask,
  recordStep,
  hasSteps,
  exportMarkdown,
  exportShell,
  exportHtml,
} from "./runbook.js";
import { parseShellRunbook } from "./replay.js";
import { recordUsage, getLastTurn, getSession, resetTokens } from "./tokens.js";
import {
  loadHistory,
  saveHistory,
  getMessages,
  clearMessages,
} from "./memory.js";
import {
  initSessions,
  createSession,
  deleteSession,
  renameSession,
  loadIndex,
  saveIndex,
  incrementTurns,
  getSessionDir,
} from "./sessions.js";

async function main() {
  // Launch Ink TUI when running in a real terminal; fall back to chalk for pipes/CI.
  if (process.stdout.isTTY) {
    const { startTUI } = await import("./tui/start.js");
    await startTUI();
    return;
  }

  // ── Chalk fallback for non-TTY environments ──────────────────────────────────
  const apiKey = process.env["API_KEY"];
  if (!apiKey) {
    console.error("Error: API_KEY is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const yolo = process.argv.includes("--yolo");
  const modelId = DEFAULT_MODEL;

  // Parse --session <name>
  const sessionArgIdx = process.argv.indexOf("--session");
  const requestedSession = sessionArgIdx !== -1 ? process.argv[sessionArgIdx + 1] : undefined;

  const { name: sessionName, path: sessionPath } = await initSessions(requestedSession);
  await loadHistory(sessionPath);

  // Current session — reassigned on /session switch, new, rename
  let activeSession = sessionName;
  let activeSessionPath = sessionPath;

  // Flush current session on signal exit (reads the let, so it follows switches)
  const flush = () => { void saveHistory(activeSessionPath); };
  process.on("SIGINT", flush);
  process.on("SIGTERM", flush);

  const client = createClient(modelId);
  // history is the same array reference held by the memory module
  const history = getMessages();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${sessionName}] > `,
  });

  // Pending confirmation: set when a tool asks for approval,
  // resolved by the next line event (avoids rl.question() state conflicts).
  let pendingAnswer: ((answer: string) => void) | null = null;

  const confirm: ConfirmFn = yolo
    ? async () => true
    : (message: string) =>
        new Promise<boolean>((resolve) => {
          process.stdout.write(formatConfirmPrompt(message));
          pendingAnswer = (input: string) => {
            pendingAnswer = null;
            resolve(input === "y" || input === "yes");
          };
        });

  await printBanner();
  printWelcome();
  initSession(modelId);
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    // Route line to pending confirmation before treating it as a new command.
    if (pendingAnswer) {
      pendingAnswer(input.toLowerCase());
      return;
    }

    if (!input) { rl.prompt(); return; }

    if (input === "/exit" || input === "/quit") { await saveHistory(activeSessionPath); process.exit(0); }
    if (input === "/clear") { history.length = 0; resetTokens(); console.clear(); rl.prompt(); return; }
    if (input === "/help") { printHelp(); rl.prompt(); return; }
    if (input === "/status") {
      const last = getLastTurn();
      const sess = getSession();
      printStatus(modelId, history.length, last
        ? { lastPrompt: last.promptTokens, sessionTotal: sess.totalTokens }
        : undefined,
      );
      console.log(`  Session:  ${activeSession}`);
      rl.prompt();
      return;
    }

    // --- Session commands ---
    if (input === "/session" || input.startsWith("/session ")) {
      const parts = input.split(/\s+/);
      const sub = parts[1];

      if (!sub) {
        const index = await loadIndex();
        const entry = index.sessions.find(s => s.name === activeSession);
        console.log(`  Active session: ${activeSession}`);
        console.log(`  Turns: ${entry?.turns ?? 0}`);
        console.log(`  Last active: ${entry ? new Date(entry.lastActiveAt).toLocaleString() : 'now'}`);
        rl.prompt();
        return;
      }

      if (sub === "list") {
        const index = await loadIndex();
        console.log("  Sessions:");
        for (const s of index.sessions) {
          const marker = s.name === activeSession ? "* " : "  ";
          console.log(`  ${marker}${s.name}  (${s.turns} turns, last active ${new Date(s.lastActiveAt).toLocaleString()})`);
        }
        rl.prompt();
        return;
      }

      if (sub === "new") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session new <name>"); rl.prompt(); return; }
        try {
          await saveHistory(activeSessionPath);
          await createSession(name);
          const newPath = getSessionDir(name);
          clearMessages();
          const index = await loadIndex();
          index.active = name;
          await saveIndex(index);
          activeSession = name;
          activeSessionPath = newPath;
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Created and switched to session "${name}"`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "switch") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session switch <name>"); rl.prompt(); return; }
        try {
          const index = await loadIndex();
          const entry = index.sessions.find(s => s.name === name);
          if (!entry) throw new Error(`Session "${name}" not found. Use /session new <name> to create it.`);
          await saveHistory(activeSessionPath);
          const newPath = getSessionDir(name);
          clearMessages();
          await loadHistory(newPath);
          index.active = name;
          entry.lastActiveAt = new Date().toISOString();
          await saveIndex(index);
          activeSession = name;
          activeSessionPath = newPath;
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Switched to session "${name}" (${entry.turns} turns)`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "rename") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session rename <new-name>"); rl.prompt(); return; }
        try {
          await renameSession(activeSession, name);
          activeSession = name;
          activeSessionPath = getSessionDir(name);
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Session renamed to "${name}"`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "delete") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session delete <name>"); rl.prompt(); return; }
        try {
          const confirmed = await confirm(`Delete session "${name}"? This cannot be undone.`);
          if (!confirmed) { console.log("  Cancelled."); rl.prompt(); return; }
          await deleteSession(name, activeSession);
          console.log(`  ✔ Session "${name}" deleted.`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      console.log(`  Unknown subcommand: ${sub}. Try /help.`);
      rl.prompt();
      return;
    }

    if (input === "/compact") {
      const KEEP_LAST = 6;
      if (history.length < KEEP_LAST + 2) {
        printCompactSkipped();
        rl.prompt();
        return;
      }
      const oldMessages = history.slice(0, history.length - KEEP_LAST);
      const recentMessages = history.slice(history.length - KEEP_LAST);
      const compactSpinner = createSpinner("Summarising context...").start();
      try {
        const summaryMessages = [
          ...oldMessages,
          {
            role: "user" as const,
            content:
              "Provide a dense, structured summary of our conversation so far. Include: tasks attempted, tools used, files created/modified, commands run and their outcomes, key decisions, and any context needed to continue seamlessly. Be specific — include file names, command outputs, and concrete results.",
          },
        ];
        const summaryResponse = await streamMessage(client, modelId, "", summaryMessages, () => {});
        compactSpinner.stop();
        if (summaryResponse.usage) recordUsage(summaryResponse.usage);
        const newHistory = [
          {
            role: "user" as const,
            content: `[COMPACTED — ${oldMessages.length} prior messages summarised]\n\n${summaryResponse.text}`,
          },
          {
            role: "assistant" as const,
            content: "Understood. I have full context from the summarised history and am ready to continue.",
          },
          ...recentMessages,
        ];
        history.length = 0;
        history.push(...newHistory);
        printCompactSuccess(oldMessages.length, KEEP_LAST);
      } catch (err) {
        compactSpinner.stop();
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    if (input.startsWith("/export")) {
      const arg = input.slice("/export".length).trim().toLowerCase() || "html";
      if (!["md", "sh", "html", "both"].includes(arg)) { printExportUsage(); rl.prompt(); return; }
      if (!hasSteps()) { printExportEmpty(); rl.prompt(); return; }
      try {
        const exported: string[] = [];
        if (arg === "md")   exported.push(await exportMarkdown());
        if (arg === "sh")   exported.push(await exportShell());
        if (arg === "html") exported.push(await exportHtml());
        if (arg === "both") {
          exported.push(await exportMarkdown());
          exported.push(await exportShell());
          exported.push(await exportHtml());
        }
        printExportSuccess(exported);
      } catch (err) {
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    if (input.startsWith("/replay")) {
      const filePath = input.slice("/replay".length).trim();
      if (!filePath) { printReplayUsage(); rl.prompt(); return; }
      try {
        const runbook = await parseShellRunbook(filePath);
        if (runbook.steps.length === 0) {
          printAgentError("No commands found in that runbook.");
          rl.prompt();
          return;
        }
        printReplayHeader(runbook.task, runbook.steps.length);
        let done = 0;
        for (const step of runbook.steps) {
          printReplayStep(done + 1, runbook.steps.length, step.reasoning, step.command);
          const approved = await confirm(`Run: ${step.command}`);
          if (!approved) { printRejected(); continue; }
          const result = await executeTool("run_command", { command: step.command }, confirm);
          printToolResult("run_command", result.output);
          recordStep({
            reasoning: step.reasoning,
            toolName: "run_command",
            toolArgs: { command: step.command },
            toolResult: result.output,
          });
          done++;
        }
        printReplayComplete(done, runbook.steps.length);
      } catch (err) {
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    history.push({ role: "user", content: input });
    setCurrentTask(input);

    const spinner = createSpinner("Thinking…").start();
    let steps = 0;
    const maxSteps = 15;

    try {
      let continueLoop = true;

      while (continueLoop && steps < maxSteps) {
        let textStarted = false;

        const response = await streamMessage(client, modelId, "", history, (text) => {
          if (!textStarted) {
            spinner.stop();
            textStarted = true;
            console.log();
          }
          process.stdout.write(text);
        });

        if (!textStarted) spinner.stop();
        if (textStarted) console.log();

        if (response.usage) recordUsage(response.usage);

        if (response.toolCalls.length > 0) {
          history.push({
            role: "assistant",
            content: response.text || null,
            tool_calls: response.toolCalls,
          });
        } else {
          history.push({ role: "assistant", content: response.text });
        }

        if (response.toolCalls.length === 0) {
          if (steps > 0) printAgentComplete(steps);
          continueLoop = false;
        } else {
          steps++;
          if (steps > 1) printAgentStep(steps, maxSteps);

          for (const call of response.toolCalls) {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            const toolResult = await executeTool(call.function.name, args, confirm);
            printToolResult(call.function.name, toolResult.output);
            recordStep({
              reasoning: response.text ?? "",
              toolName: call.function.name,
              toolArgs: args,
              toolResult: toolResult.output,
            });
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: toolResult.output,
            });
          }

          spinner.start("Thinking…");
        }
      }

      if (steps >= maxSteps) {
        printAgentMaxSteps(maxSteps);
      }
    } catch (err) {
      spinner.stop();
      printAgentError(err instanceof Error ? err.message : String(err));
    }

    // Persist after each turn
    try {
      await incrementTurns(activeSession);
      await saveHistory(activeSessionPath);
    } catch (err) {
      printAgentError(err instanceof Error ? err.message : String(err));
    }

    const last = getLastTurn();
    if (last) {
      printTokenLine(last.promptTokens, getSession().totalTokens);
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await saveHistory(activeSessionPath);
    process.exit(0);
  });
}

main();

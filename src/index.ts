#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { executeTool } from "./tools/index.js";
import type { ConfirmFn } from "./tools/types.js";
import type { ChatMessage } from "./memory.js";
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

  const client = createClient(modelId);
  const history: ChatMessage[] = [];

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });

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

    if (input === "/exit" || input === "/quit") { process.exit(0); }
    if (input === "/clear") { history.length = 0; console.clear(); rl.prompt(); return; }
    if (input === "/help") { printHelp(); rl.prompt(); return; }
    if (input === "/status") { printStatus(modelId, history.length); rl.prompt(); return; }

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

        // Add assistant message to history
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

    rl.prompt();
  });

  rl.on("close", () => process.exit(0));
}

main();

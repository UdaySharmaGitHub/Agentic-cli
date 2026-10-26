import chalk from 'chalk';
import ora, { type Ora } from 'ora';

// ── Banner & welcome ──────────────────────────────────────────────────────────

export async function printBanner(): Promise<void> {
  console.log();
  const bannerLines = [
    ' █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗     ██████╗██╗     ██╗',
    '██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝    ██╔════╝██║     ██║',
    '███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║         ██║     ██║     ██║',
    '██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║         ██║     ██║     ██║',
    '██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗    ╚██████╗███████╗██║',
    '╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝     ╚═════╝╚══════╝╚═╝',
  ];
  const gradientColors: [number, number, number][] = [
    [255, 230,   0],
    [255, 195,   0],
    [255, 155,   0],
    [255, 100,   0],
    [235,  45,   0],
    [200,   0,   0],
  ];
  console.log(bannerLines.map((line, i) => chalk.rgb(...gradientColors[i])(line)).join('\n'));
  console.log();
  console.log(chalk.dim('  Agentic CLI v4.2'));
  console.log(chalk.dim('  Powered by Google Gemini'));
  console.log();
}

export function printWelcome(): void {
  console.log(chalk.bold('  🚀 Agent ready! Type your request below.'));
  console.log(chalk.dim("  (type '/help' for commands, '/exit' to quit)"));
  console.log();
}

// ── Layout helpers ────────────────────────────────────────────────────────────

export function printSeparator(): void {
  console.log(chalk.dim('  ────────────────────────────────────────────────────'));
}

export function printDimOutput(lines: string[], maxLines?: number): void {
  const display = maxLines !== undefined ? lines.slice(0, maxLines) : lines;
  for (const line of display) {
    console.log(chalk.dim(`  ${line}`));
  }
}

// ── Tool display ──────────────────────────────────────────────────────────────

export function printToolHeader(name: string, description: string): void {
  console.log();
  console.log(chalk.cyan.bold(`  ┌─ Tool: ${name}`));
  console.log(chalk.dim(`  │  ${description}`));
  console.log(chalk.cyan('  └──────────────────────────────────────────────────'));
  console.log();
}

export function printToolSuccess(msg: string): void {
  console.log(chalk.green(`  ✅ ${msg}`));
}

export function printToolError(msg: string): void {
  console.log(chalk.red(`  ❌ ${msg}`));
}

export function printToolBlocked(reason: string): void {
  console.log(chalk.red.bold(`  🚫 BLOCKED: ${reason}`));
}

export function printRejected(): void {
  console.log(chalk.yellow('  ✖ Action rejected by user.'));
}

export function printToolResult(name: string, output: string): void {
  console.log(chalk.dim(`  ── Result: ${name} ──`));
  printDimOutput(output.split('\n'), 20);
  console.log();
}

// ── Agent display ─────────────────────────────────────────────────────────────

export function createSpinner(text: string): Ora {
  // discardStdin:false — ora's default stdin-discarder (TTY only) pauses
  // process.stdin, which steals it from our readline interface and causes
  // the process to exit before confirmation prompts can be answered.
  return ora({ text: `  ${text}`, indent: 0, discardStdin: false });
}

export function printAgentResponse(text: string): void {
  console.log();
  console.log(chalk.cyan.bold('  🤖 Agent:'));
  console.log();
  console.log(chalk.white(text));
  console.log();
}

export function printAgentStep(step: number, max: number): void {
  console.log();
  console.log(chalk.cyan.bold(`  ┌─ Step ${step} / ${max} ──────────────────────────────────┐`));
}

export function printAgentComplete(steps: number): void {
  console.log(chalk.green(`  ✔ Task complete after ${steps} step(s).`));
}

export function printAgentMaxSteps(max: number): void {
  console.log();
  console.log(chalk.yellow(`  ⚠️  Reached max steps (${max}). Stopping.`));
}

export function printAgentError(msg: string): void {
  console.log();
  console.log(chalk.red(`  ❌ Error: ${msg}`));
  console.log();
}

// ── REPL views ────────────────────────────────────────────────────────────────

export function printHelp(): void {
  console.log();
  console.log(chalk.cyan.bold('  Agentic CLI'));
  console.log();
  console.log(chalk.bold('  Tools available:'));
  console.log(chalk.dim('    read_file       — Read file contents'));
  console.log(chalk.dim('    write_file      — Create or overwrite a file'));
  console.log(chalk.dim('    append_file     — Append to a file'));
  console.log(chalk.dim('    modify_file     — Find-and-replace in a file'));
  console.log(chalk.dim('    list_directory  — List directory contents'));
  console.log(chalk.dim('    run_command     — Execute a shell command'));
  console.log(chalk.dim('    search_files    — Glob-based file search'));
  console.log(chalk.dim('    web_search      — Real-time web search via Gemini'));
  console.log();
  console.log(chalk.bold('  REPL commands:'));
  console.log(chalk.dim('    /exit /quit     — Exit the CLI'));
  console.log(chalk.dim('    /clear          — Clear conversation history'));
  console.log(chalk.dim('    /help           — Show this help'));
  console.log(chalk.dim('    /export [html|md|sh|both]  — Export session as runbook'));
  console.log(chalk.dim('    /replay <file.sh>          — Replay a runbook step by step'));
  console.log();
  console.log(chalk.bold('  Flags:'));
  console.log(chalk.dim('    --yolo          — Auto-approve all actions'));
  console.log();
  console.log(chalk.bold('  Example prompts:'));
  console.log(chalk.dim('    "List all TypeScript files in src/"'));
  console.log(chalk.dim('    "Read package.json and summarise the dependencies"'));
  console.log(chalk.dim('    "Create a hello.ts file and run it"'));
  console.log(chalk.dim('    "Search the web for the latest Node.js LTS version"'));
  console.log();
}

export function printStatus(model: string, historyLength: number): void {
  console.log();
  console.log(chalk.cyan.bold('  ── Status ────────────────────────────────────────'));
  console.log(`  Model:    ${chalk.white(model)}`);
  console.log(`  History:  ${chalk.white(String(historyLength))} messages`);
  console.log(chalk.dim('  ──────────────────────────────────────────────────'));
  console.log();
}

export function printExportSuccess(files: string[]): void {
  console.log();
  console.log(chalk.green.bold('  ✔ Runbook exported:'));
  for (const f of files) {
    console.log(chalk.white(`    ${f}`));
  }
  console.log();
}

export function printExportEmpty(): void {
  console.log();
  console.log(chalk.yellow('  ⚠  Nothing to export — run a task first.'));
  console.log();
}

export function printExportUsage(): void {
  console.log();
  console.log(chalk.dim('  Usage: /export [html|md|sh|both]'));
  console.log(chalk.dim('    html — Shareable HTML page (default)'));
  console.log(chalk.dim('    md   — Markdown runbook'));
  console.log(chalk.dim('    sh   — Executable shell script (run_command steps only)'));
  console.log(chalk.dim('    both — Export all three formats'));
  console.log();
}

// ── Replay ────────────────────────────────────────────────────────────────────

export function printReplayHeader(task: string, count: number): void {
  console.log();
  console.log(chalk.cyan.bold('  ┌─ Replay Runbook ─────────────────────────────────┐'));
  console.log(chalk.white(`  │  Task:     ${task}`));
  console.log(chalk.white(`  │  Commands: ${count}`));
  console.log(chalk.cyan('  └───────────────────────────────────────────────────'));
  console.log();
}

export function printReplayStep(current: number, total: number, reasoning: string, command: string): void {
  console.log();
  console.log(chalk.cyan(`  ── Command ${current} / ${total} ${'─'.repeat(38)}`));
  if (reasoning) console.log(chalk.dim(`  Reasoning: ${reasoning}`));
  console.log(chalk.yellow(`  $ ${command}`));
  console.log();
}

export function printReplayComplete(done: number, total: number): void {
  console.log();
  console.log(chalk.green(`  ✔ Replay complete — ${done}/${total} command(s) executed.`));
  console.log();
}

export function printReplayUsage(): void {
  console.log();
  console.log(chalk.dim('  Usage: /replay <path-to-runbook.sh>'));
  console.log();
}

// ── Confirm & format helpers ──────────────────────────────────────────────────

export function formatConfirmPrompt(message: string): string {
  return `\n  ${chalk.yellow('▶')} ${message} ${chalk.dim('[y/N]')} `;
}

export function formatToolResult(name: string, output: string): string {
  return `[${name}]\n${output}`;
}

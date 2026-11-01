import chalk from 'chalk';

const BANNER_LINES = [
  ' █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗     ██████╗██╗     ██╗',
  '██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝    ██╔════╝██║     ██║',
  '███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║         ██║     ██║     ██║',
  '██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║         ██║     ██║     ██║',
  '██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗    ╚██████╗███████╗██║',
  '╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝     ╚═════╝╚══════╝╚═╝',
];

const GRADIENT: [number, number, number][] = [
  [255, 230,   0],
  [255, 195,   0],
  [255, 155,   0],
  [255, 100,   0],
  [235,  45,   0],
  [200,   0,   0],
];

// Print to stdout before Ink takes over so the banner stays in scroll history
// and is never re-painted by Ink's reconciler.
export function printBanner(): void {
  process.stdout.write('\n');
  for (let i = 0; i < BANNER_LINES.length; i++) {
    process.stdout.write(chalk.rgb(...GRADIENT[i])(BANNER_LINES[i]) + '\n');
  }
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('  Agentic CLI v4.2') + '\n');
  process.stdout.write(chalk.dim('  Powered by OpenAI-compatible API') + '\n');
  process.stdout.write('\n');
}

export function printWelcome(): void {
  process.stdout.write(chalk.bold('  🚀 Agent ready! Type your request below.') + '\n');
  process.stdout.write(chalk.dim("  (type '/help' for commands, '/exit' to quit)") + '\n');
  process.stdout.write('\n');
}

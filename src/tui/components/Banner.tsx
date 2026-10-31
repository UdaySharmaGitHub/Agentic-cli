import { Box, Text } from 'ink';
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

export function Banner() {
  return (
    <Box flexDirection="column">
      <Text>{' '}</Text>
      {BANNER_LINES.map((line, i) => (
        <Text key={i}>{chalk.rgb(...GRADIENT[i])(line)}</Text>
      ))}
      <Text>{' '}</Text>
      <Text dimColor>{'  Agentic CLI v4.2'}</Text>
      <Text dimColor>{'  Powered by OpenAI-compatible API'}</Text>
      <Text>{' '}</Text>
    </Box>
  );
}

export function WelcomeHint() {
  return (
    <Box flexDirection="column">
      <Text bold>{'  🚀 Agent ready! Type your request below.'}</Text>
      <Text dimColor>{"  (type '/help' for commands, '/exit' to quit)"}</Text>
      <Text>{' '}</Text>
    </Box>
  );
}

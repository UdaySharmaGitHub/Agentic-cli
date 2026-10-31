import { Box, Text } from 'ink';
import type { LogItem } from '../types.js';

const MAX_RESULT_LINES = 20;

interface Props {
  item: LogItem;
  columns: number;
}

export function LogItemView({ item, columns }: Props) {
  const boxWidth = Math.min(columns - 4, 80);
  const divider = '─'.repeat(Math.max(boxWidth, 10));

  switch (item.kind) {
    case 'user':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{'  You:'}</Text>
          <Text>{`  ${item.text}`}</Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{'  🤖 Agent:'}</Text>
          <Text>{' '}</Text>
          <Text color="white">{item.text}</Text>
          <Text>{' '}</Text>
        </Box>
      );

    case 'tool-header':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{`  ┌─ Tool: ${item.name}`}</Text>
          <Text dimColor>{`  │  ${item.description}`}</Text>
          <Text color="cyan">{`  └${'─'.repeat(Math.min(boxWidth - 2, 50))}`}</Text>
          <Text>{' '}</Text>
        </Box>
      );

    case 'tool-result': {
      const lines = item.output.split('\n');
      const display = lines.slice(0, MAX_RESULT_LINES);
      const truncated = lines.length > MAX_RESULT_LINES;
      return (
        <Box flexDirection="column">
          <Text dimColor>{`  ── Result: ${item.name} ──`}</Text>
          {display.map((line, i) => (
            <Text key={i} dimColor>{`  ${line}`}</Text>
          ))}
          {truncated && <Text dimColor>{`  ... (${lines.length - MAX_RESULT_LINES} more lines)`}</Text>}
          <Text>{' '}</Text>
        </Box>
      );
    }

    case 'step':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{`  ┌─ Step ${item.step} / ${item.max} ${'─'.repeat(Math.max(boxWidth - 16 - String(item.step).length - String(item.max).length, 4))}┐`}</Text>
        </Box>
      );

    case 'info':
      return (
        <InfoLine text={item.text} variant={item.variant} />
      );

    case 'separator':
      return (
        <Box paddingLeft={2}>
          <Text dimColor>{divider}</Text>
        </Box>
      );

    default:
      return null;
  }
}

function InfoLine({ text, variant }: { text: string; variant: 'success' | 'error' | 'warning' | 'dim' }) {
  const color =
    variant === 'success' ? 'green'
    : variant === 'error' ? 'red'
    : variant === 'warning' ? 'yellow'
    : undefined;

  return (
    <Box paddingLeft={2}>
      <Text color={color} dimColor={variant === 'dim'}>{text}</Text>
    </Box>
  );
}

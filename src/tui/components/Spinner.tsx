import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

export function ThinkingSpinner() {
  return (
    <Box paddingLeft={2}>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      <Text dimColor>{'  Thinking...'}</Text>
    </Box>
  );
}

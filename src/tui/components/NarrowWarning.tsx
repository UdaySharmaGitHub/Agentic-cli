import { Box, Text } from 'ink';

export function NarrowWarning() {
  return (
    <Box paddingLeft={2}>
      <Text color="yellow">{'⚠  Terminal too narrow — resize to 40+ cols'}</Text>
    </Box>
  );
}

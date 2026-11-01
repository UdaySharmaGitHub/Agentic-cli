import { Box, Text, useInput } from 'ink';

interface Props {
  message: string;
  onAnswer: (answer: boolean) => void;
}

export function ConfirmDialog({ message, onAnswer }: Props) {
  useInput((input, key) => {
    if (input.toLowerCase() === 'y') {
      onAnswer(true);
    } else if (input.toLowerCase() === 'n' || key.return || key.escape) {
      onAnswer(false);
    }
  });

  return (
    <Box paddingLeft={2}>
      <Text color="yellow">{'▶ '}</Text>
      <Text>{message} </Text>
      <Text dimColor>{'[y/N] '}</Text>
    </Box>
  );
}

import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  onSubmit: (value: string) => void;
}

export function InputBar({ onSubmit }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (val: string) => {
    setValue('');
    onSubmit(val);
  };

  return (
    <Box paddingLeft={2} marginTop={1}>
      <Text bold color="cyan">{'❯ '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Type a request or /help…"
      />
    </Box>
  );
}

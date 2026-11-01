import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  onSubmit: (value: string) => void;
  push: (entry: string) => void;
  up: () => string | null;
  down: () => string | null;
}

export function InputBar({ onSubmit, push, up, down }: Props) {
  const [value, setValue] = useState('');

  useInput((_, key) => {
    if (key.upArrow) {
      const prev = up();
      if (prev !== null) setValue(prev);
    } else if (key.downArrow) {
      const next = down();
      setValue(next ?? '');
    }
  });

  const handleSubmit = (val: string) => {
    if (val.trim()) push(val);
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

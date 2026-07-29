import { useEffect, useState } from 'react';
import { Alert, Anchor, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconExternalLink, IconKey, IconShield } from '@tabler/icons-react';
import { OPENROUTER_MODEL, OPENROUTER_MODEL_URL } from '../../lib/dailyInsight';
import { useSettingsStore } from '../../store/useSettingsStore';

interface ApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
  errorMessage?: string | null;
}

export function ApiKeyModal({ opened, onClose, errorMessage }: ApiKeyModalProps): JSX.Element {
  const apiKey = useSettingsStore((state) => state.openRouterApiKey);
  const setOpenRouterApiKey = useSettingsStore((state) => state.setOpenRouterApiKey);
  const [input, setInput] = useState<string>(apiKey ?? '');

  useEffect(() => {
    if (opened) {
      setInput(apiKey ?? '');
    }
  }, [opened, apiKey]);

  const handleSave = (): void => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setOpenRouterApiKey(trimmed);
    onClose();
  };

  const handleClear = (): void => {
    setOpenRouterApiKey(null);
    setInput('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="הגדרת מפתח OpenRouter" size="sm" centered>
      <Stack gap="md">
        {errorMessage ? (
          <Alert color="red" title="מפתח לא תקף">
            {errorMessage}
          </Alert>
        ) : null}

        <Alert color="blue" icon={<IconShield size={18} />} title="פרטיות">
          מפתח ה-API נשמר רק בדפדפן שלך (localStorage) ונשלח ישירות ל-OpenRouter בלבד.
        </Alert>

        <Stack gap={4}>
          <Text size="sm" fw={600}>
            מודל בשימוש
          </Text>
          <Anchor href={OPENROUTER_MODEL_URL} target="_blank" rel="noopener noreferrer" size="sm">
            {OPENROUTER_MODEL} <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
          </Anchor>
          <Text size="xs" c="dimmed">
            חינמי — נדרש חשבון ב-OpenRouter
          </Text>
        </Stack>

        <TextInput
          label="מפתח OpenRouter API"
          leftSection={<IconKey size={16} />}
          type="password"
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder="sk-or-v1-..."
          autoComplete="off"
        />

        <Text size="xs" c="dimmed">
          צור מפתח ב-{' '}
          <Anchor href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            openrouter.ai/keys
          </Anchor>
        </Text>

        <Group grow>
          <Button color="emerald" radius="xl" onClick={handleSave} disabled={!input.trim()}>
            שמור
          </Button>
          {apiKey ? (
            <Button color="red" variant="outline" radius="xl" onClick={handleClear}>
              מחק
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Modal>
  );
}

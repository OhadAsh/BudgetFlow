import { useEffect, useState } from 'react';
import { Alert, Anchor, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconBrandGoogle, IconExternalLink, IconShield } from '@tabler/icons-react';
import { isValidGoogleOAuthClientId } from '../../lib/googleDrive';
import { useSettingsStore } from '../../store/useSettingsStore';

interface GoogleClientIdModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called after a valid client ID was saved (store already updated). */
  onSaved?: () => void;
}

export function GoogleClientIdModal({
  opened,
  onClose,
  onSaved,
}: GoogleClientIdModalProps): JSX.Element {
  const clientId = useSettingsStore((state) => state.googleOAuthClientId);
  const setGoogleOAuthClientId = useSettingsStore((state) => state.setGoogleOAuthClientId);
  const [input, setInput] = useState<string>(clientId ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setInput(clientId ?? '');
      setValidationError(null);
    }
  }, [opened, clientId]);

  const handleSave = (): void => {
    const trimmed = input.trim();
    if (!trimmed) {
      setValidationError('יש להזין מזהה Client ID.');
      return;
    }
    if (!isValidGoogleOAuthClientId(trimmed)) {
      setValidationError(
        'המזהה אינו תקין. הוא אמור להסתיים ב-.apps.googleusercontent.com'
      );
      return;
    }
    setGoogleOAuthClientId(trimmed);
    setValidationError(null);
    onClose();
    onSaved?.();
  };

  const handleClear = (): void => {
    setGoogleOAuthClientId(null);
    setInput('');
    setValidationError(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="הגדרת Google OAuth Client ID" size="sm" centered>
      <Stack gap="md">
        {validationError ? (
          <Alert color="red" title="מזהה לא תקף">
            {validationError}
          </Alert>
        ) : null}

        <Alert color="blue" icon={<IconShield size={18} />} title="פרטיות">
          מזהה ה-Client ID נשמר רק בדפדפן שלך (localStorage). זה מזהה ציבורי — לא סוד — ונדרש
          להתחברות ל-Google Drive מאפליקציה סטטית.
        </Alert>

        <Text size="sm" c="dimmed">
          צור OAuth Client ID מסוג Web application ב-Google Cloud Console, והוסף את כתובת האתר
          שלך (ו-localhost לפיתוח) תחת Authorized JavaScript origins.
        </Text>

        <TextInput
          label="Google OAuth Client ID"
          leftSection={<IconBrandGoogle size={16} />}
          value={input}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setValidationError(null);
          }}
          placeholder="123456789-abc.apps.googleusercontent.com"
          autoComplete="off"
          aria-label="Google OAuth Client ID"
        />

        <Text size="xs" c="dimmed">
          מדריך:{' '}
          <Anchor
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
          >
            Google Cloud Console — Credentials{' '}
            <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
          </Anchor>
        </Text>

        <Group grow>
          <Button color="emerald" radius="xl" onClick={handleSave} disabled={!input.trim()}>
            שמור
          </Button>
          {clientId ? (
            <Button color="red" variant="outline" radius="xl" onClick={handleClear}>
              מחק
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Modal>
  );
}

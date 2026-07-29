import { useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTags, IconTrash, IconX } from '@tabler/icons-react';
import type { SettingsImportMode, SettingsParseResult } from '../../types';
import {
  BUILT_IN_CATEGORIES,
  COLOR_OPTIONS,
  COLORS,
  EMOJI_OPTIONS,
} from '../../lib/constants';
import {
  downloadWorkbook,
  exportSettingsToWorkbook,
  parseSettingsFile,
  SETTINGS_EXPORT_FILE_NAME,
} from '../../lib/excelParser';
import { applySettingsImport } from '../../lib/settingsImport';
import {
  buildCategorySelectOptions,
  isCategoryNameTaken,
  matchesSearchQuery,
  resolveCategoryMeta,
} from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';

export function CategoryManager(): JSX.Element {
  const customCategories = useExpenseStore((state) => state.customCategories);
  const merchantMemory = useExpenseStore((state) => state.merchantMemory);
  const addCustomCategory = useExpenseStore((state) => state.addCustomCategory);
  const updateCustomCategory = useExpenseStore((state) => state.updateCustomCategory);
  const removeCustomCategory = useExpenseStore((state) => state.removeCustomCategory);
  const forgetMerchant = useExpenseStore((state) => state.forgetMerchant);
  const applyImportedSettings = useExpenseStore((state) => state.applyImportedSettings);

  const [opened, setOpened] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmoji, setNewEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [newColor, setNewColor] = useState<string>(COLOR_OPTIONS[0]);
  const [memoryQuery, setMemoryQuery] = useState<string>('');
  const [settingsPreview, setSettingsPreview] = useState<SettingsParseResult | null>(null);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memoryRows = useMemo(() => {
    return Object.entries(merchantMemory)
      .map(([merchant, category]) => ({ merchant, category }))
      .filter((row) => matchesSearchQuery(`${row.merchant} ${row.category}`, memoryQuery))
      .sort((a, b) => a.merchant.localeCompare(b.merchant, 'he'));
  }, [merchantMemory, memoryQuery]);

  const resetAddForm = (): void => {
    setAdding(false);
    setNewName('');
    setNewEmoji(EMOJI_OPTIONS[0]);
    setNewColor(COLOR_OPTIONS[0]);
  };

  const handleAdd = (): void => {
    const name = newName.trim();
    if (name.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'חסר שם',
        message: 'יש להזין שם לקטגוריה החדשה.',
      });
      return;
    }
    if (isCategoryNameTaken(name, customCategories)) {
      notifications.show({
        color: 'red',
        title: 'שם תפוס',
        message: 'כבר קיימת קטגוריה בשם הזה.',
      });
      return;
    }
    addCustomCategory({ name, emoji: newEmoji, color: newColor });
    notifications.show({
      color: 'emerald',
      title: 'קטגוריה נוספה',
      message: `${newEmoji} ${name}`,
    });
    resetAddForm();
  };

  const close = (): void => {
    setOpened(false);
    resetAddForm();
    setMemoryQuery('');
    setSettingsPreview(null);
  };

  const handleExportSettings = (): void => {
    if (customCategories.length === 0 && Object.keys(merchantMemory).length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין הגדרות לייצוא',
        message: 'הוסף קטגוריות מותאמות או זיכרון עסקים לפני הייצוא.',
      });
      return;
    }

    try {
      downloadWorkbook(
        exportSettingsToWorkbook(customCategories, merchantMemory),
        SETTINGS_EXPORT_FILE_NAME
      );
      notifications.show({
        color: 'emerald',
        title: 'הייצוא הושלם',
        message: 'נוצר קובץ עם קטגוריות מותאמות וזיכרון עסקים.',
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: 'ייצוא ההגדרות נכשל. נסה שוב.',
      });
    }
  };

  const handleImportFile = async (file: File): Promise<void> => {
    setImportLoading(true);
    try {
      const parsed = await parseSettingsFile(file);
      setSettingsPreview(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'הקובץ אינו תקין או שאינו בפורמט xlsx.';
      notifications.show({ color: 'red', title: 'שגיאה', message });
      setSettingsPreview(null);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmSettingsImport = (mode: SettingsImportMode): void => {
    if (!settingsPreview) return;

    const applied = applySettingsImport(
      customCategories,
      merchantMemory,
      settingsPreview,
      mode
    );
    applyImportedSettings(applied.customCategories, applied.merchantMemory);

    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message:
        mode === 'merge'
          ? 'ההגדרות מוזגו עם הקיים.'
          : 'ערכים תואמים הוחלפו; שאר ההגדרות נשמרו.',
    });
    setSettingsPreview(null);
  };

  return (
    <>
      <Button
        variant="light"
        color="gray"
        size="xs"
        radius="xl"
        leftSection={<IconTags size={16} />}
        onClick={() => setOpened(true)}
        aria-label="ניהול קטגוריות"
      >
        ניהול קטגוריות 🏷️
      </Button>

      <Modal opened={opened} onClose={close} title="ניהול קטגוריות" size="lg">
        <Tabs defaultValue="categories" variant="pills" radius="xl">
          <Tabs.List mb="md">
            <Tabs.Tab value="categories">קטגוריות</Tabs.Tab>
            <Tabs.Tab value="memory">זיכרון עסקים</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="categories">
            <Stack gap="lg">
              <Box>
                <Text size="xs" c="dimmed" mb="xs">
                  קטגוריות מובנות
                </Text>
                <Group gap="xs">
                  {BUILT_IN_CATEGORIES.map((entry) => (
                    <Badge
                      key={entry.name}
                      variant="light"
                      radius="sm"
                      styles={{
                        root: {
                          backgroundColor: `${entry.color}1A`,
                          color: entry.color,
                          textTransform: 'none',
                          fontWeight: 600,
                        },
                      }}
                    >
                      {`${entry.emoji} ${entry.name}`}
                    </Badge>
                  ))}
                </Group>
              </Box>

              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed">
                    הקטגוריות שלי
                  </Text>
                  {!adding && (
                    <Button
                      size="xs"
                      variant="light"
                      color="emerald"
                      radius="xl"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => setAdding(true)}
                    >
                      הוסף קטגוריה
                    </Button>
                  )}
                </Group>

                {customCategories.length === 0 && !adding && (
                  <Text fz="sm" c={COLORS.textSecondary} ta="center" py="md">
                    עדיין אין קטגוריות מותאמות. לחץ על ״הוסף קטגוריה״ כדי ליצור.
                  </Text>
                )}

                <Stack gap="sm">
                  {customCategories.map((entry) => (
                    <Group key={entry.id} wrap="nowrap" gap="xs" align="center">
                      <Text fz="lg" w={28} ta="center">
                        {entry.emoji}
                      </Text>
                      <TextInput
                        size="xs"
                        style={{ flex: 1 }}
                        aria-label={`שם קטגוריה ${entry.name}`}
                        value={entry.name}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          if (
                            !isCategoryNameTaken(value, customCategories, entry.id) ||
                            value.trim() === entry.name
                          ) {
                            updateCustomCategory(entry.id, { name: value });
                          }
                        }}
                      />
                      <Group gap={4} wrap="nowrap">
                        {COLOR_OPTIONS.map((color) => (
                          <UnstyledButton
                            key={color}
                            aria-label={`צבע ${color}`}
                            onClick={() => updateCustomCategory(entry.id, { color })}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              backgroundColor: color,
                              outline:
                                entry.color === color ? `2px solid ${COLORS.textPrimary}` : 'none',
                              outlineOffset: 1,
                            }}
                          />
                        ))}
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        radius="xl"
                        aria-label={`מחיקת קטגוריה ${entry.name}`}
                        onClick={() => removeCustomCategory(entry.id)}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>

                {adding && (
                  <Box
                    mt="md"
                    p="md"
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 16,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <Stack gap="sm">
                      <Text size="xs" c="dimmed">
                        בחר אימוג׳י
                      </Text>
                      <SimpleGrid cols={8} spacing={6}>
                        {EMOJI_OPTIONS.map((emoji) => (
                          <UnstyledButton
                            key={emoji}
                            aria-label={`אימוג׳י ${emoji}`}
                            onClick={() => setNewEmoji(emoji)}
                            style={{
                              fontSize: 20,
                              lineHeight: 1.4,
                              borderRadius: 10,
                              backgroundColor: newEmoji === emoji ? '#E2E8F0' : 'transparent',
                              textAlign: 'center',
                            }}
                          >
                            {emoji}
                          </UnstyledButton>
                        ))}
                      </SimpleGrid>

                      <TextInput
                        label="שם הקטגוריה"
                        size="sm"
                        radius="xl"
                        value={newName}
                        onChange={(event) => setNewName(event.currentTarget.value)}
                        aria-label="שם הקטגוריה החדשה"
                      />

                      <Box>
                        <Text size="xs" c="dimmed" mb={6}>
                          צבע
                        </Text>
                        <Group gap={8}>
                          {COLOR_OPTIONS.map((color) => (
                            <UnstyledButton
                              key={color}
                              aria-label={`צבע ${color}`}
                              onClick={() => setNewColor(color)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                backgroundColor: color,
                                outline:
                                  newColor === color ? `2px solid ${COLORS.textPrimary}` : 'none',
                                outlineOffset: 2,
                              }}
                            />
                          ))}
                        </Group>
                      </Box>

                      <Group justify="flex-end" gap="xs">
                        <Button variant="default" radius="xl" size="xs" onClick={resetAddForm}>
                          ביטול
                        </Button>
                        <Button color="emerald" radius="xl" size="xs" onClick={handleAdd}>
                          הוסף קטגוריה
                        </Button>
                      </Group>
                    </Stack>
                  </Box>
                )}
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="memory">
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                האפליקציה זוכרת את הקטגוריה שבחרת לכל עסק
              </Text>
              <TextInput
                size="xs"
                radius="xl"
                placeholder="חיפוש עסק / קטגוריה"
                aria-label="חיפוש בזיכרון עסקים"
                value={memoryQuery}
                onChange={(event) => setMemoryQuery(event.currentTarget.value)}
              />

              {memoryRows.length === 0 ? (
                <Text fz="sm" c={COLORS.textSecondary} ta="center" py="xl">
                  עוד לא נשמרו עסקים. הקטגוריות ייזכרו אוטומטית לאחר ייבוא ראשון.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={420} mah={360} type="native">
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>שם עסק</Table.Th>
                        <Table.Th>קטגוריה</Table.Th>
                        <Table.Th style={{ width: 44 }} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {memoryRows.map((row) => {
                        const meta = resolveCategoryMeta(row.category, customCategories);
                        return (
                          <Table.Tr key={row.merchant}>
                            <Table.Td>
                              <Text fz="sm">{row.merchant}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                variant="light"
                                radius="sm"
                                styles={{
                                  root: {
                                    backgroundColor: `${meta.color}1A`,
                                    color: meta.color,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                  },
                                }}
                              >
                                {`${meta.emoji} ${meta.name}`}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                radius="xl"
                                aria-label={`מחיקת זיכרון ${row.merchant}`}
                                onClick={() => forgetMerchant(row.merchant)}
                              >
                                <IconX size={15} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Divider my="lg" />

        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            גיבוי והעברת הגדרות בין מכשירים (ללא נתונים כספיים)
          </Text>
          <Group grow gap="xs">
            <Button
              variant="light"
              color="blue"
              radius="xl"
              size="xs"
              onClick={handleExportSettings}
              aria-label="ייצוא הגדרות"
            >
              ייצוא הגדרות 📤
            </Button>
            <Button
              variant="light"
              color="grape"
              radius="xl"
              size="xs"
              loading={importLoading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="ייבוא הגדרות"
            >
              ייבוא הגדרות 📥
            </Button>
          </Group>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            aria-label="בחירת קובץ הגדרות"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
            }}
          />
        </Stack>
      </Modal>

      <Modal
        opened={settingsPreview !== null}
        onClose={() => setSettingsPreview(null)}
        title="ייבוא הגדרות"
        centered
        size="sm"
      >
        {settingsPreview && (
          <Stack gap="md">
            <Text>
              {`נמצאו ${settingsPreview.categories.length} קטגוריות ו-${settingsPreview.merchants.length} עסקים. לייבא?`}
            </Text>
            <Group grow>
              <Button
                variant="light"
                color="emerald"
                radius="xl"
                onClick={() => confirmSettingsImport('merge')}
              >
                מיזוג עם קיים
              </Button>
              <Button
                color="orange"
                radius="xl"
                onClick={() => confirmSettingsImport('replace')}
              >
                החלף הכל
              </Button>
            </Group>
            <Button variant="default" radius="xl" onClick={() => setSettingsPreview(null)}>
              ביטול
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}

/** Kept for callers that need Select data next to CategoryManager. */
export function useCategorySelectOptions(): Array<{ value: string; label: string }> {
  const customCategories = useExpenseStore((state) => state.customCategories);
  return useMemo(() => buildCategorySelectOptions(customCategories), [customCategories]);
}

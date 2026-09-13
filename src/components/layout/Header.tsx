import { useState } from 'react';
import { Box, Button, Group, Menu, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconBuildingBank,
  IconChevronDown,
  IconCreditCard,
  IconFileSpreadsheet,
  IconUpload,
  IconWallet,
} from '@tabler/icons-react';
import { COLORS } from '../../lib/constants';
import { YearSelector } from '../annual/YearSelector';
import { BankImportModal } from '../excel/BankImportModal';
import { ExcelControls } from '../excel/ExcelControls';
import { SettingsGearButton, SettingsPanel } from './SettingsPanel';
import { ThemeToggleIcon } from './ThemeToggleIcon';

export function Header(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [excelImportOpen, setExcelImportOpen] = useState<boolean>(false);
  const [cardImportOpen, setCardImportOpen] = useState<boolean>(false);
  const [bankImportOpen, setBankImportOpen] = useState<boolean>(false);

  return (
    <>
      <Box
        component="header"
        bg={COLORS.cardBg}
        px={{ base: 'md', sm: 'xl' }}
        py="sm"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={40} radius="lg" color="emerald" variant="light" style={{ flexShrink: 0 }}>
              <IconWallet size={22} />
            </ThemeIcon>
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Group gap={6} wrap="nowrap">
                <Text fw={700} fz="lg" c={COLORS.textPrimary} style={{ lineHeight: 1.2 }} truncate>
                  מעקב הוצאות
                </Text>
                <ThemeToggleIcon />
              </Group>
              <Text fz="xs" c={COLORS.textSecondary} truncate>
                תכנון פיננסי אישי
              </Text>
            </Stack>
          </Group>

          <Group gap="sm" wrap="wrap" justify="flex-end" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <Menu shadow="md" width={240} position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  radius="xl"
                  leftSection={<IconUpload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  aria-label="ייבוא"
                >
                  ייבוא
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={() => setExcelImportOpen(true)}
                >
                  ייבוא אקסל פיננסי
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCreditCard size={16} />}
                  onClick={() => setCardImportOpen(true)}
                >
                  ייבוא עסקאות / כרטיס
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconBuildingBank size={16} />}
                  onClick={() => setBankImportOpen(true)}
                >
                  ייבוא בנק / דיסקונט
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <ExcelControls
              compact
              showImportButton={false}
              importOpened={excelImportOpen}
              onImportOpenedChange={setExcelImportOpen}
            />

            <Box visibleFrom="xs">
              <YearSelector size="sm" width={116} />
            </Box>

            <SettingsGearButton onClick={() => setSettingsOpen(true)} />
          </Group>
        </Group>
      </Box>

      <BankImportModal
        mode="card"
        hideTrigger
        opened={cardImportOpen}
        onOpenedChange={setCardImportOpen}
      />
      <BankImportModal
        mode="bank"
        hideTrigger
        opened={bankImportOpen}
        onOpenedChange={setBankImportOpen}
      />

      <SettingsPanel opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

import { useCallback, useRef, useState } from 'react';
import { Box, LoadingOverlay, Stack, Text } from '@mantine/core';
import { IconFileSpreadsheet, IconUpload } from '@tabler/icons-react';
import { COLORS } from '../../lib/constants';
import { EXCEL_INPUT_ACCEPT, EXCEL_MAX_BYTES, isExcelFile } from '../../lib/utils';

interface ExcelFileDropAreaProps {
  loading: boolean;
  title: string;
  subtitle: string;
  /** When true, the picker accepts several Excel files in one drop/selection. */
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onInvalid: () => void;
}

/**
 * Native drag/drop + click file picker. Avoids @mantine/dropzone / react-dropzone,
 * which reliably break inside Mantine Modal on Windows (silent drop, no feedback).
 */
export function ExcelFileDropArea({
  loading,
  title,
  subtitle,
  multiple = false,
  onFiles,
  onInvalid,
}: ExcelFileDropAreaProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const dragDepth = useRef<number>(0);

  const takeFiles = useCallback(
    (list: FileList | File[] | null | undefined): void => {
      if (!list || list.length === 0) return;

      const candidates = Array.from(list);
      const accepted = candidates.filter(
        (file) => isExcelFile(file) && file.size <= EXCEL_MAX_BYTES
      );

      if (accepted.length === 0) {
        onInvalid();
        return;
      }

      onFiles(multiple ? accepted : [accepted[0]]);
    },
    [multiple, onFiles, onInvalid]
  );

  return (
    <Box
      pos="relative"
      mih={180}
      px="md"
      py="xl"
      style={{
        borderRadius: 'var(--mantine-radius-lg)',
        border: `2px dashed ${
          dragging ? 'var(--mantine-color-emerald-5)' : 'var(--mantine-color-gray-3)'
        }`,
        backgroundColor: dragging ? 'var(--mantine-color-emerald-0)' : COLORS.cardBg,
        cursor: loading ? 'wait' : 'pointer',
        transition: 'border-color 120ms ease, background-color 120ms ease',
      }}
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-busy={loading}
      onClick={() => {
        if (!loading) {
          inputRef.current?.click();
        }
      }}
      onKeyDown={(event) => {
        if (loading) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const types = Array.from(event.dataTransfer.types as ArrayLike<string>);
        if (!types.some((type) => type === 'Files' || type === 'application/x-moz-file')) {
          return;
        }
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setDragging(false);
        if (loading) return;
        takeFiles(event.dataTransfer.files);
      }}
    >
      <LoadingOverlay visible={loading} overlayProps={{ radius: 'lg' }} />
      <input
        ref={inputRef}
        type="file"
        accept={EXCEL_INPUT_ACCEPT}
        multiple={multiple}
        style={{ display: 'none' }}
        tabIndex={-1}
        onClick={(event) => {
          // Stop the outer Box onClick from re-triggering the picker.
          event.stopPropagation();
        }}
        onChange={(event) => {
          // Copy immediately — FileList is live and empties when value is cleared.
          const selected = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          takeFiles(selected);
        }}
      />
      <Stack align="center" gap="xs" style={{ pointerEvents: 'none' }}>
        {dragging ? (
          <IconUpload size={40} color={COLORS.primary} />
        ) : (
          <IconFileSpreadsheet size={40} color={COLORS.textSecondary} />
        )}
        <Text fw={600} c={COLORS.textPrimary} ta="center">
          {dragging ? 'שחרר כאן לייבוא' : title}
        </Text>
        <Text fz="xs" c={COLORS.textSecondary} ta="center">
          {loading ? 'קורא את הקבצים…' : subtitle}
        </Text>
      </Stack>
    </Box>
  );
}

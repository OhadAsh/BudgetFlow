import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Box,
  Card,
  Group,
  Skeleton,
  Text,
} from '@mantine/core';
import { IconSparkles, IconX } from '@tabler/icons-react';
import { useMonthData } from '../../hooks/useMonthData';
import {
  ApiUnauthorizedError,
  buildDailyPrompt,
  fetchDailyInsight,
  formatHebrewInsightDate,
  readStoredDailyInsight,
  todayISODate,
  writeStoredDailyInsight,
} from '../../lib/dailyInsight';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ApiKeyModal } from './ApiKeyModal';

export function DailyInsightBubble(): JSX.Element {
  const apiKey = useSettingsStore((state) => state.openRouterApiKey);
  const setOpenRouterApiKey = useSettingsStore((state) => state.setOpenRouterApiKey);
  const { stats, previousStats, largestCategory } = useMonthData();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyOpened, setApiKeyOpened] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const statsRef = useRef(stats);
  const previousStatsRef = useRef(previousStats);
  const largestCategoryRef = useRef(largestCategory);
  statsRef.current = stats;
  previousStatsRef.current = previousStats;
  largestCategoryRef.current = largestCategory;

  const todayLabel = formatHebrewInsightDate();

  useEffect(() => {
    if (!apiKey) {
      setInsight(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const today = todayISODate();
    const stored = readStoredDailyInsight();
    const isStale = !stored || stored.date !== today;

    if (!isStale && stored) {
      setInsight(stored.insight);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const prompt = buildDailyPrompt(
      statsRef.current,
      largestCategoryRef.current,
      previousStatsRef.current
    );

    void fetchDailyInsight(apiKey, prompt, controller.signal)
      .then((text) => {
        writeStoredDailyInsight(text, today);
        setInsight(text);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (err instanceof ApiUnauthorizedError) {
          setOpenRouterApiKey(null);
          setApiKeyError(err.message);
          setApiKeyOpened(true);
          setInsight(null);
          setError(err.message);
          return;
        }
        setError(err instanceof Error ? err.message : 'שגיאה בקבלת התובנה');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [apiKey, setOpenRouterApiKey]);

  const toggleExpanded = (): void => {
    setExpanded((prev) => !prev);
  };

  return (
    <>
      <Box
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 200,
          maxWidth: 320,
        }}
      >
        {expanded ? (
          <Card
            shadow="lg"
            radius="lg"
            p="md"
            style={{
              maxWidth: 320,
              border: '1px solid var(--mantine-color-emerald-3)',
            }}
          >
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <IconSparkles size={16} color="var(--mantine-color-emerald-6)" />
                <Text size="xs" fw={600} c="emerald">
                  תובנה יומית
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {todayLabel}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  radius="xl"
                  onClick={toggleExpanded}
                  aria-label="סגור תובנה יומית"
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Group>

            {isLoading ? <Skeleton height={60} radius="sm" /> : null}

            {!isLoading && insight ? (
              <Text size="sm" style={{ lineHeight: 1.7 }}>
                {insight}
              </Text>
            ) : null}

            {!isLoading && !insight && error ? (
              <Text size="sm" c="red">
                {error}
              </Text>
            ) : null}

            {!apiKey ? (
              <Text size="xs" c="dimmed" ta="center">
                <Anchor
                  component="button"
                  type="button"
                  onClick={() => {
                    setApiKeyError(null);
                    setApiKeyOpened(true);
                  }}
                >
                  הוסף מפתח API
                </Anchor>
                {' '}
                לקבלת תובנות יומיות
              </Text>
            ) : null}

            <Text size="xs" c="dimmed" mt="xs" ta="left">
              מופעל על ידי OpenRouter · מתחדש מדי יום
            </Text>
          </Card>
        ) : (
          <ActionIcon
            size="xl"
            radius="xl"
            color="emerald"
            variant="filled"
            onClick={toggleExpanded}
            aria-label="פתח תובנה יומית"
            style={{ boxShadow: '0 4px 12px rgba(16,185,129,0.4)' }}
          >
            <IconSparkles size={20} />
          </ActionIcon>
        )}
      </Box>

      <ApiKeyModal
        opened={apiKeyOpened}
        onClose={() => setApiKeyOpened(false)}
        errorMessage={apiKeyError}
      />
    </>
  );
}

import type { CategoryBreakdownItem, MonthStats } from '../types';
import { HEBREW_MONTHS } from './constants';

export const DAILY_INSIGHT_STORAGE_KEY = 'daily-insight-v1';
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
export const OPENROUTER_MODEL_URL = 'https://openrouter.ai/openai/gpt-oss-20b:free';

export interface StoredDailyInsight {
  date: string;
  insight: string;
  model: string;
}

export class ApiUnauthorizedError extends Error {
  constructor() {
    super('מפתח ה-API לא תקף או שפג תוקפו. הזן מפתח חדש.');
    this.name = 'ApiUnauthorizedError';
  }
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
}

const HEBREW_WEEKDAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"] as const;

export function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Formats today as "יום ג', 29 יולי". */
export function formatHebrewInsightDate(date: Date = new Date()): string {
  const weekday = HEBREW_WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const monthName = HEBREW_MONTHS[date.getMonth()];
  return `יום ${weekday}, ${day} ${monthName}`;
}

export function readStoredDailyInsight(): StoredDailyInsight | null {
  try {
    const raw = localStorage.getItem(DAILY_INSIGHT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredDailyInsight).date !== 'string' ||
      typeof (parsed as StoredDailyInsight).insight !== 'string'
    ) {
      return null;
    }
    const value = parsed as StoredDailyInsight;
    return {
      date: value.date,
      insight: value.insight,
      model: typeof value.model === 'string' ? value.model : OPENROUTER_MODEL,
    };
  } catch {
    return null;
  }
}

export function writeStoredDailyInsight(insight: string, date: string = todayISODate()): void {
  const payload: StoredDailyInsight = {
    date,
    insight,
    model: OPENROUTER_MODEL,
  };
  localStorage.setItem(DAILY_INSIGHT_STORAGE_KEY, JSON.stringify(payload));
}

/** Removes the cached daily insight from localStorage. */
export function clearStoredDailyInsight(): void {
  localStorage.removeItem(DAILY_INSIGHT_STORAGE_KEY);
}

/**
 * Rejects responses that mix in unrelated scripts (CJK, Cyrillic, etc.).
 * Hebrew, Latin, digits, and common punctuation are allowed.
 */
export function isValidHebrewInsight(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;
  const foreignScript =
    /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;
  if (foreignScript.test(trimmed)) return false;
  return /[\u0590-\u05FF]/.test(trimmed);
}

export function buildDailyPrompt(
  currentMonth: MonthStats,
  topCategory: CategoryBreakdownItem | null,
  lastMonth: MonthStats
): string {
  const topName = topCategory?.category ?? 'אין';
  const topAmount = Math.round(topCategory?.amount ?? 0);

  return `
    אתה יועץ פיננסי ידידותי. כתוב תובנה יומית קצרה (2-3 משפטים בלבד)
    בעברית בלבד על ההוצאות של המשתמש.

    נתוני החודש הנוכחי:
    - סה"כ הוצאות: ₪${Math.round(currentMonth.totalExpenses)}
    - הקטגוריה הגדולה ביותר: ${topName} (₪${topAmount})
    - אחוז חיסכון: ${Math.round(currentMonth.savingsRate)}%

    החודש הקודם לשם השוואה:
    - סה"כ הוצאות: ₪${Math.round(lastMonth.totalExpenses)}
    - אחוז חיסכון: ${Math.round(lastMonth.savingsRate)}%

    כללים חשובים:
    - עברית בלבד. אסור להשתמש בסינית, אנגלית, או כל שפה אחרת.
    - רק אותיות עבריות, מספרים וסימני פיסוק.
    - תובנה אחת קצרה, ספציפית ומעשית. בלי כותרות ובלי אימוג'ים.
  `.trim();
}

async function requestOpenRouterInsight(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'Expense Tracker',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 300,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    const errorText = await response.text();
    let message = 'בקשה נדחתה';
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string } };
      message = parsed.error?.message ?? message;
    } catch {
      // omit raw body — may contain sensitive details
    }
    throw new Error(`שגיאת OpenRouter (${response.status}): ${message}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function fetchDailyInsight(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const content = await requestOpenRouterInsight(apiKey, prompt, signal);

    if (!content) {
      if (attempt < maxAttempts) continue;
      throw new Error('לא התקבלה תובנה מהשרת');
    }

    if (!isValidHebrewInsight(content)) {
      if (attempt < maxAttempts) continue;
      throw new Error('התובנה שהתקבלה לא תקינה — נסה לרענן');
    }

    return content;
  }

  throw new Error('לא התקבלה תובנה מהשרת');
}

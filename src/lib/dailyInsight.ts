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

export function buildDailyPrompt(
  currentMonth: MonthStats,
  topCategory: CategoryBreakdownItem | null,
  lastMonth: MonthStats
): string {
  const topName = topCategory?.category ?? 'אין';
  const topAmount = Math.round(topCategory?.amount ?? 0);

  return `
    אתה יועץ פיננסי ידידותי. תן תובנה יומית קצרה (2-3 משפטים בלבד) 
    בעברית על ההוצאות של המשתמש.
    
    נתוני החודש הנוכחי:
    - סה"כ הוצאות: ₪${Math.round(currentMonth.totalExpenses)}
    - הקטגוריה הגדולה ביותר: ${topName} (₪${topAmount})
    - אחוז חיסכון: ${Math.round(currentMonth.savingsRate)}%
    
    החודש הקודם לשם השוואה:
    - סה"כ הוצאות: ₪${Math.round(lastMonth.totalExpenses)}
    - אחוז חיסכון: ${Math.round(lastMonth.savingsRate)}%
    
    כתוב תובנה אחת קצרה, ספציפית, ומעשית. 
    לא יותר מ-3 משפטים. בלי כותרות.
  `.trim();
}

export async function fetchDailyInsight(
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
      max_tokens: 200,
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

  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error('לא התקבלה תובנה מהשרת');
  }

  return content;
}

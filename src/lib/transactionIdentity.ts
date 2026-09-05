import type { BankSource, Expense } from '../types';

/** Inputs used to build a stable external fingerprint for an imported transaction. */
export interface TransactionFingerprintInput {
  isoDate: string;
  merchant: string;
  chargeAmount: number;
  installment?: string;
  chargePeriod?: { year: number; month: number };
  source?: BankSource | null;
  cardLast4?: string | null;
}

const MAX_GENERIC_INSTALLMENT = 'תשלומים';

/**
 * Historical fingerprint formula (pre–source/last4). Preserved so LocalStorage
 * rows and Excel round-trips without the new columns still match re-imports.
 */
export function buildLegacyTransactionHash(
  isoDate: string,
  merchant: string,
  chargeAmount: number,
  installment?: string,
  chargePeriod?: { year: number; month: number }
): string {
  const dateKey =
    installment !== undefined && chargePeriod !== undefined
      ? `${chargePeriod.year}-${chargePeriod.month.toString().padStart(2, '0')}`
      : isoDate;
  const installmentKey = installment ?? '';
  const raw = `${dateKey}|${merchant.trim()}|${chargeAmount}|${installmentKey}`;
  return encodeFingerprint(raw);
}

/**
 * Current fingerprint stored on new imports.
 * - Keeps the legacy core for ordinary rows.
 * - For Max "תשלומים" (no X/Y), folds in the purchase date so distinct plans
 *   in the same charge month do not collide.
 * - Appends source + last4 when present (enhanced form).
 */
export function buildTransactionFingerprint(input: TransactionFingerprintInput): string {
  const core = buildDisambiguatedCoreHash(input);
  const source = input.source ?? '';
  const last4 = normalizeCardLast4(input.cardLast4) ?? '';
  if (source.length === 0 && last4.length === 0) {
    return core;
  }
  return encodeFingerprint(`${core}|${source}|${last4}`);
}

function buildDisambiguatedCoreHash(input: TransactionFingerprintInput): string {
  const installmentKey = input.installment ?? '';
  if (
    installmentKey === MAX_GENERIC_INSTALLMENT &&
    input.chargePeriod !== undefined &&
    input.isoDate.length > 0
  ) {
    const monthKey = `${input.chargePeriod.year}-${input.chargePeriod.month.toString().padStart(2, '0')}`;
    const raw = `${monthKey}|${input.isoDate}|${input.merchant.trim()}|${input.chargeAmount}|${installmentKey}`;
    return encodeFingerprint(raw);
  }

  return buildLegacyTransactionHash(
    input.isoDate,
    input.merchant,
    input.chargeAmount,
    input.installment,
    input.chargePeriod
  );
}

/** Every key that should count as "already imported" for a stored expense. */
export function fingerprintKeysForExpense(expense: Expense): string[] {
  const keys = new Set<string>();

  if (expense.hash) {
    keys.add(expense.hash);
  }

  if (!expense.date) {
    return Array.from(keys);
  }

  const installment = extractInstallmentMarker(expense.note) ?? undefined;
  const period = periodFromIsoDateLocal(expense.date);
  const input: TransactionFingerprintInput = {
    isoDate: expense.date,
    merchant: expense.description,
    chargeAmount: expense.amount,
    installment,
    chargePeriod: installment !== undefined && period !== null ? period : undefined,
    source: expense.source ?? null,
    cardLast4: expense.cardLast4 ?? null,
  };

  // Always register the source-aware fingerprint when fields exist.
  keys.add(buildTransactionFingerprint(input));

  const hasCardIdentity =
    (expense.source !== null && expense.source !== undefined && String(expense.source).length > 0) ||
    (expense.cardLast4 !== null &&
      expense.cardLast4 !== undefined &&
      String(expense.cardLast4).length > 0);

  if (!hasCardIdentity) {
    // Rows without issuer/card also claim unscoped keys so Excel round-trips
    // and pre-source imports still dedupe. Sourced rows must not — otherwise
    // two different cards with the same merchant/amount/date collide.
    keys.add(buildDisambiguatedCoreHash(input));
    keys.add(
      buildLegacyTransactionHash(
        input.isoDate,
        input.merchant,
        input.chargeAmount,
        input.installment,
        input.chargePeriod
      )
    );
    keys.add(
      buildLegacyTransactionHash(expense.date, expense.description, expense.amount)
    );
  }

  return Array.from(keys);
}

/** Keys for a live import-preview row (card / bank). */
export function fingerprintKeysForInput(input: TransactionFingerprintInput): string[] {
  const keys = new Set<string>();

  // Always register the enhanced fingerprint (and disambiguated core).
  keys.add(buildDisambiguatedCoreHash(input));
  keys.add(buildTransactionFingerprint(input));

  // Legacy core (no source/last4) — needed so old LocalStorage rows still match.
  keys.add(
    buildLegacyTransactionHash(
      input.isoDate,
      input.merchant,
      input.chargeAmount,
      input.installment,
      input.chargePeriod
    )
  );

  return Array.from(keys);
}

/**
 * Duplicate check for a candidate import row.
 * When the candidate carries issuer/card identity, a match on the bare legacy
 * core alone is not enough if that would ignore a different card — the set
 * from `fingerprintKeysForExpense` already omits unscoped legacy for sourced rows.
 */
export function isDuplicateFingerprint(
  existingKeys: Set<string>,
  input: TransactionFingerprintInput,
  storedHash?: string
): boolean {
  if (storedHash !== undefined && existingKeys.has(storedHash)) {
    return true;
  }
  return fingerprintKeysForInput(input).some((key) => existingKeys.has(key));
}

/** "תשלום 2 מתוך 12" from a free-text note (card import or Excel round-trip). */
export function extractInstallmentMarker(note: string | undefined): string | null {
  if (note === undefined || note.length === 0) return null;
  const match = note.replace(/\s+/g, ' ').trim().match(/תשלום\s*(\d+)\s*מתוך\s*(\d+)/);
  return match ? `תשלום ${match[1]} מתוך ${match[2]}` : null;
}

/** Also recognizes the Max generic installment marker in notes. */
export function extractAnyInstallmentMarker(note: string | undefined): string | null {
  const numbered = extractInstallmentMarker(note);
  if (numbered !== null) return numbered;
  if (note === undefined) return null;
  const normalized = note.replace(/\s+/g, ' ').trim();
  if (normalized.includes(MAX_GENERIC_INSTALLMENT)) {
    return MAX_GENERIC_INSTALLMENT;
  }
  return null;
}

/** Last 4 digits only — rejects anything that is not exactly 4 digits. */
export function normalizeCardLast4(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/**
 * Scans statement header rows for a card's last 4 digits.
 * Returns null when nothing reliable is found — never invents a value.
 */
export function extractCardLast4FromHeaderRows(rows: unknown[][]): string | null {
  for (const row of rows) {
    const line = row.map((cell) => String(cell ?? '')).join(' ').replace(/\s+/g, ' ').trim();
    if (line.length === 0) continue;

    const patterns: RegExp[] = [
      /(?:\*{4}|X{4}|x{4}|•{4}|·{4})[\s-]*(\d{4})/,
      /(?:מסתיים\s*ב[-–:]?\s*|4\s*ספרות\s*אחרונות\s*[:\-]?\s*|ending\s*in\s*)(\d{4})/i,
      /כרטיס[^\d]{0,40}(\d{4})(?:\D|$)/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return normalizeCardLast4(match[1]);
      }
    }
  }
  return null;
}

/** Compact Hebrew table label: "CAL •••• 1234" / "MAX" / null when unknown. */
export function formatCardSourceLabel(
  source: BankSource | null | undefined,
  cardLast4: string | null | undefined
): string | null {
  if (source === null || source === undefined) {
    const last4 = normalizeCardLast4(cardLast4);
    return last4 !== null ? `•••• ${last4}` : null;
  }

  const issuer =
    source === 'cal' ? 'CAL' : source === 'max' ? 'MAX' : source === 'discount' ? 'דיסקונט' : source;
  const last4 = normalizeCardLast4(cardLast4);
  return last4 !== null ? `${issuer} •••• ${last4}` : issuer;
}

function encodeFingerprint(raw: string): string {
  return btoa(unescape(encodeURIComponent(raw)));
}

function periodFromIsoDateLocal(iso: string): { year: number; month: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

import type {
  CustomCategory,
  MerchantMemory,
  SettingsImportMode,
  SettingsParseResult,
} from '../types';
import { isCategoryNameTaken, normalizeMerchantName } from './utils';

export interface AppliedSettings {
  customCategories: CustomCategory[];
  merchantMemory: MerchantMemory;
}

/**
 * Merges or replaces custom categories + merchant memory from a settings file.
 * merge → add only missing entries; replace → overwrite matching, keep the rest.
 */
export function applySettingsImport(
  currentCategories: CustomCategory[],
  currentMemory: MerchantMemory,
  imported: SettingsParseResult,
  mode: SettingsImportMode
): AppliedSettings {
  const customCategories = applyCategories(currentCategories, imported.categories, mode);
  const merchantMemory = applyMerchants(currentMemory, imported.merchants, mode);
  return { customCategories, merchantMemory };
}

function applyCategories(
  current: CustomCategory[],
  imported: SettingsParseResult['categories'],
  mode: SettingsImportMode
): CustomCategory[] {
  let next = [...current];

  imported.forEach((row) => {
    const name = row.name.trim();
    if (name.length === 0) return;

    const existing = next.find(
      (entry) => entry.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      if (mode === 'replace') {
        next = next.map((entry) =>
          entry.id === existing.id
            ? { ...entry, name, emoji: row.emoji, color: row.color }
            : entry
        );
      }
      return;
    }

    if (isCategoryNameTaken(name, next)) {
      return;
    }

    next = [...next, { id: crypto.randomUUID(), name, emoji: row.emoji, color: row.color }];
  });

  return next;
}

function applyMerchants(
  current: MerchantMemory,
  imported: SettingsParseResult['merchants'],
  mode: SettingsImportMode
): MerchantMemory {
  const next: MerchantMemory = { ...current };

  imported.forEach((row) => {
    const key = normalizeMerchantName(row.merchant);
    const category = row.category.trim();
    if (key.length === 0 || category.length === 0) return;

    if (mode === 'merge' && next[key] !== undefined) {
      return;
    }

    next[key] = category;
  });

  return next;
}

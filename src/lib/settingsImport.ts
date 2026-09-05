import type {
  CategoryTargets,
  CustomCategory,
  MerchantMemory,
  SettingsImportMode,
  SettingsParseResult,
} from '../types';
import { isCategoryNameTaken, normalizeMerchantName } from './utils';

export interface AppliedSettings {
  customCategories: CustomCategory[];
  merchantMemory: MerchantMemory;
  categoryTargets: CategoryTargets;
}

/**
 * Merges or replaces custom categories + merchant memory + targets from a settings file.
 * merge → add only missing entries; replace → overwrite matching, keep the rest.
 */
export function applySettingsImport(
  currentCategories: CustomCategory[],
  currentMemory: MerchantMemory,
  currentTargets: CategoryTargets,
  imported: SettingsParseResult,
  mode: SettingsImportMode
): AppliedSettings {
  const customCategories = applyCategories(currentCategories, imported.categories, mode);
  const merchantMemory = applyMerchants(currentMemory, imported.merchants, mode);
  const categoryTargets = applyTargets(currentTargets, imported.targets ?? [], mode);
  return { customCategories, merchantMemory, categoryTargets };
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

function applyTargets(
  current: CategoryTargets,
  imported: SettingsParseResult['targets'],
  mode: SettingsImportMode
): CategoryTargets {
  const next: CategoryTargets = mode === 'replace' ? {} : { ...current };

  if (mode === 'replace') {
    // Keep current targets for categories not mentioned, then overlay imports.
    Object.assign(next, current);
  }

  imported.forEach((row) => {
    const category = row.category.trim();
    if (category.length === 0) return;

    if (row.monthlyTarget === null) {
      if (mode === 'replace') {
        delete next[category];
      }
      return;
    }

    if (mode === 'merge' && next[category] !== undefined) {
      return;
    }

    if (Number.isFinite(row.monthlyTarget) && row.monthlyTarget >= 0) {
      next[category] = row.monthlyTarget;
    }
  });

  return next;
}

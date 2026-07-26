import type {
  CateringMenuOrder,
  PreparationTask,
} from '../types/cateringOperations';
import { calculateCateringRequirements } from './cateringCalculations';
import { createId, normalizeItemName } from './cateringStandards';

/**
 * Ordered, de-duplicated automatic task names for a given menu order.
 * Empty menu → empty list (no default general tasks).
 */
export function getAutomaticTaskNames(menuOrder: CateringMenuOrder): string[] {
  const { beefPattyCount, veggiePattyCount, bunCount } =
    calculateCateringRequirements(menuOrder);

  const names: string[] = [];

  if (beefPattyCount > 0) {
    names.push(
      'Prepare beef patties',
      'Prepare grilled onions',
      'Count and pack cheese',
      'Pack fry sauce',
    );
  }

  if (veggiePattyCount > 0) {
    names.push('Pack veggie patties');
  }

  if (bunCount > 0) {
    names.push('Count and pack buns', 'Pack pickles');
  }

  if (menuOrder.fries > 0) {
    names.push('Count and pack fries');
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = normalizeItemName(name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

export function createAutomaticTasks(menuOrder: CateringMenuOrder): PreparationTask[] {
  return getAutomaticTaskNames(menuOrder).map((name) => ({
    id: createId('task'),
    name,
    completed: false,
    source: 'automatic',
  }));
}

/**
 * Reconcile automatic tasks with the current menu while preserving:
 * - all custom tasks,
 * - completion state and notes of existing tasks,
 * - completed automatic tasks even if their menu trigger disappeared.
 *
 * Pure — returns a new array.
 */
export function syncAutomaticTasks(
  existing: PreparationTask[],
  menuOrder: CateringMenuOrder,
): PreparationTask[] {
  const desiredNames = getAutomaticTaskNames(menuOrder);
  const desiredKeys = new Set(desiredNames.map(normalizeItemName));

  const result: PreparationTask[] = [];
  const keptAutomaticKeys = new Set<string>();

  for (const task of existing) {
    if (task.source === 'custom') {
      result.push(task);
      continue;
    }

    const key = normalizeItemName(task.name);
    if (desiredKeys.has(key)) {
      result.push(task);
      keptAutomaticKeys.add(key);
      continue;
    }

    // No longer required by the menu: keep only if already completed.
    if (task.completed) {
      result.push(task);
      keptAutomaticKeys.add(key);
    }
  }

  for (const name of desiredNames) {
    const key = normalizeItemName(name);
    if (keptAutomaticKeys.has(key)) {
      continue;
    }
    result.push({
      id: createId('task'),
      name,
      completed: false,
      source: 'automatic',
    });
    keptAutomaticKeys.add(key);
  }

  return result;
}

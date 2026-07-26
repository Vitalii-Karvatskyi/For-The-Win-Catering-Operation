import { caterings as seedCaterings } from '../data/caterings';
import type {
  CateringEvent,
  CateringEventStatus,
  CateringMenuOrder,
  DocumentTask,
  OpenMenuItem,
  PreparationTask,
  SupplyItem,
} from '../types/cateringOperations';
import { createEmptyMenuOrder } from './cateringCalculations';
import {
  applyAutoEquipmentQuantities,
  createId,
  ensureStandardEquipment,
  ensureStandardProducts,
  isAutoEquipmentName,
  normalizeItemName,
} from './cateringStandards';

const VALID_STATUSES: readonly CateringEventStatus[] = [
  'planning',
  'in-progress',
  'ready',
  'completed',
];

const REMOVED_PRODUCT_NAMES = new Set(
  ['Sauces in bags', 'Butter'].map(normalizeItemName),
);
const REMOVED_EQUIPMENT_NAMES = new Set(
  ['Grill brick', 'Sauce bottles', 'Bun weights', 'Butter roller'].map(
    normalizeItemName,
  ),
);
const AUTO_PRODUCT_NAMES = new Set(
  [
    'Beef',
    'Beef patties',
    'Veggie patties',
    'Buns',
    'Burger buns',
    'Cheese',
    'American cheese',
    'Packaged fry sauce',
    'Fry sauce',
    'Grilled onions',
    'Fries',
    'Potatoes',
  ].map(normalizeItemName),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOpenMenuItem(value: unknown): value is OpenMenuItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    isOptionalString(value.notes)
  );
}

function isMenuOrder(value: unknown): value is CateringMenuOrder {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.cheeseburger === 'number' &&
    typeof value.doubleCheeseburger === 'number' &&
    typeof value.veggieBurger === 'number' &&
    typeof value.fries === 'number' &&
    Array.isArray(value.openItems) &&
    value.openItems.every(isOpenMenuItem)
  );
}

function isSupplyItem(value: unknown): value is SupplyItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    isOptionalString(value.unit) &&
    isOptionalString(value.notes) &&
    (value.isCustom === undefined || typeof value.isCustom === 'boolean') &&
    (value.isAuto === undefined || typeof value.isAuto === 'boolean')
  );
}

function isPreparationTask(value: unknown): value is PreparationTask {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.completed === 'boolean' &&
    (value.source === 'automatic' || value.source === 'custom') &&
    isOptionalString(value.notes)
  );
}

function isDocumentTask(value: unknown): value is DocumentTask {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.completed === 'boolean' &&
    isOptionalString(value.notes)
  );
}

function isManualRequirement(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    typeof value.unit === 'string' &&
    isOptionalString(value.notes)
  );
}

function isRecurrenceRule(
  value: unknown,
): value is {
  frequency: 'weekly';
  interval: number;
  dayOfWeek: number;
  startDate: string;
} {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.frequency === 'weekly' &&
    typeof value.interval === 'number' &&
    Number.isInteger(value.interval) &&
    value.interval >= 1 &&
    typeof value.dayOfWeek === 'number' &&
    Number.isInteger(value.dayOfWeek) &&
    value.dayOfWeek >= 0 &&
    value.dayOfWeek <= 6 &&
    typeof value.startDate === 'string'
  );
}

function isCateringEvent(value: unknown): value is CateringEvent {
  if (!isRecord(value)) {
    return false;
  }

  const recurrenceOk =
    value.recurrence === undefined || isRecurrenceRule(value.recurrence);
  const templateFlagOk =
    value.isRecurringTemplate === undefined ||
    typeof value.isRecurringTemplate === 'boolean';
  const manualOk =
    value.manualRequirements === undefined ||
    (Array.isArray(value.manualRequirements) &&
      value.manualRequirements.every(isManualRequirement));
  const sourceOk =
    value.sourceTemplateId === undefined ||
    typeof value.sourceTemplateId === 'string';

  return (
    typeof value.id === 'string' &&
    typeof value.eventName === 'string' &&
    typeof value.eventDate === 'string' &&
    typeof value.setupTime === 'string' &&
    typeof value.serviceStartTime === 'string' &&
    typeof value.serviceEndTime === 'string' &&
    typeof value.address === 'string' &&
    typeof value.guestCount === 'number' &&
    Number.isFinite(value.guestCount) &&
    typeof value.status === 'string' &&
    VALID_STATUSES.includes(value.status as CateringEventStatus) &&
    Array.isArray(value.assignedEmployees) &&
    value.assignedEmployees.every((name) => typeof name === 'string') &&
    isMenuOrder(value.menuOrder) &&
    Array.isArray(value.products) &&
    value.products.every(isSupplyItem) &&
    Array.isArray(value.equipment) &&
    value.equipment.every(isSupplyItem) &&
    Array.isArray(value.preparationTasks) &&
    value.preparationTasks.every(isPreparationTask) &&
    Array.isArray(value.documents) &&
    value.documents.every(isDocumentTask) &&
    isOptionalString(value.notes) &&
    recurrenceOk &&
    templateFlagOk &&
    manualOk &&
    sourceOk &&
    !('checklist' in value)
  );
}

function migrateMenuOrder(value: unknown): CateringMenuOrder {
  if (!isMenuOrder(value)) {
    return createEmptyMenuOrder();
  }
  return {
    cheeseburger: Math.max(0, Math.trunc(value.cheeseburger)),
    doubleCheeseburger: Math.max(0, Math.trunc(value.doubleCheeseburger)),
    veggieBurger: Math.max(0, Math.trunc(value.veggieBurger)),
    fries: Math.max(0, Math.trunc(value.fries)),
    openItems: value.openItems.map((item) => ({
      id: item.id || createId('open'),
      name: item.name,
      quantity: Math.max(0, Math.trunc(item.quantity)),
      ...(item.notes ? { notes: item.notes } : {}),
    })),
  };
}

type LegacyChecklistItem = {
  id: string;
  name: string;
  category: string;
  quantity?: unknown;
  unit?: unknown;
  completed?: unknown;
  notes?: unknown;
  isCustom?: unknown;
};

function asLegacyChecklistItem(value: unknown): LegacyChecklistItem | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.category !== 'string'
  ) {
    return null;
  }
  return value as unknown as LegacyChecklistItem;
}

function legacyQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 1;
}

/** Convert a legacy checklist item into a product SupplyItem (or drop it). */
function migrateProduct(raw: LegacyChecklistItem): SupplyItem | null {
  const key = normalizeItemName(raw.name);
  if (REMOVED_PRODUCT_NAMES.has(key) || AUTO_PRODUCT_NAMES.has(key)) {
    return null;
  }

  const item: SupplyItem = {
    id: raw.id,
    name: raw.name,
    quantity: legacyQuantity(raw.quantity),
    isCustom: raw.isCustom === true,
  };
  if (typeof raw.unit === 'string' && raw.unit.trim()) {
    item.unit = raw.unit;
  }
  // Ketchup note is intentionally dropped during migration.
  if (
    key !== normalizeItemName('Ketchup') &&
    typeof raw.notes === 'string' &&
    raw.notes.trim()
  ) {
    item.notes = raw.notes;
  }
  return item;
}

/** Convert a legacy checklist item into an equipment SupplyItem (or drop it). */
function migrateEquipment(raw: LegacyChecklistItem): SupplyItem | null {
  const key = normalizeItemName(raw.name);
  if (REMOVED_EQUIPMENT_NAMES.has(key)) {
    return null;
  }

  let name = raw.name;
  let quantity = legacyQuantity(raw.quantity);
  let notes = typeof raw.notes === 'string' ? raw.notes : undefined;

  if (key === normalizeItemName('White grills')) {
    name = 'Grills';
    // Old default was 2; treat that as the default and reset to 1.
    quantity = quantity === 2 ? 1 : quantity;
  } else if (key === normalizeItemName('Buckets for used oil')) {
    name = 'Container for beef tallow';
    quantity = 1;
  }

  if (key === normalizeItemName('Fryer')) {
    notes = undefined;
  }

  const item: SupplyItem = {
    id: raw.id,
    name,
    quantity,
    isCustom: raw.isCustom === true,
  };
  if (typeof raw.unit === 'string' && raw.unit.trim()) {
    item.unit = raw.unit;
  }
  if (notes && notes.trim() && !isAutoEquipmentName(name)) {
    item.notes = notes;
  }
  return item;
}

function migrateDocument(raw: LegacyChecklistItem): DocumentTask {
  const item: DocumentTask = {
    id: raw.id,
    name: raw.name,
    completed: raw.completed === true,
  };
  if (typeof raw.notes === 'string' && raw.notes.trim()) {
    item.notes = raw.notes;
  }
  return item;
}

/** Migrate a legacy (checklist-based) event or a partially-shaped event. */
export function migrateCateringEvent(value: unknown): CateringEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.eventName !== 'string' ||
    typeof value.eventDate !== 'string' ||
    typeof value.setupTime !== 'string' ||
    typeof value.serviceStartTime !== 'string' ||
    typeof value.serviceEndTime !== 'string' ||
    typeof value.address !== 'string' ||
    typeof value.guestCount !== 'number' ||
    !Number.isFinite(value.guestCount) ||
    typeof value.status !== 'string' ||
    !VALID_STATUSES.includes(value.status as CateringEventStatus) ||
    !Array.isArray(value.assignedEmployees) ||
    !value.assignedEmployees.every((name) => typeof name === 'string')
  ) {
    return null;
  }

  const menuOrder = migrateMenuOrder(value.menuOrder);

  let products: SupplyItem[] = [];
  let equipment: SupplyItem[] = [];
  let documents: DocumentTask[] = [];

  if (Array.isArray(value.products) && value.products.every(isSupplyItem)) {
    products = (value.products as SupplyItem[]).map((item) => ({ ...item }));
  }
  if (Array.isArray(value.equipment) && value.equipment.every(isSupplyItem)) {
    equipment = (value.equipment as SupplyItem[]).map((item) => ({ ...item }));
  }
  if (Array.isArray(value.documents) && value.documents.every(isDocumentTask)) {
    documents = (value.documents as DocumentTask[]).map((item) => ({ ...item }));
  }

  // Legacy checklist-based shape: split by category.
  if (Array.isArray(value.checklist)) {
    for (const rawItem of value.checklist) {
      const legacy = asLegacyChecklistItem(rawItem);
      if (!legacy) {
        continue;
      }
      if (legacy.category === 'products') {
        const product = migrateProduct(legacy);
        if (product) {
          products.push(product);
        }
      } else if (legacy.category === 'equipment') {
        const equip = migrateEquipment(legacy);
        if (equip) {
          equipment.push(equip);
        }
      } else if (legacy.category === 'documents') {
        documents.push(migrateDocument(legacy));
      }
      // logistics / food-prep / purchasing are dropped
    }
  }

  products = ensureStandardProducts(products);
  equipment = applyAutoEquipmentQuantities(ensureStandardEquipment(equipment));

  let preparationTasks: PreparationTask[] = [];
  if (
    Array.isArray(value.preparationTasks) &&
    value.preparationTasks.every(isPreparationTask)
  ) {
    preparationTasks = (value.preparationTasks as PreparationTask[]).map((task) => ({
      ...task,
    }));
  }

  const notes =
    typeof value.notes === 'string'
      ? value.notes
      : typeof value.eventNotes === 'string'
        ? value.eventNotes
        : undefined;

  const event: CateringEvent = {
    id: value.id,
    eventName: value.eventName,
    eventDate: value.eventDate,
    setupTime: value.setupTime,
    serviceStartTime: value.serviceStartTime,
    serviceEndTime: value.serviceEndTime,
    address: value.address,
    guestCount: value.guestCount,
    status: value.status as CateringEventStatus,
    assignedEmployees: value.assignedEmployees,
    menuOrder,
    products,
    equipment,
    preparationTasks,
    documents,
  };

  if (notes && notes.trim()) {
    event.notes = notes.trim();
  }

  if (isRecurrenceRule(value.recurrence)) {
    const recurrence = value.recurrence;
    event.recurrence = {
      frequency: 'weekly',
      interval: recurrence.interval,
      dayOfWeek: recurrence.dayOfWeek,
      startDate: recurrence.startDate,
    };
  }
  if (value.isRecurringTemplate === true) {
    event.isRecurringTemplate = true;
  }
  if (
    Array.isArray(value.manualRequirements) &&
    value.manualRequirements.every(isManualRequirement)
  ) {
    event.manualRequirements = value.manualRequirements.map((item) => {
      const requirement = item as {
        id: string;
        name: string;
        quantity: number;
        unit: string;
        notes?: string;
      };
      return {
        id: requirement.id,
        name: requirement.name,
        quantity: requirement.quantity,
        unit: requirement.unit,
        ...(requirement.notes ? { notes: requirement.notes } : {}),
      };
    });
  }

  return event;
}

function getSeedCopy(): CateringEvent[] {
  return structuredClone(seedCaterings);
}

/** Local catering writes are disabled — shared GitHub storage is primary. */
export function saveCaterings(_events: CateringEvent[]): void {
  // No-op.
}

/**
 * Normalize a parsed JSON value into catering events.
 * Throws when the payload is not a usable array.
 */
export function normalizeCateringsPayload(parsed: unknown): CateringEvent[] {
  if (!Array.isArray(parsed)) {
    throw new Error('Shared caterings file is not a valid array.');
  }

  if (parsed.every(isCateringEvent)) {
    return parsed.map((event) => structuredClone(event));
  }

  const migrated = parsed
    .map(migrateCateringEvent)
    .filter((event): event is CateringEvent => event !== null);

  if (migrated.length === 0 && parsed.length > 0) {
    throw new Error('Shared caterings file is corrupted and cannot be read.');
  }

  return migrated;
}

/** @deprecated Shared GitHub storage is the primary catering source. */
export function loadCaterings(): CateringEvent[] {
  return getSeedCopy();
}

export function collectEmployeeNames(events: CateringEvent[]): string[] {
  const names: string[] = [];
  for (const event of events) {
    names.push(...event.assignedEmployees);
  }
  return names;
}

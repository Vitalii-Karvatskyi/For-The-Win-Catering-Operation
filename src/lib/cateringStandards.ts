import type { SupplyItem } from '../types/cateringOperations';

export type StandardItemDefinition = {
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
  isAuto?: boolean;
};

export const STANDARD_PRODUCTS: readonly StandardItemDefinition[] = [
  { name: 'Salt', quantity: 1 },
  { name: 'Salt & pepper', quantity: 1 },
  { name: 'Beef tallow', quantity: 1 },
  { name: 'Pickles', quantity: 1 },
  { name: 'Mustard', quantity: 1 },
  { name: 'Ketchup', quantity: 1 },
];

/** Equipment names whose quantities are calculated automatically. */
export const AUTO_GAS_TANKS = 'Gas tanks';
export const AUTO_TABLECLOTHS = 'Tablecloths';
export const EQUIPMENT_GRILLS = 'Grills';
export const EQUIPMENT_FRYER = 'Fryer';
export const EQUIPMENT_TABLES = 'Tables';

export const STANDARD_EQUIPMENT: readonly StandardItemDefinition[] = [
  { name: 'Fry baskets', quantity: 1 },
  { name: 'Lighter', quantity: 1 },
  { name: 'Stapler', quantity: 1 },
  { name: 'Trash can', quantity: 1 },
  { name: 'Bag with pagers, cash register, and printer', quantity: 1 },
  { name: 'Tent / canopy', quantity: 1 },
  { name: 'Tables', quantity: 1 },
  { name: 'Ticket line / order tickets', quantity: 1 },
  { name: 'Fryer', quantity: 1 },
  { name: 'Grills', quantity: 1 },
  { name: 'Receipt paper rolls', quantity: 1 },
  { name: 'Gloves', quantity: 1 },
  { name: 'Bottle for water', quantity: 1 },
  { name: 'Gas tanks', quantity: 2, isAuto: true },
  { name: 'Tablecloths', quantity: 1, isAuto: true },
  { name: 'Poster menu', quantity: 1 },
  { name: 'Towels', quantity: 1 },
  { name: 'Trash bags', quantity: 1 },
  { name: 'Container for tools', quantity: 1 },
  { name: 'Container for beef tallow', quantity: 1 },
  { name: 'Large grill scraper with blade', quantity: 1 },
  { name: 'Black spatula for flipping patties', quantity: 1 },
  { name: 'Rectangular container for fries', quantity: 1 },
  { name: 'Smasher', quantity: 1 },
  { name: 'Spatulas', quantity: 3 },
  { name: 'Salt shakers', quantity: 2 },
  { name: 'Containers for napkins, sauces, and other items', quantity: 1 },
  { name: 'Plate for salting fries', quantity: 1 },
];

export function createId(prefix = 'item'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCateringEventId(): string {
  return createId('evt');
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

function toSupplyItems(
  definitions: readonly StandardItemDefinition[],
  prefix: string,
): SupplyItem[] {
  return definitions.map((definition) => {
    const item: SupplyItem = {
      id: createId(prefix),
      name: definition.name,
      quantity: definition.quantity,
      isCustom: false,
    };
    if (definition.unit) {
      item.unit = definition.unit;
    }
    if (definition.notes) {
      item.notes = definition.notes;
    }
    if (definition.isAuto) {
      item.isAuto = true;
    }
    return item;
  });
}

export function createStandardProducts(): SupplyItem[] {
  return toSupplyItems(STANDARD_PRODUCTS, 'prod');
}

export function createStandardEquipment(): SupplyItem[] {
  return applyAutoEquipmentQuantities(toSupplyItems(STANDARD_EQUIPMENT, 'eq'));
}

function findQuantity(equipment: SupplyItem[], name: string): number {
  const key = normalizeItemName(name);
  const item = equipment.find((entry) => normalizeItemName(entry.name) === key);
  return item ? item.quantity : 0;
}

/**
 * Gas tanks = grills + fryer, Tablecloths = tables. Pure — returns a new array.
 */
export function applyAutoEquipmentQuantities(equipment: SupplyItem[]): SupplyItem[] {
  const grills = findQuantity(equipment, EQUIPMENT_GRILLS);
  const fryer = findQuantity(equipment, EQUIPMENT_FRYER);
  const tables = findQuantity(equipment, EQUIPMENT_TABLES);
  const gasTanks = grills + fryer;

  return equipment.map((item) => {
    const key = normalizeItemName(item.name);
    if (key === normalizeItemName(AUTO_GAS_TANKS)) {
      return { ...item, quantity: gasTanks, isAuto: true };
    }
    if (key === normalizeItemName(AUTO_TABLECLOTHS)) {
      return { ...item, quantity: tables, isAuto: true };
    }
    return item;
  });
}

export function isAutoEquipmentName(name: string): boolean {
  const key = normalizeItemName(name);
  return (
    key === normalizeItemName(AUTO_GAS_TANKS) ||
    key === normalizeItemName(AUTO_TABLECLOTHS)
  );
}

export function isStandardProductName(name: string): boolean {
  const key = normalizeItemName(name);
  return STANDARD_PRODUCTS.some((item) => normalizeItemName(item.name) === key);
}

export function isStandardEquipmentName(name: string): boolean {
  const key = normalizeItemName(name);
  return STANDARD_EQUIPMENT.some((item) => normalizeItemName(item.name) === key);
}

/** Merge any missing standard products into an existing list without duplicates. */
export function ensureStandardProducts(products: SupplyItem[]): SupplyItem[] {
  const result = [...products];
  const present = new Set(result.map((item) => normalizeItemName(item.name)));
  for (const definition of STANDARD_PRODUCTS) {
    const key = normalizeItemName(definition.name);
    if (present.has(key)) {
      continue;
    }
    result.push(...toSupplyItems([definition], 'prod'));
    present.add(key);
  }
  return result;
}

/** Merge any missing standard equipment into an existing list without duplicates. */
export function ensureStandardEquipment(equipment: SupplyItem[]): SupplyItem[] {
  const result = [...equipment];
  const present = new Set(result.map((item) => normalizeItemName(item.name)));
  for (const definition of STANDARD_EQUIPMENT) {
    const key = normalizeItemName(definition.name);
    if (present.has(key)) {
      continue;
    }
    result.push(...toSupplyItems([definition], 'eq'));
    present.add(key);
  }
  return applyAutoEquipmentQuantities(result);
}

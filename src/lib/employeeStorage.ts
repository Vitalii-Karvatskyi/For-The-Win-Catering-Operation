import type { Employee } from '../types/cateringOperations';
import { createId, normalizeItemName } from './cateringStandards';

function isEmployee(value: unknown): value is Employee {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.name === 'string';
}

/**
 * Normalize a parsed JSON value into employees.
 * Throws when the payload is not a usable array.
 */
export function normalizeEmployeesPayload(parsed: unknown): Employee[] {
  if (!Array.isArray(parsed)) {
    throw new Error('Shared employees file is not a valid array.');
  }
  if (!parsed.every(isEmployee)) {
    throw new Error('Shared employees file is corrupted and cannot be read.');
  }
  return parsed.map((employee) => ({ ...employee }));
}

/** Pure helper — does not persist. Used by UI before GitHub write. */
export function buildEmployeeAddition(
  employees: Employee[],
  name: string,
): { employees: Employee[]; employee: Employee | null; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { employees, employee: null, error: 'Employee name is required.' };
  }

  const key = normalizeItemName(trimmed);
  const existing = employees.find(
    (employee) => normalizeItemName(employee.name) === key,
  );
  if (existing) {
    return {
      employees,
      employee: null,
      error: 'This employee is already in the list.',
    };
  }

  const employee: Employee = {
    id: createId('emp'),
    name: trimmed,
  };
  return { employees: [...employees, employee], employee };
}

/** @deprecated Prefer GitHub-backed employee list. */
export function loadEmployees(seedNames: string[] = []): Employee[] {
  const unique = new Map<string, string>();
  for (const name of seedNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeItemName(trimmed);
    if (!unique.has(key)) {
      unique.set(key, trimmed);
    }
  }

  return [...unique.values()].map((name) => ({
    id: createId('emp'),
    name,
  }));
}

/** @deprecated Local persistence removed — kept for type compatibility. */
export function saveEmployees(_employees: Employee[]): void {
  // No-op: employees are stored in GitHub.
}

/** @deprecated Use buildEmployeeAddition + GitHub save. */
export function addEmployee(
  employees: Employee[],
  name: string,
): { employees: Employee[]; employee: Employee | null; error?: string } {
  return buildEmployeeAddition(employees, name);
}

import type { Employee } from '../types/cateringOperations';
import { createId, normalizeItemName } from './cateringStandards';

export const EMPLOYEE_STORAGE_KEY = 'ftw-catering-employees-v2';
const LEGACY_EMPLOYEE_STORAGE_KEYS = ['ftw-catering-employees-v1'];

function isEmployee(value: unknown): value is Employee {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.name === 'string';
}

function persistEmployees(employees: Employee[]): void {
  try {
    window.localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employees));
  } catch {
    // Ignore storage failures.
  }
}

export function saveEmployees(employees: Employee[]): void {
  persistEmployees(employees);
}

function clearLegacyStorage(): void {
  for (const key of LEGACY_EMPLOYEE_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

export function loadEmployees(seedNames: string[] = []): Employee[] {
  clearLegacyStorage();

  try {
    const raw = window.localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isEmployee)) {
        return parsed.map((employee) => ({ ...employee }));
      }
    }
  } catch {
    // Fall through to seed.
  }

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

  const employees = [...unique.values()].map((name) => ({
    id: createId('emp'),
    name,
  }));

  persistEmployees(employees);
  return employees;
}

export function addEmployee(
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
  const next = [...employees, employee];
  persistEmployees(next);
  return { employees: next, employee };
}

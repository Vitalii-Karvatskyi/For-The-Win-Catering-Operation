import type { TodoAuthStorageV1, TodoCryptoKeys } from '../types/todo';
import {
  exportKeyToBase64,
  importKeyFromBase64,
} from '../services/todoCryptoService';
import { TODO_AUTH_STORAGE_KEY } from './activePanel';

export function clearTodoAuthStorage(): void {
  try {
    window.localStorage.removeItem(TODO_AUTH_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

export function readTodoAuthStorage(): TodoAuthStorageV1 | null {
  try {
    const raw = window.localStorage.getItem(TODO_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as TodoAuthStorageV1).version !== 1 ||
      typeof (parsed as TodoAuthStorageV1).employeesKeyBase64 !== 'string' ||
      typeof (parsed as TodoAuthStorageV1).tasksKeyBase64 !== 'string' ||
      !(parsed as TodoAuthStorageV1).employeesKeyBase64 ||
      !(parsed as TodoAuthStorageV1).tasksKeyBase64
    ) {
      clearTodoAuthStorage();
      return null;
    }
    return parsed as TodoAuthStorageV1;
  } catch {
    clearTodoAuthStorage();
    return null;
  }
}

export async function importTodoKeysFromStorage(): Promise<TodoCryptoKeys | null> {
  const stored = readTodoAuthStorage();
  if (!stored) {
    return null;
  }
  try {
    const [employeesKey, tasksKey] = await Promise.all([
      importKeyFromBase64(stored.employeesKeyBase64),
      importKeyFromBase64(stored.tasksKeyBase64),
    ]);
    return { employeesKey, tasksKey };
  } catch {
    clearTodoAuthStorage();
    return null;
  }
}

export async function persistTodoKeys(keys: TodoCryptoKeys): Promise<void> {
  const [employeesKeyBase64, tasksKeyBase64] = await Promise.all([
    exportKeyToBase64(keys.employeesKey),
    exportKeyToBase64(keys.tasksKey),
  ]);
  const payload: TodoAuthStorageV1 = {
    version: 1,
    employeesKeyBase64,
    tasksKeyBase64,
  };
  window.localStorage.setItem(TODO_AUTH_STORAGE_KEY, JSON.stringify(payload));
}

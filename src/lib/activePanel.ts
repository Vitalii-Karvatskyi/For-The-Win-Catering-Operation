export const ACTIVE_PANEL_STORAGE_KEY = 'ftw-active-panel';
export const TODO_AUTH_STORAGE_KEY = 'ftw-todo-auth-v1';

export type AppPanel = 'catering' | 'todo';

export function readActivePanel(): AppPanel {
  try {
    const raw = window.localStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
    if (raw === 'todo' || raw === 'catering') {
      return raw;
    }
  } catch {
    // Ignore storage failures.
  }
  return 'catering';
}

export function writeActivePanel(panel: AppPanel): void {
  try {
    window.localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, panel);
  } catch {
    // Ignore storage failures.
  }
}

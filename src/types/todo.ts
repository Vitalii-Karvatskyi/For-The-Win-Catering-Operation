export const UNASSIGNED_COMPLETION_KEY = '__unassigned__';

/** Marker for completed without a known calendar date (legacy spreadsheet null). */
export const COMPLETION_DATE_UNKNOWN = 'unknown';

export type TodoEmployee = {
  id: string;
  name: string;
  createdAt: string;
};

export type TodoTask = {
  id: string;
  title: string;
  department?: string;
  description?: string;
  notes?: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
  deadlineDate?: string;
  /** Per-assignee completion timestamps (ISO). Key may be employee id or UNASSIGNED_COMPLETION_KEY. */
  completedAtByAssignee: Record<string, string>;
};

export type TodoTaskFormValues = {
  title: string;
  department: string;
  description: string;
  notes: string;
  assigneeIds: string[];
  deadlineDate: string;
};

export type EncryptedEnvelope = {
  version: 1;
  initialized: boolean;
  algorithm?: 'AES-GCM';
  iv?: string;
  ciphertext?: string;
};

export type TodoAuthStorageV1 = {
  version: 1;
  employeesKeyBase64: string;
  tasksKeyBase64: string;
};

export type TodoCryptoKeys = {
  employeesKey: CryptoKey;
  tasksKey: CryptoKey;
};

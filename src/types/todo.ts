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
  amountOrDueDate?: string;
  involvement?: string;
  notes?: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
  deadlineDate?: string;
  completed: boolean;
  completedAt?: string | null;
};

export type TodoTaskFormValues = {
  title: string;
  department: string;
  description: string;
  amountOrDueDate: string;
  involvement: string;
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

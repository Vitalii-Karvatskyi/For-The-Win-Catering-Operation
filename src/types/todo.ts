export type TodoEmployee = {
  id: string;
  name: string;
  createdAt: string;
};

export type TodoTask = {
  id: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
  deadlineDate?: string;
  completed: boolean;
  completedAt?: string | null;
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

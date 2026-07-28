import type {
  EncryptedEnvelope,
  TodoEmployee,
  TodoTask,
} from '../types/todo';
import {
  GitHubApiError,
  putJsonFile,
  readJsonFile,
} from './githubDataService';
import {
  decryptJson,
  encryptJson,
  parseEncryptedEnvelope,
  TodoCryptoError,
} from './todoCryptoService';

export const TODO_EMPLOYEES_PATH = 'data/todo-employees.enc.json';
export const TODO_TASKS_PATH = 'data/todo-tasks.enc.json';

function todoConflictError(status: number | null): GitHubApiError {
  return new GitHubApiError(
    'The To Do data changed on another device. Refresh and try again.',
    status,
    'conflict',
  );
}

function assertEmployeeArray(value: unknown): TodoEmployee[] {
  if (!Array.isArray(value)) {
    throw new TodoCryptoError('Encrypted To Do employees data is invalid.', 'corrupt');
  }
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as TodoEmployee).id !== 'string' ||
      typeof (item as TodoEmployee).name !== 'string' ||
      typeof (item as TodoEmployee).createdAt !== 'string'
    ) {
      throw new TodoCryptoError(
        'Encrypted To Do employees data is invalid.',
        'corrupt',
      );
    }
  }
  return value as TodoEmployee[];
}

function assertTaskArray(value: unknown): TodoTask[] {
  if (!Array.isArray(value)) {
    throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
  }
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as TodoTask).id !== 'string' ||
      typeof (item as TodoTask).title !== 'string' ||
      !Array.isArray((item as TodoTask).assigneeIds) ||
      typeof (item as TodoTask).createdAt !== 'string' ||
      typeof (item as TodoTask).updatedAt !== 'string' ||
      typeof (item as TodoTask).completed !== 'boolean'
    ) {
      throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
    }
  }
  return value as TodoTask[];
}

export async function loadEncryptedTodoEmployees(
  token?: string,
): Promise<{ sha: string; envelope: EncryptedEnvelope }> {
  const { sha, data } = await readJsonFile<unknown>(TODO_EMPLOYEES_PATH, token);
  return { sha, envelope: parseEncryptedEnvelope(data) };
}

export async function loadEncryptedTodoTasks(
  token?: string,
): Promise<{ sha: string; envelope: EncryptedEnvelope }> {
  const { sha, data } = await readJsonFile<unknown>(TODO_TASKS_PATH, token);
  return { sha, envelope: parseEncryptedEnvelope(data) };
}

export async function saveEncryptedTodoEmployees(
  envelope: EncryptedEnvelope,
  sha: string,
  message: string,
  token?: string,
): Promise<void> {
  await putJsonFile(TODO_EMPLOYEES_PATH, envelope, sha, message, token);
}

export async function saveEncryptedTodoTasks(
  envelope: EncryptedEnvelope,
  sha: string,
  message: string,
  token?: string,
): Promise<void> {
  await putJsonFile(TODO_TASKS_PATH, envelope, sha, message, token);
}

async function putEncryptedWithRetry(
  path: string,
  buildEnvelope: () => Promise<EncryptedEnvelope>,
  message: string,
  token?: string,
): Promise<void> {
  const attempt = async (): Promise<void> => {
    const { sha, data } = await readJsonFile<unknown>(path, token);
    const envelope = parseEncryptedEnvelope(data);
    if (envelope.initialized) {
      return;
    }
    const nextEnvelope = await buildEnvelope();
    await putJsonFile(path, nextEnvelope, sha, message, token);
  };

  try {
    await attempt();
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'conflict') {
      throw error;
    }
    try {
      await attempt();
    } catch (retryError) {
      if (retryError instanceof GitHubApiError && retryError.code === 'conflict') {
        throw todoConflictError(retryError.status);
      }
      throw retryError;
    }
  }
}

async function ensureInitializedEmployees(
  key: CryptoKey,
  token?: string,
): Promise<TodoEmployee[]> {
  let { envelope } = await loadEncryptedTodoEmployees(token);
  if (!envelope.initialized) {
    await putEncryptedWithRetry(
      TODO_EMPLOYEES_PATH,
      () => encryptJson([], key),
      'Initialize encrypted To Do employees',
      token,
    );
    ({ envelope } = await loadEncryptedTodoEmployees(token));
  }
  if (!envelope.initialized) {
    return [];
  }
  return assertEmployeeArray(await decryptJson(envelope, key));
}

async function ensureInitializedTasks(
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  let { envelope } = await loadEncryptedTodoTasks(token);
  if (!envelope.initialized) {
    await putEncryptedWithRetry(
      TODO_TASKS_PATH,
      () => encryptJson([], key),
      'Initialize encrypted To Do tasks',
      token,
    );
    ({ envelope } = await loadEncryptedTodoTasks(token));
  }
  if (!envelope.initialized) {
    return [];
  }
  return assertTaskArray(await decryptJson(envelope, key));
}

export async function loadTodoEmployees(
  key: CryptoKey,
  token?: string,
): Promise<TodoEmployee[]> {
  return ensureInitializedEmployees(key, token);
}

export async function loadTodoTasks(
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  return ensureInitializedTasks(key, token);
}

async function mutateEncryptedEmployees(
  key: CryptoKey,
  message: string,
  mutate: (current: TodoEmployee[]) => TodoEmployee[],
  token?: string,
): Promise<TodoEmployee[]> {
  const attempt = async (): Promise<TodoEmployee[]> => {
    const { sha, envelope } = await loadEncryptedTodoEmployees(token);
    if (!envelope.initialized) {
      throw new TodoCryptoError(
        'Encrypted To Do employees file is not initialized.',
        'corrupt',
      );
    }
    const current = assertEmployeeArray(await decryptJson(envelope, key));
    const next = mutate(current);
    const nextEnvelope = await encryptJson(next, key);
    await saveEncryptedTodoEmployees(nextEnvelope, sha, message, token);
    return next;
  };

  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'conflict') {
      throw error;
    }
  }

  try {
    return await attempt();
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === 'conflict') {
      throw todoConflictError(error.status);
    }
    throw error;
  }
}

async function mutateEncryptedTasks(
  key: CryptoKey,
  message: string,
  mutate: (current: TodoTask[]) => TodoTask[],
  token?: string,
): Promise<TodoTask[]> {
  const attempt = async (): Promise<TodoTask[]> => {
    const { sha, envelope } = await loadEncryptedTodoTasks(token);
    if (!envelope.initialized) {
      throw new TodoCryptoError(
        'Encrypted To Do tasks file is not initialized.',
        'corrupt',
      );
    }
    const current = assertTaskArray(await decryptJson(envelope, key));
    const next = mutate(current);
    const nextEnvelope = await encryptJson(next, key);
    await saveEncryptedTodoTasks(nextEnvelope, sha, message, token);
    return next;
  };

  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'conflict') {
      throw error;
    }
  }

  try {
    return await attempt();
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === 'conflict') {
      throw todoConflictError(error.status);
    }
    throw error;
  }
}

export async function addTodoEmployee(
  employee: TodoEmployee,
  key: CryptoKey,
  token?: string,
): Promise<TodoEmployee[]> {
  return mutateEncryptedEmployees(
    key,
    'Add To Do employee',
    (current) => {
      const duplicate = current.some(
        (item) => item.name.trim().toLowerCase() === employee.name.trim().toLowerCase(),
      );
      if (duplicate) {
        throw new GitHubApiError(
          'A person with this name already exists.',
          null,
          'invalid',
        );
      }
      return [...current, employee];
    },
    token,
  );
}

export async function createTodoTask(
  task: TodoTask,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  return mutateEncryptedTasks(
    key,
    'Add To Do task',
    (current) => [...current, task],
    token,
  );
}

export async function updateTodoTask(
  taskId: string,
  changes: Partial<
    Pick<TodoTask, 'title' | 'description' | 'assigneeIds' | 'deadlineDate'>
  >,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  return mutateEncryptedTasks(
    key,
    'Update To Do task',
    (current) => {
      const index = current.findIndex((task) => task.id === taskId);
      if (index === -1) {
        throw new GitHubApiError('Task was not found.', null, 'not-found');
      }
      const existing = current[index];
      const nextTask: TodoTask = {
        ...existing,
        title: changes.title ?? existing.title,
        description:
          changes.description === undefined
            ? existing.description
            : changes.description || undefined,
        assigneeIds: changes.assigneeIds ?? existing.assigneeIds,
        deadlineDate:
          changes.deadlineDate === undefined
            ? existing.deadlineDate
            : changes.deadlineDate || undefined,
        updatedAt: new Date().toISOString(),
        id: existing.id,
        createdAt: existing.createdAt,
        completed: existing.completed,
        completedAt: existing.completedAt,
      };
      const next = [...current];
      next[index] = nextTask;
      return next;
    },
    token,
  );
}

export async function completeTodoTask(
  taskId: string,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  return mutateEncryptedTasks(
    key,
    'Complete To Do task',
    (current) => {
      const index = current.findIndex((task) => task.id === taskId);
      if (index === -1) {
        throw new GitHubApiError('Task was not found.', null, 'not-found');
      }
      const existing = current[index];
      const now = new Date().toISOString();
      const next = [...current];
      next[index] = {
        ...existing,
        completed: true,
        completedAt: now,
        updatedAt: now,
      };
      return next;
    },
    token,
  );
}

export async function restoreTodoTask(
  taskId: string,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  return mutateEncryptedTasks(
    key,
    'Restore To Do task',
    (current) => {
      const index = current.findIndex((task) => task.id === taskId);
      if (index === -1) {
        throw new GitHubApiError('Task was not found.', null, 'not-found');
      }
      const existing = current[index];
      const next = [...current];
      next[index] = {
        ...existing,
        completed: false,
        completedAt: null,
        updatedAt: new Date().toISOString(),
      };
      return next;
    },
    token,
  );
}

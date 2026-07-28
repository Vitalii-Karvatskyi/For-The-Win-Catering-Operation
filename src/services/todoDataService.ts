import type {
  EncryptedEnvelope,
  TodoEmployee,
  TodoTask,
} from '../types/todo';
import { UNASSIGNED_COMPLETION_KEY } from '../types/todo';
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
export { UNASSIGNED_COMPLETION_KEY };

function todoConflictError(status: number | null): GitHubApiError {
  return new GitHubApiError(
    'The To Do data changed on another device. Refresh and try again.',
    status,
    'conflict',
  );
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseCompletedAtByAssignee(
  raw: Record<string, unknown>,
  assigneeIds: string[],
): Record<string, string> {
  if (isPlainRecord(raw.completedAtByAssignee)) {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.completedAtByAssignee)) {
      if (typeof key === 'string' && key && typeof value === 'string' && value) {
        next[key] = value;
      }
    }
    return next;
  }

  if (raw.completed === true) {
    const timestamp =
      (typeof raw.completedAt === 'string' && raw.completedAt) ||
      (typeof raw.updatedAt === 'string' && raw.updatedAt) ||
      (typeof raw.createdAt === 'string' && raw.createdAt) ||
      new Date().toISOString();

    if (assigneeIds.length > 0) {
      return Object.fromEntries(assigneeIds.map((id) => [id, timestamp]));
    }
    return { [UNASSIGNED_COMPLETION_KEY]: timestamp };
  }

  return {};
}

function pruneCompletionsForAssignees(
  completedAtByAssignee: Record<string, string>,
  assigneeIds: string[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(completedAtByAssignee).filter(([key]) =>
      assigneeIds.length === 0
        ? key === UNASSIGNED_COMPLETION_KEY
        : assigneeIds.includes(key),
    ),
  );
}

export function normalizeTodoTask(value: unknown): TodoTask {
  if (!value || typeof value !== 'object') {
    throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) {
    throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
  }
  if (typeof raw.title !== 'string') {
    throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
  }
  if (typeof raw.createdAt !== 'string' || typeof raw.updatedAt !== 'string') {
    throw new TodoCryptoError('Encrypted To Do tasks data is invalid.', 'corrupt');
  }

  const assigneeIds = Array.isArray(raw.assigneeIds)
    ? raw.assigneeIds.filter((id): id is string => typeof id === 'string')
    : [];

  const task: TodoTask = {
    id: raw.id,
    title: raw.title,
    assigneeIds,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    completedAtByAssignee: parseCompletedAtByAssignee(raw, assigneeIds),
  };

  const department = optionalString(raw.department);
  if (department) task.department = department;

  const description = optionalString(raw.description);
  if (description) task.description = description;

  const notes = optionalString(raw.notes);
  if (notes) task.notes = notes;

  const deadlineDate = optionalString(raw.deadlineDate);
  if (deadlineDate) task.deadlineDate = deadlineDate;

  // Legacy amountOrDueDate / involvement / completed / completedAt are ignored on purpose.

  return task;
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
  return value.map((item) => normalizeTodoTask(item));
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
    let { sha, envelope } = await loadEncryptedTodoEmployees(token);
    if (!envelope.initialized) {
      await putEncryptedWithRetry(
        TODO_EMPLOYEES_PATH,
        () => encryptJson([], key),
        'Initialize encrypted To Do employees',
        token,
      );
      ({ sha, envelope } = await loadEncryptedTodoEmployees(token));
    }
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
    let { sha, envelope } = await loadEncryptedTodoTasks(token);
    if (!envelope.initialized) {
      await putEncryptedWithRetry(
        TODO_TASKS_PATH,
        () => encryptJson([], key),
        'Initialize encrypted To Do tasks',
        token,
      );
      ({ sha, envelope } = await loadEncryptedTodoTasks(token));
    }
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

export async function updateTodoEmployee(
  employeeId: string,
  changes: { name: string },
  key: CryptoKey,
  token?: string,
): Promise<TodoEmployee[]> {
  const trimmed = changes.name.trim();
  if (!trimmed) {
    throw new GitHubApiError('Name is required.', null, 'invalid');
  }

  return mutateEncryptedEmployees(
    key,
    'Update To Do employee',
    (current) => {
      const index = current.findIndex((item) => item.id === employeeId);
      if (index === -1) {
        throw new GitHubApiError('Person was not found.', null, 'not-found');
      }
      const duplicate = current.some(
        (item) =>
          item.id !== employeeId &&
          item.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) {
        throw new GitHubApiError(
          'A person with this name already exists.',
          null,
          'invalid',
        );
      }
      const existing = current[index];
      const next = [...current];
      next[index] = {
        ...existing,
        id: existing.id,
        createdAt: existing.createdAt,
        name: trimmed,
      };
      return next;
    },
    token,
  );
}

export async function createTodoTask(
  task: TodoTask,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  const normalized = normalizeTodoTask({
    ...task,
    completedAtByAssignee: task.completedAtByAssignee ?? {},
  });
  return mutateEncryptedTasks(
    key,
    'Add To Do task',
    (latestTasks) => {
      if (latestTasks.some((item) => item.id === normalized.id)) {
        return latestTasks;
      }
      return [...latestTasks, normalized];
    },
    token,
  );
}

export type TodoTaskUpdateFields = Partial<
  Pick<
    TodoTask,
    | 'title'
    | 'department'
    | 'description'
    | 'notes'
    | 'assigneeIds'
    | 'deadlineDate'
  >
>;

export async function updateTodoTask(
  taskId: string,
  changes: TodoTaskUpdateFields,
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
      const nextAssigneeIds = changes.assigneeIds ?? existing.assigneeIds;
      const nextTask: TodoTask = {
        id: existing.id,
        title: changes.title ?? existing.title,
        assigneeIds: nextAssigneeIds,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        completedAtByAssignee: pruneCompletionsForAssignees(
          existing.completedAtByAssignee,
          nextAssigneeIds,
        ),
      };

      const department =
        changes.department === undefined
          ? existing.department
          : optionalString(changes.department);
      if (department) nextTask.department = department;

      const description =
        changes.description === undefined
          ? existing.description
          : optionalString(changes.description);
      if (description) nextTask.description = description;

      const notes =
        changes.notes === undefined ? existing.notes : optionalString(changes.notes);
      if (notes) nextTask.notes = notes;

      const deadlineDate =
        changes.deadlineDate === undefined
          ? existing.deadlineDate
          : optionalString(changes.deadlineDate);
      if (deadlineDate) nextTask.deadlineDate = deadlineDate;

      const next = [...current];
      next[index] = nextTask;
      return next;
    },
    token,
  );
}

function assertCompletionKeyMatchesTask(
  task: TodoTask,
  completionKey: string,
): void {
  if (completionKey === UNASSIGNED_COMPLETION_KEY) {
    if (task.assigneeIds.length !== 0) {
      throw new GitHubApiError(
        'Unassigned completion is only allowed for tasks with no assignees.',
        null,
        'invalid',
      );
    }
    return;
  }
  if (!task.assigneeIds.includes(completionKey)) {
    throw new GitHubApiError(
      'This person is not assigned to the task.',
      null,
      'invalid',
    );
  }
}

export async function completeTodoTask(
  taskId: string,
  completionKey: string,
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
      assertCompletionKeyMatchesTask(existing, completionKey);
      const now = new Date().toISOString();
      const next = [...current];
      next[index] = {
        ...existing,
        completedAtByAssignee: {
          ...existing.completedAtByAssignee,
          [completionKey]: now,
        },
        updatedAt: now,
      };
      return next;
    },
    token,
  );
}

export async function restoreTodoTask(
  taskId: string,
  completionKey: string,
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
      assertCompletionKeyMatchesTask(existing, completionKey);
      const nextCompleted = { ...existing.completedAtByAssignee };
      delete nextCompleted[completionKey];
      const next = [...current];
      next[index] = {
        ...existing,
        completedAtByAssignee: nextCompleted,
        updatedAt: new Date().toISOString(),
      };
      return next;
    },
    token,
  );
}

export async function deleteTodoTask(
  taskId: string,
  key: CryptoKey,
  token?: string,
): Promise<TodoTask[]> {
  const attempt = async (allowAlreadyDeleted: boolean): Promise<TodoTask[]> => {
    let { sha, envelope } = await loadEncryptedTodoTasks(token);
    if (!envelope.initialized) {
      await putEncryptedWithRetry(
        TODO_TASKS_PATH,
        () => encryptJson([], key),
        'Initialize encrypted To Do tasks',
        token,
      );
      ({ sha, envelope } = await loadEncryptedTodoTasks(token));
    }
    if (!envelope.initialized) {
      throw new TodoCryptoError(
        'Encrypted To Do tasks file is not initialized.',
        'corrupt',
      );
    }

    const latestTasks = assertTaskArray(await decryptJson(envelope, key));
    if (!latestTasks.some((task) => task.id === taskId)) {
      if (allowAlreadyDeleted) {
        return latestTasks;
      }
      throw new GitHubApiError('Task was not found.', null, 'not-found');
    }

    const updatedTasks = latestTasks.filter((task) => task.id !== taskId);
    if (latestTasks.length - updatedTasks.length !== 1) {
      throw new GitHubApiError(
        'Unable to delete task.',
        null,
        'invalid',
      );
    }

    const nextEnvelope = await encryptJson(updatedTasks, key);
    await saveEncryptedTodoTasks(
      nextEnvelope,
      sha,
      'Delete To Do task',
      token,
    );
    return updatedTasks;
  };

  try {
    return await attempt(false);
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'conflict') {
      throw error;
    }
  }

  try {
    return await attempt(true);
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === 'conflict') {
      throw todoConflictError(error.status);
    }
    throw error;
  }
}

import type { CateringEvent, Employee } from '../types/cateringOperations';
import {
  normalizeCateringsPayload,
  readLocalCateringsSnapshot,
} from '../lib/cateringStorage';
import {
  buildEmployeeAddition,
  normalizeEmployeesPayload,
  readLocalEmployeesSnapshot,
} from '../lib/employeeStorage';
import { normalizeItemName } from '../lib/cateringStandards';

export const GITHUB_TOKEN_STORAGE_KEY = 'ftw-github-token';

export const GITHUB_OWNER = 'vitalii-karvatskyi';
export const GITHUB_REPOSITORY = 'For-The-Win-Catering-Operation';
export const GITHUB_BRANCH = 'main';

export const CATERINGS_PATH = 'data/caterings.json';
export const EMPLOYEES_PATH = 'data/employees.json';

const GITHUB_API_VERSION = '2026-03-10';
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}`;

export class GitHubApiError extends Error {
  readonly status: number | null;
  readonly code:
    | 'unauthorized'
    | 'forbidden'
    | 'not-found'
    | 'conflict'
    | 'network'
    | 'corrupt'
    | 'invalid'
    | 'unknown';

  constructor(
    message: string,
    status: number | null,
    code: GitHubApiError['code'],
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.code = code;
  }
}

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
  sha: string;
};

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

export function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function getGitHubToken(): string {
  try {
    const raw = window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
    return raw?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setGitHubToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('GitHub token cannot be empty.');
  }
  window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, trimmed);
}

export function clearGitHubToken(): void {
  try {
    window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

function requireToken(token?: string): string {
  const resolved = (token ?? getGitHubToken()).trim();
  if (!resolved) {
    throw new GitHubApiError(
      'GitHub access expired. Enter a new token.',
      401,
      'unauthorized',
    );
  }
  return resolved;
}

function mapHttpError(status: number): GitHubApiError {
  if (status === 401) {
    return new GitHubApiError(
      'Invalid or expired GitHub token.',
      401,
      'unauthorized',
    );
  }
  if (status === 403) {
    return new GitHubApiError(
      'The token does not have access to this repository or has insufficient permissions.',
      403,
      'forbidden',
    );
  }
  if (status === 404) {
    return new GitHubApiError(
      'Repository or shared data file not found.',
      404,
      'not-found',
    );
  }
  if (status === 409 || status === 422) {
    return new GitHubApiError(
      'The data changed on another device. Refresh and try again.',
      status,
      'conflict',
    );
  }
  return new GitHubApiError(
    'Unable to complete the GitHub request.',
    status,
    'unknown',
  );
}

async function githubFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        ...authHeaders(token),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new GitHubApiError(
      'Unable to reach GitHub. Check your internet connection and try again.',
      null,
      'network',
    );
  }
}

export async function testGitHubConnection(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, error: 'GitHub Token is required.' };
  }

  const url = `${API_BASE}/contents/${CATERINGS_PATH}?ref=${GITHUB_BRANCH}`;
  let response: Response;
  try {
    response = await githubFetch(url, trimmed, { method: 'GET' });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error:
        'Unable to reach GitHub. Check your internet connection and try again.',
    };
  }

  if (response.ok) {
    return { ok: true };
  }
  if (response.status === 401) {
    return { ok: false, error: 'Invalid or expired GitHub token.' };
  }
  if (response.status === 403) {
    return {
      ok: false,
      error:
        'The token does not have access to this repository or has insufficient permissions.',
    };
  }
  if (response.status === 404) {
    return { ok: false, error: 'Repository or shared data file not found.' };
  }
  return { ok: false, error: 'Unable to connect to GitHub.' };
}

async function readRawFile(
  path: string,
  token?: string,
): Promise<{ sha: string; text: string }> {
  const resolved = requireToken(token);
  const url = `${API_BASE}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const response = await githubFetch(url, resolved, { method: 'GET' });

  if (!response.ok) {
    if (response.status === 401) {
      clearGitHubToken();
    }
    throw mapHttpError(response.status);
  }

  const payload = (await response.json()) as GitHubContentResponse;
  if (typeof payload.sha !== 'string' || typeof payload.content !== 'string') {
    throw new GitHubApiError(
      'Shared data file response was incomplete.',
      null,
      'corrupt',
    );
  }

  return { sha: payload.sha, text: decodeBase64Utf8(payload.content) };
}

export async function readJsonFile<T>(
  path: string,
  token?: string,
): Promise<{ sha: string; data: T }> {
  const { sha, text } = await readRawFile(path, token);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new GitHubApiError(
      'Shared data file contains invalid JSON.',
      null,
      'corrupt',
    );
  }
  return { sha, data: parsed as T };
}

async function putJsonFile(
  path: string,
  data: unknown,
  sha: string,
  message: string,
  token?: string,
): Promise<void> {
  const resolved = requireToken(token);
  const content = encodeBase64Utf8(`${JSON.stringify(data, null, 2)}\n`);
  const url = `${API_BASE}/contents/${path}`;
  const response = await githubFetch(url, resolved, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearGitHubToken();
    }
    throw mapHttpError(response.status);
  }
}

async function mutateJsonFile<T>(
  path: string,
  messageFor: (next: T) => string,
  parse: (raw: unknown) => T,
  mutate: (current: T) => T,
  token?: string,
): Promise<T> {
  const first = await readJsonFile<unknown>(path, token);
  let current = parse(first.data);
  let next = mutate(current);

  try {
    await putJsonFile(path, next, first.sha, messageFor(next), token);
    return next;
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'conflict') {
      throw error;
    }
  }

  const second = await readJsonFile<unknown>(path, token);
  current = parse(second.data);
  next = mutate(current);
  try {
    await putJsonFile(path, next, second.sha, messageFor(next), token);
    return next;
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === 'conflict') {
      throw new GitHubApiError(
        'The data changed on another device. Refresh and try again.',
        error.status,
        'conflict',
      );
    }
    throw error;
  }
}

function parseCaterings(raw: unknown): CateringEvent[] {
  try {
    return normalizeCateringsPayload(raw);
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error
        ? error.message
        : 'Shared caterings file is corrupted and cannot be read.',
      null,
      'corrupt',
    );
  }
}

function parseEmployees(raw: unknown): Employee[] {
  try {
    return normalizeEmployeesPayload(raw);
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error
        ? error.message
        : 'Shared employees file is corrupted and cannot be read.',
      null,
      'corrupt',
    );
  }
}

export async function loadCaterings(token?: string): Promise<CateringEvent[]> {
  const { data } = await readJsonFile<unknown>(CATERINGS_PATH, token);
  return parseCaterings(data);
}

export async function loadEmployees(token?: string): Promise<Employee[]> {
  const { data } = await readJsonFile<unknown>(EMPLOYEES_PATH, token);
  return parseEmployees(data);
}

export async function saveCaterings(
  events: CateringEvent[],
  message: string,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    () => message,
    parseCaterings,
    () => events.map((event) => structuredClone(event)),
    token,
  );
}

export async function createCatering(
  event: CateringEvent,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    () => `Add catering: ${event.eventName}`,
    parseCaterings,
    (current) => {
      if (current.some((item) => item.id === event.id)) {
        return current.map((item) =>
          item.id === event.id ? structuredClone(event) : item,
        );
      }
      return [...current, structuredClone(event)];
    },
    token,
  );
}

export async function updateCatering(
  event: CateringEvent,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    () => `Update catering: ${event.eventName}`,
    parseCaterings,
    (current) => {
      const index = current.findIndex((item) => item.id === event.id);
      if (index === -1) {
        throw new GitHubApiError(
          'Catering event was not found in shared data.',
          null,
          'not-found',
        );
      }
      const next = [...current];
      next[index] = structuredClone(event);
      return next;
    },
    token,
  );
}

export async function deleteCatering(
  eventId: string,
  eventName: string,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    () => `Update catering: ${eventName}`,
    parseCaterings,
    (current) => current.filter((item) => item.id !== eventId),
    token,
  );
}

export async function updatePreparationTask(
  eventId: string,
  taskId: string,
  completed: boolean,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    (next) => {
      const event = next.find((item) => item.id === eventId);
      return `Update preparation task: ${event?.eventName ?? 'Unknown'}`;
    },
    parseCaterings,
    (current) => {
      const index = current.findIndex((item) => item.id === eventId);
      if (index === -1) {
        throw new GitHubApiError(
          'Catering event was not found in shared data.',
          null,
          'not-found',
        );
      }
      const target = current[index];
      if (!target.preparationTasks.some((task) => task.id === taskId)) {
        throw new GitHubApiError(
          'Preparation task was not found.',
          null,
          'not-found',
        );
      }
      const next = [...current];
      next[index] = {
        ...target,
        preparationTasks: target.preparationTasks.map((task) =>
          task.id === taskId ? { ...task, completed } : task,
        ),
      };
      return next;
    },
    token,
  );
}

export async function updateDocument(
  eventId: string,
  documentId: string,
  completed: boolean,
  token?: string,
): Promise<CateringEvent[]> {
  return mutateJsonFile(
    CATERINGS_PATH,
    (next) => {
      const event = next.find((item) => item.id === eventId);
      return `Update document: ${event?.eventName ?? 'Unknown'}`;
    },
    parseCaterings,
    (current) => {
      const index = current.findIndex((item) => item.id === eventId);
      if (index === -1) {
        throw new GitHubApiError(
          'Catering event was not found in shared data.',
          null,
          'not-found',
        );
      }
      const target = current[index];
      if (!target.documents.some((doc) => doc.id === documentId)) {
        throw new GitHubApiError('Document was not found.', null, 'not-found');
      }
      const next = [...current];
      next[index] = {
        ...target,
        documents: target.documents.map((doc) =>
          doc.id === documentId ? { ...doc, completed } : doc,
        ),
      };
      return next;
    },
    token,
  );
}

export async function saveEmployees(
  employees: Employee[],
  message: string,
  token?: string,
): Promise<Employee[]> {
  return mutateJsonFile(
    EMPLOYEES_PATH,
    () => message,
    parseEmployees,
    () => employees.map((employee) => ({ ...employee })),
    token,
  );
}

export async function addEmployee(
  name: string,
  token?: string,
): Promise<{ employees: Employee[]; employee: Employee }> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new GitHubApiError('Employee name is required.', null, 'invalid');
  }

  let added: Employee | null = null;
  const employees = await mutateJsonFile(
    EMPLOYEES_PATH,
    () => `Add employee: ${trimmed}`,
    parseEmployees,
    (current) => {
      const result = buildEmployeeAddition(current, trimmed);
      if (result.error || !result.employee) {
        throw new GitHubApiError(
          result.error ?? 'Unable to add employee.',
          null,
          'invalid',
        );
      }
      added = result.employee;
      return result.employees;
    },
    token,
  );

  if (!added) {
    throw new GitHubApiError('Unable to add employee.', null, 'invalid');
  }

  return { employees, employee: added };
}

export function detectLocalDataForMigration(): boolean {
  const localCaterings = readLocalCateringsSnapshot();
  const localEmployees = readLocalEmployeesSnapshot();
  return (
    (localCaterings !== null && localCaterings.length > 0) ||
    (localEmployees !== null && localEmployees.length > 0)
  );
}

export async function uploadLocalData(
  token?: string,
): Promise<{ caterings: CateringEvent[]; employees: Employee[]; uploaded: boolean }> {
  const localCaterings = readLocalCateringsSnapshot() ?? [];
  const localEmployees = readLocalEmployeesSnapshot() ?? [];

  if (localCaterings.length === 0 && localEmployees.length === 0) {
    const [caterings, employees] = await Promise.all([
      loadCaterings(token),
      loadEmployees(token),
    ]);
    return { caterings, employees, uploaded: false };
  }

  const remoteCaterings = await loadCaterings(token);
  const remoteEmployees = await loadEmployees(token);

  const cateringMap = new Map<string, CateringEvent>();
  for (const event of localCaterings) {
    cateringMap.set(event.id, structuredClone(event));
  }
  for (const event of remoteCaterings) {
    cateringMap.set(event.id, structuredClone(event));
  }
  const mergedCaterings = [...cateringMap.values()];

  const employeeMap = new Map<string, Employee>();
  for (const employee of localEmployees) {
    employeeMap.set(normalizeItemName(employee.name), { ...employee });
  }
  for (const employee of remoteEmployees) {
    employeeMap.set(normalizeItemName(employee.name), { ...employee });
  }
  const mergedEmployees = [...employeeMap.values()];

  const cateringsToSave =
    mergedCaterings.length > 0 || remoteCaterings.length === 0
      ? mergedCaterings
      : remoteCaterings;
  const employeesToSave =
    mergedEmployees.length > 0 || remoteEmployees.length === 0
      ? mergedEmployees
      : remoteEmployees;

  const [caterings, employees] = await Promise.all([
    mutateJsonFile(
      CATERINGS_PATH,
      () => 'Migrate local FTW operations data',
      parseCaterings,
      () => cateringsToSave.map((event) => structuredClone(event)),
      token,
    ),
    mutateJsonFile(
      EMPLOYEES_PATH,
      () => 'Migrate local FTW operations data',
      parseEmployees,
      () => employeesToSave.map((employee) => ({ ...employee })),
      token,
    ),
  ]);

  return { caterings, employees, uploaded: true };
}

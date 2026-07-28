import type { EncryptedEnvelope } from '../types/todo';

/** SHA-256 of the To Do unlock password (never store plaintext). */
export const TODO_PASSWORD_SHA256 =
  '22e1b2171ed955401789d6d91fa9b062e30350dcab5a362eaec7a1e62ac407c0';

const EMPLOYEES_SALT_BASE64 = 'pQWyEeJk1VqYqDukOiZ6ug==';
const TASKS_SALT_BASE64 = 'YPcPaHwKwVjJ/xjjGat4LQ==';
const PBKDF2_ITERATIONS = 250_000;

export class TodoCryptoError extends Error {
  readonly code: 'decrypt' | 'corrupt' | 'invalid';

  constructor(message: string, code: TodoCryptoError['code'] = 'decrypt') {
    super(message);
    this.name = 'TodoCryptoError';
    this.code = code;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(password);
}

export async function verifyTodoPassword(password: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === TODO_PASSWORD_SHA256;
}

async function deriveAesKey(
  password: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveEmployeesKey(password: string): Promise<CryptoKey> {
  return deriveAesKey(password, EMPLOYEES_SALT_BASE64);
}

export async function deriveTasksKey(password: string): Promise<CryptoKey> {
  return deriveAesKey(password, TASKS_SALT_BASE64);
}

export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function importKeyFromBase64(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(value),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(
  data: unknown,
  key: CryptoKey,
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  return {
    version: 1,
    initialized: true,
    algorithm: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
): Promise<T> {
  if (
    !envelope.initialized ||
    envelope.algorithm !== 'AES-GCM' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new TodoCryptoError(
      'Unable to decrypt To Do data. Unlock To Do again.',
      'corrupt',
    );
  }

  try {
    const iv = base64ToBytes(envelope.iv);
    const ciphertext = base64ToBytes(envelope.ciphertext);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    const text = new TextDecoder().decode(plainBuffer);
    return JSON.parse(text) as T;
  } catch {
    throw new TodoCryptoError(
      'Unable to decrypt To Do data. Unlock To Do again.',
      'decrypt',
    );
  }
}

export function isUninitializedEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.version === 1 && record.initialized === false;
}

export function parseEncryptedEnvelope(value: unknown): EncryptedEnvelope {
  if (!value || typeof value !== 'object') {
    throw new TodoCryptoError(
      'Encrypted To Do file is corrupted.',
      'corrupt',
    );
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    throw new TodoCryptoError(
      'Encrypted To Do file is corrupted.',
      'corrupt',
    );
  }
  if (record.initialized === false) {
    return { version: 1, initialized: false };
  }
  if (
    record.initialized !== true ||
    record.algorithm !== 'AES-GCM' ||
    typeof record.iv !== 'string' ||
    typeof record.ciphertext !== 'string'
  ) {
    throw new TodoCryptoError(
      'Encrypted To Do file is corrupted.',
      'corrupt',
    );
  }
  return {
    version: 1,
    initialized: true,
    algorithm: 'AES-GCM',
    iv: record.iv,
    ciphertext: record.ciphertext,
  };
}

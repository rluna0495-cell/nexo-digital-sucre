const ACCOUNT_STORAGE_KEY = 'nexo_auth_account';
const SESSION_STORAGE_KEY = 'nexo_auth_session';
const PASSWORD_ITERATIONS = 310_000;

export interface AuthUser {
  username: string;
  displayName: string;
}

interface StoredAccount extends AuthUser {
  passwordSalt: string;
  passwordHash: string;
  recoverySalt: string;
  recoveryHash: string;
  recoveryCodeToDisplay: string | null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function createRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await window.crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: new TextEncoder().encode(salt),
    iterations: PASSWORD_ITERATIONS,
    hash: 'SHA-256',
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function readStoredAccount(): StoredAccount | null {
  const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (!stored) return null;

  const parsed: unknown = JSON.parse(stored);
  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('username' in parsed)
    || typeof parsed.username !== 'string'
    || !('displayName' in parsed)
    || typeof parsed.displayName !== 'string'
    || !('passwordSalt' in parsed)
    || typeof parsed.passwordSalt !== 'string'
    || !('passwordHash' in parsed)
    || typeof parsed.passwordHash !== 'string'
    || !('recoverySalt' in parsed)
    || typeof parsed.recoverySalt !== 'string'
    || !('recoveryHash' in parsed)
    || typeof parsed.recoveryHash !== 'string'
    || !('recoveryCodeToDisplay' in parsed)
    || !(typeof parsed.recoveryCodeToDisplay === 'string' || parsed.recoveryCodeToDisplay === null)
  ) {
    throw new Error('La configuración de inicio de sesión está dañada.');
  }

  return parsed as StoredAccount;
}

function saveAccount(account: StoredAccount): void {
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
}

export async function initializeAuth(): Promise<{
  account: AuthUser;
  recoveryCodeToDisplay: string | null;
  activeSession: AuthUser | null;
}> {
  let account = readStoredAccount();
  if (!account) {
    const recoveryCode = createRandomHex(8).match(/.{1,4}/g)?.join('-');
    if (!recoveryCode) throw new Error('No se pudo generar el código de recuperación.');

    const passwordSalt = createRandomHex(16);
    const recoverySalt = createRandomHex(16);
    account = {
      username: 'admin',
      displayName: 'Administrador',
      passwordSalt,
      passwordHash: await hashSecret('1234', passwordSalt),
      recoverySalt,
      recoveryHash: await hashSecret(recoveryCode.replace(/[^a-f\d]/gi, '').toUpperCase(), recoverySalt),
      recoveryCodeToDisplay: recoveryCode,
    };
    saveAccount(account);
  }

  const sessionUsername = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  const activeSession = sessionUsername?.toLocaleLowerCase() === account.username.toLocaleLowerCase()
    ? { username: account.username, displayName: account.displayName }
    : null;
  if (sessionUsername && !activeSession) window.sessionStorage.removeItem(SESSION_STORAGE_KEY);

  return {
    account: { username: account.username, displayName: account.displayName },
    recoveryCodeToDisplay: account.recoveryCodeToDisplay,
    activeSession,
  };
}

export async function authenticate(username: string, password: string): Promise<AuthUser | null> {
  const account = readStoredAccount();
  if (!account || username.trim().toLocaleLowerCase() !== account.username.toLocaleLowerCase()) return null;
  const passwordHash = await hashSecret(password, account.passwordSalt);
  if (passwordHash !== account.passwordHash) return null;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, account.username);
  return { username: account.username, displayName: account.displayName };
}

export function endAuthSession(): void {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function acknowledgeRecoveryCode(): void {
  const account = readStoredAccount();
  if (!account) throw new Error('No existe una cuenta para configurar.');
  account.recoveryCodeToDisplay = null;
  saveAccount(account);
}

export async function changeAccountCredentials(
  currentPassword: string,
  newPassword: string,
  displayName: string,
): Promise<AuthUser | null> {
  const account = readStoredAccount();
  if (!account) throw new Error('No existe una cuenta configurada.');
  const currentHash = await hashSecret(currentPassword, account.passwordSalt);
  if (currentHash !== account.passwordHash) return null;

  account.passwordSalt = createRandomHex(16);
  account.passwordHash = await hashSecret(newPassword, account.passwordSalt);
  account.displayName = displayName.trim() || account.displayName;
  saveAccount(account);
  return { username: account.username, displayName: account.displayName };
}

export async function recoverAccountPassword(
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<boolean> {
  const account = readStoredAccount();
  if (!account || username.trim().toLocaleLowerCase() !== account.username.toLocaleLowerCase()) return false;
  const normalizedCode = recoveryCode.replace(/[^a-f\d]/gi, '').toUpperCase();
  const recoveryHash = await hashSecret(normalizedCode, account.recoverySalt);
  if (recoveryHash !== account.recoveryHash) return false;

  account.passwordSalt = createRandomHex(16);
  account.passwordHash = await hashSecret(newPassword, account.passwordSalt);
  saveAccount(account);
  return true;
}

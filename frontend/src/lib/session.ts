const SESSION_KEY = 'cozynest_chat_session';

export function getSessionId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

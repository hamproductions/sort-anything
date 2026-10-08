import type { Session } from './types';

const INDEX_KEY = 'sa:sessions';
const sessionKey = (id: string) => `sa:session:${id}`;
const MAX_SESSIONS = 40;
const MAX_HISTORY = 150;

export const readJson = <T>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
};

export const writeJson = (key: string, value: unknown) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const listSessionIds = () => readJson<string[]>(INDEX_KEY) ?? [];

export const loadSession = (id: string) => readJson<Session>(sessionKey(id));

export const listSessions = () =>
  listSessionIds()
    .map(loadSession)
    .filter((s): s is Session => !!s)
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const deleteSession = (id: string) => {
  writeJson(sessionKey(id), undefined);
  writeJson(
    INDEX_KEY,
    listSessionIds().filter((x) => x !== id)
  );
};

export const saveSession = (session: Session) => {
  const trimmed = { ...session, history: session.history.slice(-MAX_HISTORY) };
  const ids = [session.id, ...listSessionIds().filter((x) => x !== session.id)];
  ids.slice(MAX_SESSIONS).forEach((id) => writeJson(sessionKey(id), undefined));
  writeJson(INDEX_KEY, ids.slice(0, MAX_SESSIONS));
  if (writeJson(sessionKey(session.id), trimmed)) return true;
  return writeJson(sessionKey(session.id), { ...trimmed, history: trimmed.history.slice(-10) });
};

export const createId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

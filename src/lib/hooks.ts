import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { readJson, writeJson } from './storage';

const subscribeHash = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

export const useHashRoute = () => {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash);
  const [, name = '', ...rest] = hash.replace(/^#/, '').split('/');
  return { name, param: rest.join('/') };
};

export const navigate = (path: string) => {
  location.hash = path;
  window.scrollTo({ top: 0 });
};

export const usePersistentState = <T>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(() => readJson<T>(key) ?? initial);
  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);
  return [value, setValue] as const;
};

export type Theme = 'system' | 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = usePersistentState<Theme>('sa:theme', 'system');
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  const cycle = useCallback(
    () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')),
    [setTheme]
  );
  return { theme, cycle };
};

export const useHotkeys = (handler: (event: KeyboardEvent) => void, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.metaKey || event.altKey) return;
      handler(event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handler, enabled]);
};

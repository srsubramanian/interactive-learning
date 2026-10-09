import { useCallback, useEffect, useRef, useState } from 'react';
import { getStore, saveStore } from '../api';
import type { Attempt, Lesson, Op, Store } from '../types';
import { understanding } from './level';

const EMPTY: Store = { progress: { add: [], sub: [] }, lessons: [] };

export function useAppStore() {
  const [store, setStore] = useState<Store>(EMPTY);
  const [loadedOk, setLoadedOk] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getStore().then((s) => { setStore(s); setLoadedOk(true); }).catch(() => setLoadedOk(false));
  }, []);

  // Save a moment after each change, but only once the saved copy was read (never overwrite with an empty one).
  useEffect(() => {
    if (!loadedOk) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveStore(store).then(() => setSaveError(false)).catch(() => setSaveError(true));
    }, 500);
    return () => window.clearTimeout(timer.current);
  }, [store, loadedOk]);

  const addAttempt = useCallback((att: Attempt) => {
    setStore((s) => {
      const k = att.op === '+' ? 'add' : 'sub';
      return { ...s, progress: { ...s.progress, [k]: [...s.progress[k], att].slice(-40) } };
    });
  }, []);
  const addLesson = useCallback((l: Lesson) => {
    setStore((s) => {
      const withId: Lesson = { ...l, id: l.id || String(Date.now()) + Math.random().toString(36).slice(2, 6), ts: Date.now() };
      return { ...s, lessons: [withId, ...s.lessons.filter((x) => x.id !== withId.id)].slice(0, 30) };
    });
  }, []);
  const removeLesson = useCallback((id: string) => {
    setStore((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== id) }));
  }, []);
  const skill = useCallback((op: Op) => understanding(store.progress[op === '+' ? 'add' : 'sub']), [store]);

  return { store, loadedOk, saveError, addAttempt, addLesson, removeLesson, skill };
}

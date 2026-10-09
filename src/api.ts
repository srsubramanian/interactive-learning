import type { Config, JudgeResult, Lesson, Op, Store } from './types';

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let m = 'Something went wrong (' + r.status + ')';
    try { const e = await r.json(); if (e && e.error) m = e.error; } catch { /* ignore */ }
    throw new Error(m);
  }
  return r.json() as Promise<T>;
}
const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const getConfig = () => fetch('/api/config').then((r) => j<Config>(r));

export async function fetchTts(text: string): Promise<Blob> {
  const r = await post('/api/tts', { text });
  if (!r.ok) await j(r);
  return r.blob();
}
export const sttApi = (blob: Blob) =>
  fetch('/api/stt', { method: 'POST', headers: { 'content-type': blob.type || 'audio/webm' }, body: blob }).then((r) => j<{ text: string }>(r));

export const judgeApi = (p: { a: number; b: number; op: Op; attempt: number; transcript: string }) =>
  post('/api/judge', p).then((r) => j<JudgeResult>(r));

export const explainApi = (p: { a?: number; b?: number; op?: Op; level: number; topic?: string; profile?: unknown }) =>
  post('/api/explain', p).then((r) => j<Lesson>(r));

export const getStore = () => fetch('/api/store').then((r) => j<Store>(r));
export const saveStore = (s: Store) => post('/api/store', s).then((r) => j<Store>(r));

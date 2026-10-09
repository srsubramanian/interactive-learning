import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jm-'));
process.env.ANTHROPIC_API_KEY = 'k';
process.env.ELEVENLABS_API_KEY = 'k';
process.env.ELEVENLABS_VOICE_ID = 'v';

const { judge, explain } = await import('../server/claude.js');
const { cleanStore } = await import('../server/schema.js');
const { parseEnvLine } = await import('../server/config.js');
const { server } = await import('../server/index.js');

const claudeSays = (obj) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(obj) }] }), { status: 200 }));

describe('judge', () => {
  it('decides correctness in code, not by the model', async () => {
    claudeSays({ said: 12, verdict: 'wrong', line: 'Not quite.' });
    const r = await judge({ a: 7, b: 5, op: '+', attempt: 1, transcript: 'twelve' });
    expect(r.verdict).toBe('correct');
    expect(r.line).toBe('Yes! That is right!');
  });
  it('does not leak the answer before the third try', async () => {
    claudeSays({ said: 11, verdict: 'wrong', line: 'Close, it is 12!' });
    const r = await judge({ a: 7, b: 5, op: '+', attempt: 1, transcript: 'eleven' });
    expect(r.verdict).toBe('wrong');
    expect(r.line).not.toMatch(/12/);
  });
  it('empty transcript is unclear without calling the API', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    spy.mockClear();
    const r = await judge({ a: 1, b: 1, op: '+', attempt: 1, transcript: '  ' });
    expect(r.verdict).toBe('unclear');
    expect(spy).not.toHaveBeenCalled();
  });
  it('rejects a bad question', async () => {
    await expect(judge({ a: 99, b: 1, op: '+', transcript: 'x' })).rejects.toThrow();
  });
});

describe('explain', () => {
  it('rejects a lesson with the wrong answer', async () => {
    claudeSays({ title: 't', answer: 13, steps: [{ say: 'hi', visual: { type: 'equation', lines: ['7 + 5 = 13'] } }] });
    await expect(explain({ a: 7, b: 5, op: '+', level: 1 })).rejects.toThrow(/could not draw/);
  });
  it('accepts a correct lesson and stamps the numbers', async () => {
    claudeSays({ title: 't', answer: 12, steps: [{ say: 'hi', visual: { type: 'equation', lines: ['7 + 5 = 12'] } }] });
    const l = await explain({ a: 7, b: 5, op: '+', level: 2 });
    expect(l).toMatchObject({ answer: 12, a: 7, b: 5, op: '+', level: 2, source: 'claude' });
  });
});

describe('cleanStore', () => {
  it('limits and cleans junk', () => {
    const s = cleanStore({ progress: { add: Array.from({ length: 80 }, () => ({ r: 'zzz', a: 999, b: 1 })), sub: 'no' }, lessons: [{ steps: [] }, 5] });
    expect(s.progress.add.length).toBe(40);
    expect(s.progress.add[0]).toMatchObject({ r: 'miss', a: 40, op: '+' });
    expect(s.progress.sub).toEqual([]);
    expect(s.lessons).toEqual([]);
  });
});

describe('.env lines', () => {
  it('reads the value and ignores a note after it', () => {
    expect(parseEnvLine('PORT=3000')).toEqual(['PORT', '3000']);
    expect(parseEnvLine('ELEVENLABS_VOICE_ID=abc123      # pick a specific voice')).toEqual(['ELEVENLABS_VOICE_ID', 'abc123']);
    expect(parseEnvLine('ELEVENLABS_VOICE_ID=     # nothing chosen')).toEqual(['ELEVENLABS_VOICE_ID', '']);
    expect(parseEnvLine('NAME="a # b"')).toEqual(['NAME', 'a # b']);
    expect(parseEnvLine('# PORT=3000')).toBeNull();
  });
});

describe('tts', () => {
  it('pays for a sentence once and reuses the saved clip, even after a restart', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    spy.mockClear();
    const before = await import('../server/eleven.js');
    const [a, b] = await Promise.all([before.tts('Hello there'), before.tts('Hello there')]);
    expect([...a]).toEqual([1, 2, 3]);
    expect(b).toBe(a);
    await before.tts('Hello there');
    vi.resetModules(); // a fresh server: nothing in memory, only the clip on disk
    const after = await import('../server/eleven.js');
    expect([...(await after.tts('Hello there'))]).toEqual([1, 2, 3]);
    expect(spy).toHaveBeenCalledTimes(1);
    await after.tts('Something new');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('http', () => {
  let base;
  beforeAll(async () => { await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port; });
  afterAll(() => server.close());
  it('store round-trips', async () => {
    vi.restoreAllMocks();
    const att = { r: 'first', a: 2, b: 3, op: '+', said: 5, ts: 1 };
    await fetch(base + '/api/store', { method: 'POST', body: JSON.stringify({ progress: { add: [att], sub: [] }, lessons: [] }) });
    const got = await (await fetch(base + '/api/store')).json();
    expect(got.progress.add[0]).toEqual(att);
  });
  it('config hides keys', async () => {
    const j = await (await fetch(base + '/api/config')).json();
    expect(j.hasAnthropic).toBe(true);
    expect(JSON.stringify(j)).not.toMatch(/"k"/);
  });
  it('unknown api path is 404', async () => {
    expect((await fetch(base + '/api/nope')).status).toBe(404);
  });
});

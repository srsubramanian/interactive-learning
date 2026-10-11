// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

// Listening is mocked; each test sets what it does.
let listenImpl: () => Promise<string> = async () => '';
const listenCalls: number[] = [];
vi.mock('../src/audio/listen', () => ({
  listenOnce: vi.fn(async () => { listenCalls.push(Date.now()); return listenImpl(); })
}));

const { usePractice } = await import('../src/hooks/usePractice');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const tick = (ms = 20) => act(() => new Promise((r) => setTimeout(r, ms)));

/** Speaks instantly-ish (30 ms per line); stop() ends the current line like the real Speaker. */
function fakeSpeaker() {
  const said: string[] = [];
  let cur: (() => void) | null = null;
  return {
    said,
    unlock: async () => {},
    stop() { const c = cur; cur = null; c?.(); },
    speak(text: string) {
      this.stop();
      said.push(text);
      return new Promise<void>((res) => { cur = res; setTimeout(() => { if (cur === res) { cur = null; res(); } }, 30); });
    }
  };
}

function mount(media: unknown) {
  const speaker = fakeSpeaker();
  const attempts: unknown[] = [];
  let api: any;
  function H() {
    api = usePractice({
      speaker: speaker as any,
      ensureMedia: async () => media as any,
      primeMedia: () => {},
      sttProvider: 'elevenlabs',
      onAttempt: (a) => attempts.push(a),
      getLevel: () => 1,
      onExplain: () => {},
      active: true
    });
    return null;
  }
  act(() => createRoot(document.createElement('div')).render(createElement(H)));
  return { speaker, attempts, get p() { return api; } };
}

const judgeSaysCorrect = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, init) => {
    const b = JSON.parse(String((init as RequestInit).body));
    const answer = b.a + b.b;
    return new Response(JSON.stringify({ said: answer, verdict: 'correct', line: 'Yes!', answer }));
  });

afterEach(() => { vi.restoreAllMocks(); listenCalls.length = 0; listenImpl = async () => ''; });

describe('practice round', () => {
  it('"Hear it again" during the cheer moves on instead of counting the question twice', async () => {
    judgeSaysCorrect();
    const m = mount(null); // no mic: typed answers only
    act(() => { void m.p.start('add10'); });
    await tick(120);
    const q = m.p.view.q;
    act(() => { m.p.submitTyped(String(q.answer)); });
    await tick(5);
    expect(m.speaker.said.at(-1)).toBe('Yes!');
    act(() => m.p.resume()); // tapped while the cheer plays
    await tick(80);
    expect(m.attempts).toHaveLength(1);
    expect(m.p.view.results).toEqual(['first']);
    expect(m.p.view.idx).toBe(1);
    expect(m.speaker.said.at(-1)).toMatch(/^Question 2\./);
  });

  it('a listening error stops the round on the error panel', async () => {
    listenImpl = async () => { throw new Error('ElevenLabs could not listen (503)'); };
    const m = mount({ stream: { active: true }, ctx: {} });
    act(() => { void m.p.start('add10'); });
    await tick(300);
    expect(m.p.view.phase).toBe('error');
    expect(m.p.view.error).toMatch(/could not listen/);
    expect(listenCalls).toHaveLength(1);
    expect(m.speaker.said.some((s) => /did not hear/.test(s))).toBe(false);
  });

  it('keeps a typed answer that arrives while the question is still being spoken', async () => {
    const m = mount(null);
    act(() => { void m.p.start('add10'); });
    await tick(5); // still saying hello
    let accepted = true;
    act(() => { accepted = m.p.submitTyped('5'); });
    expect(accepted).toBe(false);
  });
});

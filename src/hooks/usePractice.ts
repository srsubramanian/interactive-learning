import { useCallback, useEffect, useRef, useState } from 'react';
import { judgeApi } from '../api';
import { listenOnce, type MediaHandle } from '../audio/listen';
import type { Speaker } from '../audio/speech';
import { makeQuestion, words } from '../lessons/questions';
import type { Attempt, ExplainRequest, Mode, Op, Question, Result } from '../types';

export const TOTAL = 10;
export const MAX_TRIES = 3;

export type Phase = 'idle' | 'running' | 'paused' | 'choice' | 'done' | 'error';
export type Hearing = 'idle' | 'speaking' | 'waiting' | 'hearing' | 'thinking';

export interface PracticeView {
  phase: Phase;
  q: Question | null;
  idx: number;
  tries: number;
  hearing: Hearing;
  heard: string;
  feedback: { kind: 'good' | 'warn' | 'info'; text: string } | null;
  results: Result[];
  error: string | null;
  micOk: boolean;
}

interface Deps {
  speaker: Speaker;
  ensureMedia: () => Promise<MediaHandle | null>;
  sttProvider: 'elevenlabs' | 'browser';
  onAttempt: (a: Attempt) => void;
  getLevel: (op: Op) => number;
  onExplain: (r: ExplainRequest) => void;
  active: boolean;
}

const INITIAL: PracticeView = {
  phase: 'idle', q: null, idx: 0, tries: 1, hearing: 'idle', heard: '', feedback: null, results: [], error: null, micOk: true
};

type Outcome = 'next' | 'again' | 'wait' | 'stop';

export function usePractice(deps: Deps) {
  const d = useRef(deps);
  d.current = deps;
  const [view, setView] = useState<PracticeView>(INITIAL);
  const micRef = useRef<HTMLButtonElement>(null);

  // Mutable state for the running round. The loop reads this instead of React state.
  const core = useRef({
    gen: 0,
    phase: 'idle' as Phase,
    idx: 0,
    attempt: 1,
    unclear: 0,
    q: null as Question | null,
    seen: new Set<string>(),
    results: [] as Result[],
    mode: 'mix20' as Mode,
    media: null as MediaHandle | null,
    lastWrong: null as number | null,
    ctl: null as AbortController | null,
    typedResolve: null as ((s: string) => void) | null,
    tapResolve: null as (() => void) | null
  });

  const patch = useCallback((p: Partial<PracticeView>) => {
    if (p.phase) core.current.phase = p.phase;
    setView((v) => ({ ...v, ...p }));
  }, []);

  const alive = (g: number) => core.current.gen === g;

  const setLevel = (v: number) => micRef.current?.style.setProperty('--lvl', String(v));

  const say = async (text: string, g: number) => {
    if (!alive(g)) return;
    patch({ hearing: 'speaking' });
    await d.current.speaker.speak(text);
  };

  const cancelAll = () => {
    const c = core.current;
    c.gen++;
    c.ctl?.abort();
    c.ctl = null;
    d.current.speaker.stop();
    setLevel(0);
  };

  const fail = (g: number, message: string) => {
    if (!alive(g)) return;
    patch({ phase: 'error', error: message, hearing: 'idle' });
  };

  const record = (r: Result, q: Question, said: number | null) => {
    const c = core.current;
    c.results.push(r);
    d.current.onAttempt({ r, a: q.a, b: q.b, op: q.op, said, ts: Date.now() });
    patch({ results: [...c.results] });
  };

  const runListen = async (g: number, signal: AbortSignal): Promise<string> => {
    const c = core.current;
    if (!c.media || !alive(g)) return '';
    patch({ hearing: 'waiting' });
    try {
      return await listenOnce({
        media: c.media,
        provider: d.current.sttProvider,
        signal,
        onLevel: setLevel,
        onHearing: () => alive(g) && patch({ hearing: 'hearing' })
      });
    } catch (e) {
      if (alive(g)) fail(g, (e as Error).message);
      return '';
    }
  };

  /** Waits for either a spoken or a typed answer. null means the round was cancelled. */
  const getAnswer = async (g: number): Promise<string | null> => {
    const c = core.current;
    const ctl = new AbortController();
    c.ctl = ctl;
    const typed = new Promise<string>((res) => { c.typedResolve = res; });
    let spoken: Promise<string>;
    if (!c.media) {
      patch({ hearing: 'idle' });
      spoken = new Promise<string>(() => {});
    } else if (c.unclear >= 2) {
      // Hearing has failed twice: wait for a tap on the mic so noise does not keep triggering.
      patch({ hearing: 'idle' });
      spoken = new Promise<void>((res) => { c.tapResolve = res; }).then(() => runListen(g, ctl.signal));
    } else {
      spoken = runListen(g, ctl.signal);
    }
    const text = await Promise.race([typed, spoken]);
    ctl.abort();
    c.typedResolve = null;
    c.tapResolve = null;
    setLevel(0);
    return alive(g) ? text : null;
  };

  const attemptOnce = async (g: number): Promise<Outcome> => {
    const c = core.current;
    const q = c.q!;
    const text = await getAnswer(g);
    if (text === null || !alive(g)) return 'stop';
    patch({ heard: text.trim() });
    if (!text.trim()) {
      c.unclear++;
      await say(c.unclear >= 2 ? 'I could not hear you. Tap the microphone, or type your answer.' : 'I did not hear you. Please say your answer.', g);
      return alive(g) ? 'again' : 'stop';
    }
    patch({ hearing: 'thinking', feedback: null });
    let r;
    try {
      r = await judgeApi({ a: q.a, b: q.b, op: q.op, attempt: c.attempt, transcript: text });
    } catch (e) {
      fail(g, (e as Error).message);
      return 'stop';
    }
    if (!alive(g)) return 'stop';

    if (r.verdict === 'unclear') {
      c.unclear++;
      patch({ feedback: { kind: 'info', text: r.line } });
      await say(r.line, g);
      return alive(g) ? 'again' : 'stop';
    }
    c.unclear = 0;
    if (r.verdict === 'correct') {
      record(c.attempt === 1 ? 'first' : 'retry', q, r.said);
      patch({ feedback: { kind: 'good', text: r.line } });
      await say(r.line, g);
      return alive(g) ? 'next' : 'stop';
    }
    c.lastWrong = r.said;
    if (c.attempt < MAX_TRIES) {
      c.attempt++;
      patch({ tries: c.attempt, feedback: { kind: 'warn', text: r.line } });
      await say(r.line, g);
      return alive(g) ? 'again' : 'stop';
    }
    record('miss', q, r.said);
    patch({ phase: 'choice', hearing: 'idle', feedback: { kind: 'warn', text: r.line } });
    await say(r.line, g);
    return 'wait';
  };

  const finish = async (g: number) => {
    const c = core.current;
    const firsts = c.results.filter((x) => x === 'first').length;
    patch({ phase: 'done', hearing: 'idle', q: null });
    const line = firsts >= 8 ? `Wow! You got ${firsts} right on the first try. You are a math star!` : `Great job, you finished all ${TOTAL} questions! You got ${firsts} right on the first try.`;
    try { await say(line, g); } catch { /* ignore */ }
  };

  const loop = async (g: number, resume: boolean) => {
    const c = core.current;
    try {
      while (alive(g) && c.idx < TOTAL) {
        if (!resume || !c.q) {
          c.q = makeQuestion(c.mode, c.seen);
          c.attempt = 1;
          c.unclear = 0;
          c.lastWrong = null;
        }
        const q = c.q;
        patch({ phase: 'running', q, idx: c.idx, tries: c.attempt, heard: '', feedback: null, error: null });
        // Two clips, so the saved "What is 7 plus 5?" is reused whatever number the question has.
        await say(resume ? 'Let us try this one.' : `Question ${c.idx + 1}.`, g);
        await say(`What is ${words(q)}?`, g);
        resume = false;
        for (;;) {
          if (!alive(g)) return;
          const out = await attemptOnce(g);
          if (out === 'next') break;
          if (out === 'again') continue;
          return;
        }
        if (!alive(g)) return;
        c.idx++;
      }
      if (alive(g)) await finish(g);
    } catch (e) {
      fail(g, (e as Error).message);
    }
  };

  const start = useCallback(async (mode: Mode) => {
    const c = core.current;
    cancelAll();
    await d.current.speaker.unlock();
    c.media = await d.current.ensureMedia();
    Object.assign(c, { idx: 0, attempt: 1, unclear: 0, q: null, seen: new Set<string>(), results: [], mode, lastWrong: null });
    setView({ ...INITIAL, micOk: !!c.media, phase: 'running' });
    core.current.phase = 'running';
    const g = ++c.gen;
    try { await say('Hi! I am your math buddy. Let us play!', g); } catch (e) { return fail(g, (e as Error).message); }
    if (alive(g)) await loop(g, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    cancelAll();
    patch({ phase: 'idle', hearing: 'idle', q: null, feedback: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ask the current question again (also used to resume after a pause or an error). */
  const resume = useCallback(() => {
    const c = core.current;
    cancelAll();
    if (!c.q) return;
    patch({ error: null });
    void loop(++c.gen, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = useCallback(() => {
    const c = core.current;
    cancelAll();
    c.idx++;
    c.q = null;
    void loop(++c.gen, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showWhy = useCallback(() => {
    const c = core.current;
    if (!c.q) return;
    d.current.speaker.stop();
    d.current.onExplain({ a: c.q.a, b: c.q.b, op: c.q.op, said: c.lastWrong, level: Math.min(d.current.getLevel(c.q.op), 3) });
  }, []);

  const submitTyped = useCallback((s: string) => core.current.typedResolve?.(s), []);
  const tapMic = useCallback(() => core.current.tapResolve?.(), []);

  // Leaving the Practice tab pauses the round.
  useEffect(() => {
    if (deps.active) return;
    const c = core.current;
    if (c.phase === 'running') {
      cancelAll();
      patch({ phase: 'paused', hearing: 'idle' });
    } else if (c.phase === 'choice') {
      d.current.speaker.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.active]);

  useEffect(() => () => { cancelAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { view, micRef, start, stop, resume, next, showWhy, submitTyped, tapMic };
}

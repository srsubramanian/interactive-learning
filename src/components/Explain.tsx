import { useEffect, useRef, useState } from 'react';
import { explainApi } from '../api';
import type { Speaker } from '../audio/speech';
import { buildLesson } from '../lessons/builders';
import type { ExplainRequest, Lesson, Op, Store } from '../types';
import { LessonPlayer } from './LessonPlayer';

interface Props {
  speaker: Speaker;
  store: Store;
  request: ExplainRequest | null;
  hasAnthropic: boolean;
  skill: (op: Op) => { n: number; score: number; level: number };
  addLesson: (l: Lesson) => void;
  removeLesson: (id: string) => void;
}

export function Explain({ speaker, store, request, hasAnthropic, skill, addLesson, removeLesson }: Props) {
  const [a, setA] = useState('7');
  const [b, setB] = useState('5');
  const [op, setOp] = useState<Op>('+');
  const [level, setLevel] = useState(1);
  const [topic, setTopic] = useState('');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [said, setSaid] = useState<number | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const nums = () => (a.trim() === '' || b.trim() === '' ? null : { a: Number(a), b: Number(b) });

  const showBuiltIn = (n: { a: number; b: number }, o: Op, lv: number, autoPlay: boolean) => {
    setErr('');
    try {
      setAuto(autoPlay);
      setLesson(buildLesson(n.a, o, n.b, lv));
      setLevel(lv);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const askClaude = async (lv: number, autoPlay = true) => {
    const n = nums();
    if (!n && !topic.trim()) { setErr('Type two numbers, or a topic to explain.'); return; }
    setBusy(true);
    setErr('');
    try {
      const l = await explainApi({
        ...(n ? { a: n.a, b: n.b, op } : {}),
        level: lv,
        topic: topic.trim() || undefined,
        profile: { adding: skill('+'), takingAway: skill('-'), saidWrong: said }
      });
      setAuto(autoPlay);
      setLesson(l);
      setLevel(lv);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Coming from "Show me why" in Practice.
  useEffect(() => {
    if (!request) return;
    setA(String(request.a));
    setB(String(request.b));
    setOp(request.op);
    setSaid(request.said);
    showBuiltIn({ a: request.a, b: request.b }, request.op, request.level, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // The picture sits above the number picker, so bring it into view when it changes.
  useEffect(() => {
    if (lesson) playerRef.current?.scrollIntoView({ block: 'start' });
  }, [lesson]);

  const change = (delta: number) => {
    const lv = Math.min(4, Math.max(1, level + delta));
    const n = lesson && lesson.a != null && lesson.b != null && lesson.op ? { a: lesson.a, b: lesson.b } : nums();
    if (lesson?.source === 'claude') void askClaude(lv);
    else if (n) showBuiltIn(n, lesson?.op || op, lv, true);
  };

  const saved = lesson?.id ? store.lessons.some((l) => l.id === lesson.id) : false;
  const sk = { '+': skill('+'), '-': skill('-') };

  return (
    <div className="explain">
      {lesson && (
        <div ref={playerRef}>
          <LessonPlayer lesson={lesson} speaker={speaker} autoPlay={auto} busy={busy} onSimpler={() => change(-1)} onDeeper={() => change(1)} />
        </div>
      )}

      <section className="card">
        {!lesson && <h2>Show me a picture</h2>}
        <div className="row picker">
          <input className="num" value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" aria-label="First number" />
          <select value={op} onChange={(e) => setOp(e.target.value as Op)} aria-label="Plus or minus">
            <option value="+">+</option>
            <option value="-">−</option>
          </select>
          <input className="num" value={b} onChange={(e) => setB(e.target.value)} inputMode="numeric" aria-label="Second number" />
          <button className="btn primary" onClick={() => { const n = nums(); if (!n) setErr('Type two numbers.'); else showBuiltIn(n, op, level, true); }}>▶ Show it</button>
        </div>
        {err && <p className="err">{err}</p>}

        {/* Grown-up settings stay folded away so the picture is the only thing to look at. */}
        <details className="more">
          <summary>More options</summary>
          <div className="more-body">
            <label className="field">
              <span>How deep?</span>
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                <option value={1}>1 · {op === '+' ? 'Count them all' : 'Count what is left'}</option>
                <option value={2}>2 · {op === '+' ? 'Count on' : 'Count back'}</option>
                <option value={3}>3 · {op === '+' ? 'Make ten' : 'Go through ten'}</option>
                <option value={4}>4 · {op === '+' ? 'Number families' : 'Think addition'}</option>
              </select>
            </label>
            <p className="hint">Her level so far: adding {sk['+'].level}, taking away {sk['-'].level}{sk['+'].n + sk['-'].n < 3 ? ' (just starting)' : ''}.</p>
            <label className="field">
              <span>A question for Claude (optional)</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Why does 9 + 6 feel hard?" maxLength={200} />
            </label>
            <div className="controls">
              <button className="btn" onClick={() => void askClaude(level)} disabled={busy || !hasAnthropic}>{busy ? 'Drawing…' : '✨ Ask Claude to draw one'}</button>
              {lesson?.source === 'claude' && (saved ? (
                <button className="btn ghost" onClick={() => removeLesson(lesson.id!)}>Remove from saved</button>
              ) : (
                <button className="btn" onClick={() => { const l = { ...lesson, id: String(Date.now()) }; addLesson(l); setLesson(l); }}>💾 Save this lesson</button>
              ))}
            </div>
            {store.lessons.length > 0 && (
              <>
                <h3>Saved lessons</h3>
                <ul className="saved">
                  {store.lessons.map((l) => (
                    <li key={l.id}>
                      <button className="link" onClick={() => { setAuto(false); setLesson(l); setLevel(l.level); }}>{l.title}</button>
                      <button className="x" aria-label={`Delete ${l.title}`} onClick={() => removeLesson(l.id!)}>✕</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

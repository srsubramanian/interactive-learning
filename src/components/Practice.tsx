import { useState } from 'react';
import { MODES } from '../lessons/questions';
import type { Mode } from '../types';
import { TOTAL, type usePractice } from '../hooks/usePractice';

type P = ReturnType<typeof usePractice>;

const HEARING_TEXT: Record<string, string> = {
  idle: 'Tap the microphone and say your answer.',
  speaking: 'Listen…',
  waiting: 'Your turn! Say the answer.',
  hearing: 'I hear you…',
  thinking: 'Thinking…'
};

export function Practice({ p, mode, setMode, keysOk }: { p: P; mode: Mode; setMode: (m: Mode) => void; keysOk: boolean }) {
  const v = p.view;
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);

  if (v.phase === 'idle') {
    return (
      <section className="card start">
        <div className="big-emoji" aria-hidden>🎤</div>
        <h2>Ready to play?</h2>
        <label className="field">
          <span>What shall we practice?</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <button className="btn primary huge" onClick={() => void p.start(mode)} disabled={!keysOk}>Let us go!</button>
        {!keysOk && <p className="err">Add your ElevenLabs and Anthropic keys to the .env file and restart the app.</p>}
      </section>
    );
  }

  if (v.phase === 'done') {
    const firsts = v.results.filter((r) => r === 'first').length;
    return (
      <section className="card start">
        <div className="big-emoji" aria-hidden>🌟</div>
        <h2>All done!</h2>
        <p>{firsts} of {TOTAL} right on the first try.</p>
        <div className="stars" aria-hidden>{v.results.map((r, i) => <span key={i} className={'star ' + r}>★</span>)}</div>
        <button className="btn primary huge" onClick={() => void p.start(mode)}>Play again</button>
        <button className="btn ghost" onClick={p.stop}>Back to start</button>
      </section>
    );
  }

  const q = v.q;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    p.submitTyped(typed.trim());
    setTyped('');
  };
  // After two unclear tries the microphone waits for a tap, so that instruction must show.
  const needTap = v.phase === 'running' && v.micOk && v.hearing === 'idle';
  const showType = typing || !v.micOk;

  return (
    <section className="card quiz">
      <div className="progress" aria-label={`Question ${v.idx + 1} of ${TOTAL}`}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={'pip ' + (v.results[i] ? v.results[i] : i === v.idx ? 'now' : '')} />
        ))}
      </div>

      {q && (
        <div className="question" aria-live="polite">
          <span>{q.a}</span> <span className="opsym">{q.op === '+' ? '+' : '−'}</span> <span>{q.b}</span> <span className="opsym">=</span> <span className="qmark">?</span>
        </div>
      )}

      {v.phase === 'running' && (
        <button
          ref={p.micRef}
          className={'mic ' + v.hearing}
          onClick={p.tapMic}
          aria-label="Microphone"
          disabled={!v.micOk}
        >
          <span className="ring" />
          <span className="icon">🎤</span>
        </button>
      )}

      {/* One line at a time: her feedback, or what the microphone is doing. */}
      <div className="msg">
        {v.feedback && !needTap ? (
          <p className={'feedback ' + v.feedback.kind}>{v.feedback.text}</p>
        ) : (
          v.phase === 'running' && <p className="status">{v.micOk ? HEARING_TEXT[v.hearing] : 'The microphone is off. Type the answer.'}</p>
        )}
        {v.heard && v.feedback && v.feedback.kind !== 'good' && <p className="heard">I heard “{v.heard}”</p>}
      </div>

      {v.phase === 'paused' && <button className="btn primary huge" onClick={p.resume}>Keep going</button>}

      {v.phase === 'choice' && (
        <div className="stack">
          <button className="btn primary huge" onClick={p.showWhy}>🔍 Show me why</button>
          <button className="btn" onClick={p.next}>Next question ▶</button>
        </div>
      )}

      {v.phase === 'error' && (
        <div className="stack">
          <p className="err">{v.error}</p>
          {q && <button className="btn primary" onClick={p.resume}>Try again</button>}
          <button className="btn ghost" onClick={p.stop}>Back to start</button>
        </div>
      )}

      {v.phase === 'running' && (
        <>
          <div className="quiet-row">
            <button className="quiet" onClick={p.resume}>🔁 Say it again</button>
            {v.micOk && <button className="quiet" aria-expanded={showType} onClick={() => setTyping((t) => !t)}>⌨️ Type</button>}
            <button className="quiet" onClick={p.stop}>Stop</button>
          </div>
          {showType && (
            <form className="typed" onSubmit={submit}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" placeholder="Type the number" aria-label="Type the answer" />
              <button className="btn" type="submit">Check</button>
            </form>
          )}
        </>
      )}
    </section>
  );
}

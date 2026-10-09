import { useEffect, useRef, useState } from 'react';
import type { Speaker } from '../audio/speech';
import type { Lesson } from '../types';
import { Visual } from './Visuals';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Props {
  lesson: Lesson;
  speaker: Speaker;
  autoPlay?: boolean;
  onSimpler?: () => void;
  onDeeper?: () => void;
  busy?: boolean;
}

export function LessonPlayer({ lesson, speaker, autoPlay, onSimpler, onDeeper, busy }: Props) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState('');
  const tok = useRef(0);

  const halt = () => { tok.current++; speaker.stop(); setPlaying(false); };

  const play = async (from: number) => {
    const my = ++tok.current;
    setErr('');
    setPlaying(true);
    await speaker.unlock();
    for (let k = from; k < lesson.steps.length; k++) {
      if (tok.current !== my) return;
      setI(k);
      try { await speaker.speak(lesson.steps[k].say); } catch (e) { setErr((e as Error).message); break; }
      if (tok.current !== my) return;
      await sleep(450);
    }
    if (tok.current === my) setPlaying(false);
  };

  useEffect(() => {
    setI(0);
    setErr('');
    if (autoPlay) void play(0);
    return () => { tok.current++; speaker.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  const go = (k: number) => { halt(); setI(Math.max(0, Math.min(lesson.steps.length - 1, k))); };
  const step = lesson.steps[i];
  const last = i === lesson.steps.length - 1;

  return (
    <div className="player card">
      <div className="player-head">
        <h3>{lesson.title}</h3>
        <span className={'tag ' + lesson.source}>{lesson.source === 'claude' ? 'Drawn by Claude' : 'Built-in'}</span>
      </div>
      <div className="stage" aria-live="polite">
        <Visual v={step.visual} />
      </div>
      <p className="say">{step.say}</p>
      {err && <p className="err">{err} You can still use the arrows to read each step.</p>}
      <div className="dotsnav" aria-hidden>
        {lesson.steps.map((_, k) => (
          <span key={k} className={'pip' + (k === i ? ' on' : '')} />
        ))}
      </div>
      <div className="controls">
        <button className="btn ghost" onClick={() => go(i - 1)} disabled={i === 0}>◀ Back</button>
        {playing ? (
          <button className="btn" onClick={halt}>⏸ Pause</button>
        ) : (
          <button className="btn primary" onClick={() => void play(last ? 0 : i)}>{last ? '↺ Again' : '▶ Play'}</button>
        )}
        <button className="btn ghost" onClick={() => go(i + 1)} disabled={last}>Next ▶</button>
      </div>
      {(onSimpler || onDeeper) && (
        <div className="controls depth">
          {onSimpler && <button className="btn ghost" onClick={() => { halt(); onSimpler(); }} disabled={busy || lesson.level <= 1}>🌱 Make it simpler</button>}
          {onDeeper && <button className="btn ghost" onClick={() => { halt(); onDeeper(); }} disabled={busy || lesson.level >= 4}>🚀 Go deeper</button>}
        </div>
      )}
    </div>
  );
}

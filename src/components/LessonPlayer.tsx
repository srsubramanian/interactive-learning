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
        {lesson.source === 'claude' && <span className="tag claude">Drawn by Claude</span>}
      </div>
      <div className="stage" aria-live="polite">
        <Visual v={step.visual} />
      </div>
      <p className="say">{step.say}</p>
      {err && <p className="err">{err} You can still use the arrows to read each step.</p>}
      <div className="transport">
        <button className="round" aria-label="Back" onClick={() => go(i - 1)} disabled={i === 0}>←</button>
        {playing ? (
          <button className="btn" onClick={halt}>⏸ Pause</button>
        ) : (
          <button className="btn primary" onClick={() => void play(last ? 0 : i)}>{last ? '↺ Again' : '▶ Play'}</button>
        )}
        <button className="round" aria-label="Next" onClick={() => go(i + 1)} disabled={last}>→</button>
      </div>
      <div className="dotsnav" aria-hidden>
        {lesson.steps.map((_, k) => (
          <span key={k} className={'pip' + (k === i ? ' on' : '')} />
        ))}
      </div>
      {(onSimpler || onDeeper) && (
        <div className="quiet-row">
          {onSimpler && <button className="quiet" onClick={() => { halt(); onSimpler(); }} disabled={busy || lesson.level <= 1}>🌱 Simpler</button>}
          {onDeeper && <button className="quiet" onClick={() => { halt(); onDeeper(); }} disabled={busy || lesson.level >= 4}>🚀 Deeper</button>}
        </div>
      )}
    </div>
  );
}

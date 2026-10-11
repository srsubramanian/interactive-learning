import { useCallback, useRef } from 'react';
import type { MediaHandle } from '../audio/listen';

/** Opens the microphone once (call it from a tap). Returns null if she or the browser says no. */
export function useMedia() {
  const ref = useRef<MediaHandle | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  /** Call first thing in a tap handler, before any await: iOS only lets audio start inside the tap. */
  const prime = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioContext();
    if (ctxRef.current.state !== 'running') ctxRef.current.resume().catch(() => { /* ignore */ });
  }, []);

  const ensure = useCallback(async (): Promise<MediaHandle | null> => {
    if (ref.current && ref.current.stream.active) return ref.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioContext();
      ref.current = { stream, ctx: ctxRef.current };
      return ref.current;
    } catch {
      return null;
    }
  }, []);
  return { ensure, prime };
}

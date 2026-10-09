import { useCallback, useRef } from 'react';
import type { MediaHandle } from '../audio/listen';

/** Opens the microphone once (call it from a tap). Returns null if she or the browser says no. */
export function useMedia() {
  const ref = useRef<MediaHandle | null>(null);
  const ensure = useCallback(async (): Promise<MediaHandle | null> => {
    if (ref.current && ref.current.stream.active) return ref.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      ref.current = { stream, ctx };
      return ref.current;
    } catch {
      return null;
    }
  }, []);
  return { ensure };
}

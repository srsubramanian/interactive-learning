import { fetchTts } from '../api';

// A tiny silent sound. Playing it during the first tap lets the browser allow sound later.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export class Speaker {
  private audio = new Audio();
  private cache = new Map<string, string>();
  private cancelCur: (() => void) | null = null;
  private token = 0;

  async unlock() {
    try { this.audio.src = SILENT; await this.audio.play(); } catch { /* ignore */ }
  }

  stop() {
    this.token++;
    this.audio.pause();
    const c = this.cancelCur;
    this.cancelCur = null;
    if (c) c();
  }

  /** Speaks the text with ElevenLabs. Resolves when finished, or when stop() is called. */
  async speak(text: string): Promise<void> {
    this.stop();
    const my = this.token;
    let url = this.cache.get(text);
    if (!url) {
      const blob = await fetchTts(text);
      if (my !== this.token) return;
      url = URL.createObjectURL(blob);
      this.cache.set(text, url);
      if (this.cache.size > 120) {
        const first = this.cache.keys().next().value as string;
        URL.revokeObjectURL(this.cache.get(first)!);
        this.cache.delete(first);
      }
    }
    if (my !== this.token) return;
    const a = this.audio;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        a.removeEventListener('ended', done);
        a.removeEventListener('error', fail);
        this.cancelCur = null;
      };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('The sound could not play.')); };
      a.addEventListener('ended', done);
      a.addEventListener('error', fail);
      this.cancelCur = done;
      a.src = url!;
      a.play().catch(fail);
    });
  }
}

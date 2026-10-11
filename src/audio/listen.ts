import { sttApi } from '../api';

export interface MediaHandle { stream: MediaStream; ctx: AudioContext }
export interface ListenOpts {
  media: MediaHandle;
  provider: 'elevenlabs' | 'browser';
  signal: AbortSignal;
  onLevel: (v: number) => void;
  onHearing: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickMime(): string {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/** Listens until she stops talking. Returns what was heard ('' if nothing). */
export async function listenOnce(o: ListenOpts): Promise<string> {
  return o.provider === 'browser' ? listenBrowser(o) : listenEleven(o);
}

// Voice detection. The first moment sets the room's noise floor; a loud start is her answering
// early, not noise, and the floor is capped so a noisy start cannot make her too quiet to hear.
const LOUD = 0.08, FLOOR_MAX = 0.03, CALIBRATE_MS = 350, SILENCE_MS = 1300;

async function listenEleven(o: ListenOpts): Promise<string> {
  const { stream, ctx } = o.media;
  // iOS may refuse to resume outside a tap; do not wait forever for it.
  if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), sleep(500)]);
  const vad = ctx.state === 'running';
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  // Some Safari versions only process nodes that lead to the speakers; a muted gain keeps it silent.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(an);
  an.connect(mute);
  mute.connect(ctx.destination);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(250);

  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let floorSum = 0, floorN = 0, floor = 0.01;
  let spoke = false, lastVoice = 0;
  const heard = (now: number) => {
    if (!spoke) { spoke = true; o.onHearing(); }
    lastVoice = now;
  };
  if (!vad) {
    // No level meter (audio stayed paused): record a fixed window and let the recognizer decide.
    heard(t0);
    for (let t = 0; t < 5000 && !o.signal.aborted; t += 100) await sleep(100);
  }
  for (; vad;) {
    if (o.signal.aborted) break;
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    o.onLevel(Math.min(1, rms * 8));
    const now = performance.now();
    const t = now - t0;
    if (t < CALIBRATE_MS) {
      if (rms > LOUD) heard(now);
      else { floorSum += rms; floorN++; floor = Math.min(FLOOR_MAX, floorSum / floorN); }
    } else {
      if (rms > Math.max(0.03, floor * 3)) heard(now);
      if (spoke && now - lastVoice > SILENCE_MS) break;
      if (!spoke && t > 8000) break;
      if (t > 14000) break;
    }
    await sleep(50);
  }
  o.onLevel(0);
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  try { rec.stop(); } catch { /* ignore */ }
  await stopped;
  src.disconnect();
  mute.disconnect();
  if (o.signal.aborted || !spoke) return '';
  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
  const { text } = await sttApi(blob);
  return text;
}

const BROKEN: Record<string, string> = {
  'not-allowed': 'The browser is not allowed to listen. Allow the microphone for this page, then try again.',
  'service-not-allowed': 'The browser is not allowed to listen. Allow the microphone for this page, then try again.',
  'audio-capture': 'No microphone was found.',
  network: 'The browser could not reach its listening service. Use Chrome with internet, or set STT_PROVIDER=elevenlabs.'
};

function listenBrowser(o: ListenOpts): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error('This browser cannot listen. Use Chrome, or set STT_PROVIDER=elevenlabs.'));
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let done = false;
    const finish = (t: string) => { if (!done) { done = true; resolve(t); } };
    r.onspeechstart = () => o.onHearing();
    r.onresult = (e: any) => finish(String(e.results[0][0].transcript || ''));
    // Staying quiet is not a failure. A blocked or unreachable recognizer is, and must not sound like "I did not hear you".
    r.onerror = (e: any) => {
      const why = BROKEN[String(e.error)];
      if (why && !done) { done = true; reject(new Error(why)); } else finish('');
    };
    r.onend = () => finish('');
    o.signal.addEventListener('abort', () => { try { r.abort(); } catch { /* ignore */ } finish(''); });
    setTimeout(() => { try { r.stop(); } catch { /* ignore */ } }, 10000);
    try { r.start(); } catch { finish(''); }
  });
}

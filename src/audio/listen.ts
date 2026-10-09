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

async function listenEleven(o: ListenOpts): Promise<string> {
  const { stream, ctx } = o.media;
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(250);

  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let floorSum = 0, floorN = 0, floor = 0.01;
  let spoke = false, lastVoice = 0;
  for (;;) {
    if (o.signal.aborted) break;
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    o.onLevel(Math.min(1, rms * 8));
    const now = performance.now();
    const t = now - t0;
    if (t < 350) {
      floorSum += rms; floorN++; floor = floorSum / floorN;
    } else {
      if (rms > Math.max(0.03, floor * 3)) {
        if (!spoke) { spoke = true; o.onHearing(); }
        lastVoice = now;
      }
      if (spoke && now - lastVoice > 1300) break;
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

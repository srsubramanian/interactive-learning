import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let voiceId = config.voiceId;

export async function resolveVoice() {
  if (voiceId) return voiceId;
  const r = await fetch(config.elevenBase + '/v1/voices', { headers: { 'xi-api-key': config.elevenKey } });
  if (!r.ok) throw new Error('Could not list ElevenLabs voices (' + r.status + '). Check ELEVENLABS_API_KEY, or set ELEVENLABS_VOICE_ID in .env.');
  const voices = (await r.json()).voices || [];
  const prefer = ['sarah', 'alice', 'matilda', 'jessica', 'laura', 'lily'];
  const byName = prefer.map((n) => voices.find((v) => (v.name || '').toLowerCase().startsWith(n))).find(Boolean);
  const pick = byName || voices.find((v) => v.category === 'premade') || voices[0];
  if (!pick) throw new Error('No voices found in your ElevenLabs account. Set ELEVENLABS_VOICE_ID in .env.');
  voiceId = pick.voice_id;
  console.log('Using ElevenLabs voice:', pick.name, '(' + pick.voice_id + ')');
  return voiceId;
}

// Speech is paid for per character, so every sentence is generated once and the clip is kept:
// in memory while the server runs, and on disk (data/tts) so it is still there after a restart.
const TTS_DIR = path.join(config.dataDir, 'tts');
const FORMAT = 'mp3_44100_64';
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75 };
const MAX_CLIPS = 3000; // about 40 MB; the clips not used for the longest time go first
const ttsCache = new Map();
const pending = new Map();

// A clip is only reused for the same words in the same voice with the same settings.
const clipFile = (vid, text) =>
  path.join(TTS_DIR, crypto.createHash('sha256').update(JSON.stringify([vid, config.ttsModel, FORMAT, VOICE_SETTINGS, text])).digest('hex') + '.mp3');

function readClip(file) {
  try {
    const buf = fs.readFileSync(file);
    const now = new Date();
    fs.utimesSync(file, now, now); // mark as just used
    return buf;
  } catch {
    return null;
  }
}

function saveClip(file, buf) {
  try {
    fs.mkdirSync(TTS_DIR, { recursive: true });
    fs.writeFileSync(file + '.tmp', buf);
    fs.renameSync(file + '.tmp', file);
    const clips = fs.readdirSync(TTS_DIR).filter((f) => f.endsWith('.mp3'));
    if (clips.length <= MAX_CLIPS) return;
    clips
      .map((f) => ({ f, t: fs.statSync(path.join(TTS_DIR, f)).mtimeMs }))
      .sort((x, y) => x.t - y.t)
      .slice(0, clips.length - Math.floor(MAX_CLIPS * 0.9))
      .forEach((c) => fs.rmSync(path.join(TTS_DIR, c.f), { force: true }));
  } catch (e) {
    console.error('Could not keep a speech clip:', e.message); // it still plays this time
  }
}

async function makeClip(text) {
  const vid = await resolveVoice();
  const file = clipFile(vid, text);
  let buf = readClip(file);
  if (!buf) {
    const r = await fetch(config.elevenBase + '/v1/text-to-speech/' + encodeURIComponent(vid) + '?output_format=' + FORMAT, {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: config.ttsModel, voice_settings: VOICE_SETTINGS })
    });
    if (!r.ok) throw new Error('ElevenLabs could not speak (' + r.status + '): ' + (await r.text()).slice(0, 160));
    buf = Buffer.from(await r.arrayBuffer());
    saveClip(file, buf);
  }
  if (ttsCache.size > 400) ttsCache.delete(ttsCache.keys().next().value);
  ttsCache.set(text, buf);
  return buf;
}

export async function tts(text) {
  text = String(text || '').trim().slice(0, 500);
  if (!text) throw new Error('Nothing to say.');
  if (ttsCache.has(text)) return ttsCache.get(text);
  // Two requests for the same new sentence share one ElevenLabs call.
  if (!pending.has(text)) pending.set(text, makeClip(text).finally(() => pending.delete(text)));
  return pending.get(text);
}

export async function stt(buf, mime) {
  const type = String(mime || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), 'answer.' + ext);
  form.append('model_id', config.sttModel);
  form.append('language_code', 'en');
  const r = await fetch(config.elevenBase + '/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': config.elevenKey }, body: form });
  if (!r.ok) throw new Error('ElevenLabs could not listen (' + r.status + '): ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  return String(j.text || '').trim();
}

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

const ttsCache = new Map();

export async function tts(text) {
  text = String(text || '').trim().slice(0, 500);
  if (!text) throw new Error('Nothing to say.');
  if (ttsCache.has(text)) return ttsCache.get(text);
  const vid = await resolveVoice();
  const r = await fetch(config.elevenBase + '/v1/text-to-speech/' + encodeURIComponent(vid) + '?output_format=mp3_44100_64', {
    method: 'POST',
    headers: { 'xi-api-key': config.elevenKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: config.ttsModel, voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
  });
  if (!r.ok) throw new Error('ElevenLabs could not speak (' + r.status + '): ' + (await r.text()).slice(0, 160));
  const buf = Buffer.from(await r.arrayBuffer());
  if (ttsCache.size > 400) ttsCache.delete(ttsCache.keys().next().value);
  ttsCache.set(text, buf);
  return buf;
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

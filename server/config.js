import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tiny .env loader (KEY=value lines), so no extra package is needed.
// "KEY=value   # note" keeps only "value"; quote the value if it really contains " #".
export function parseEnvLine(line) {
  if (line.trim().startsWith('#')) return null;
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) return null;
  let v = m[2];
  const q = v.match(/^(["'])(.*)\1(\s+#.*)?$/);
  if (q) v = q[2];
  else v = v.replace(/(^|\s+)#.*$/, '').trim();
  return [m[1], v];
}
try {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const kv = parseEnvLine(line);
      if (kv && process.env[kv[0]] === undefined) process.env[kv[0]] = kv[1];
    }
  }
} catch {
  /* ignore */
}

const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  elevenKey: env.ELEVENLABS_API_KEY || '',
  claudeModel: env.CLAUDE_MODEL || 'claude-haiku-5-5',
  // Custom picture lessons. Defaults to the same model; set EXPLAIN_MODEL=claude-sonnet-5-5 for richer lessons.
  explainModel: env.EXPLAIN_MODEL || env.CLAUDE_MODEL || 'claude-haiku-5-5',
  ttsModel: env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5',
  sttModel: env.ELEVENLABS_STT_MODEL || 'scribe_v1',
  sttProvider: (env.STT_PROVIDER || 'elevenlabs').toLowerCase(), // "elevenlabs" or "browser"
  anthropicUrl: env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
  elevenBase: env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io',
  voiceId: env.ELEVENLABS_VOICE_ID || ''
};

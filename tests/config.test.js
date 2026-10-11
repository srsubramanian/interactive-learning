import { describe, it, expect } from 'vitest';
import { parseEnvLine } from '../server/config.js';

describe('.env lines', () => {
  it('drops trailing comments so an uncommented example line still works', () => {
    expect(parseEnvLine('ELEVENLABS_VOICE_ID=abc123   # pick a specific voice')).toEqual(['ELEVENLABS_VOICE_ID', 'abc123']);
    expect(parseEnvLine('ELEVENLABS_VOICE_ID=                 # pick a voice')).toEqual(['ELEVENLABS_VOICE_ID', '']);
    expect(parseEnvLine('STT_PROVIDER=browser # or elevenlabs')).toEqual(['STT_PROVIDER', 'browser']);
  });
  it('keeps quoted values and # inside a value', () => {
    expect(parseEnvLine('A="x # y"  # note')).toEqual(['A', 'x # y']);
    expect(parseEnvLine("B='q'")).toEqual(['B', 'q']);
    expect(parseEnvLine('C=sk-ant#1')).toEqual(['C', 'sk-ant#1']);
  });
  it('skips comments and junk', () => {
    expect(parseEnvLine('# CLAUDE_MODEL=x')).toBeNull();
    expect(parseEnvLine('hello')).toBeNull();
  });
});

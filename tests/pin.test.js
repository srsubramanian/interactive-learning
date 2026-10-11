import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jm-pin-'));
process.env.APP_PIN = '482915';

const { server, hostAllowed } = await import('../server/index.js');

let base;
beforeAll(async () => { await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port; });
afterAll(() => server.close());

const json = { 'content-type': 'application/json' };
const sendPin = (pin) => fetch(base + '/api/pin', { method: 'POST', headers: json, body: JSON.stringify({ pin }) });

describe('PIN gate', () => {
  it('asks for the PIN before any API use', async () => {
    const cfg = await (await fetch(base + '/api/config')).json();
    expect(cfg).toMatchObject({ needPin: true, pinOk: false });
    expect((await fetch(base + '/api/store')).status).toBe(401);
    expect((await fetch(base + '/api/tts', { method: 'POST', headers: json, body: '{"text":"hi"}' })).status).toBe(401);
  });

  it('the right PIN gives a cookie that opens the API', async () => {
    const r = await sendPin('482915');
    expect(r.status).toBe(200);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    expect(cookie).toMatch(/^jm_pin=[a-f0-9]{64}$/);
    expect(cookie).not.toContain('482915');
    expect((await fetch(base + '/api/store', { headers: { cookie } })).status).toBe(200);
    expect(await (await fetch(base + '/api/config', { headers: { cookie } })).json()).toMatchObject({ pinOk: true });
    expect((await fetch(base + '/api/store', { headers: { cookie: 'jm_pin=' + 'a'.repeat(64) } })).status).toBe(401);
  });

  it('locks a device out after five wrong tries', async () => {
    for (let i = 0; i < 5; i++) expect((await sendPin('000000')).status).toBe(401);
    expect((await sendPin('482915')).status).toBe(429);
  });
});

describe('home network addresses', () => {
  it('allows the Mac by .local name or home IP, not public names', () => {
    for (const h of ['subras-macbook-pro.local:3000', '192.168.1.20:3000', '10.0.0.5', '172.20.1.2:3000']) expect(hostAllowed(h), h).toBe(true);
    for (const h of ['8.8.8.8', '172.32.0.1', 'evil.example', '192.168.1.20.evil.example']) expect(hostAllowed(h), h).toBe(false);
  });
});

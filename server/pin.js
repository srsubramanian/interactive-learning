// A PIN in front of the API, for when the server is reachable from the home network.
// The PIN is typed once per device; the device then keeps a cookie for a year.
import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'jm_pin';
const MAX_TRIES = 5;
const LOCK_MS = 10 * 60 * 1000;
const tries = new Map(); // address -> { n, until }

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const token = () => sha('jayshri-math-pin:' + config.appPin);

export const pinRequired = () => !!config.appPin;

export function pinOk(req) {
  if (!config.appPin) return true;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)jm_pin=([a-f0-9]{64})(?:;|$)/);
  return !!m && same(m[1], token());
}

/** Checks one PIN try: { ok: true, cookie } or { ok: false, status, error }. Five wrong tries lock that device out for 10 minutes. */
export function tryPin(req, pin) {
  const who = req.socket.remoteAddress || '';
  const now = Date.now();
  const t = tries.get(who) || { n: 0, until: 0 };
  if (t.until > now) return { ok: false, status: 429, error: 'Too many tries. Wait 10 minutes and try again.' };
  if (t.until) { t.n = 0; t.until = 0; }
  if (typeof pin === 'string' && same(sha(pin.trim()), sha(config.appPin))) {
    tries.delete(who);
    const secure = req.socket.encrypted ? '; Secure' : '';
    return { ok: true, cookie: `${COOKIE}=${token()}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure}` };
  }
  t.n++;
  if (t.n >= MAX_TRIES) t.until = now + LOCK_MS;
  tries.set(who, t);
  return { ok: false, status: 401, error: 'That PIN is not right.' };
}

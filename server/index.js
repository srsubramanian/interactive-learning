#!/usr/bin/env node
/*
  Local API for Jayshri Math Voice.
  - ElevenLabs: speaks (text to speech) and can listen (speech to text).
  - Claude: reviews spoken answers and can draw custom picture lessons.
  - Keeps both API keys on this computer; the browser never sees them.
  In production (npm start) it also serves the built React app from dist/.
  With HOST=0.0.0.0 + HTTPS_CERT/HTTPS_KEY + APP_PIN it can be opened from the iPad on the home network.
*/
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { config, ROOT } from './config.js';
import { tts, stt } from './eleven.js';
import { judge, explain } from './claude.js';
import { pinOk, pinRequired, tryPin } from './pin.js';
import { readStore, writeStore } from './store.js';

const DIST = path.join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.map': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Too much data.')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}
const needKey = (res, key, name) => {
  if (key) return false;
  sendJson(res, 400, { error: 'Add ' + name + ' to the .env file and restart.' });
  return true;
};

// Only answer when the page was opened at an address we expect. This stops a web page on some
// other site from using this server (and the API keys behind it), including by DNS rebinding:
// a rebinding page always arrives with its own public name, never a .local name or a home IP.
const PRIVATE_IP = /^(10\.\d+|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+$/;
export function hostAllowed(host) {
  const name = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name.endsWith('.local') || PRIVATE_IP.test(name) ||
    name.endsWith('.ts.net') || config.allowedHosts.includes(name);
}
// Writes must come from this app: browsers send Sec-Fetch-Site, and a JSON or audio body cannot be
// sent cross-site without a CORS preflight, which this server never approves.
function crossSiteWrite(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return true;
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  return req.url.startsWith('/api/stt') ? !type.startsWith('audio/') : type !== 'application/json';
}

async function handle(req, res) {
  try {
    if (!hostAllowed(req.headers.host)) return sendJson(res, 403, { error: 'Unknown host. Add it to ALLOWED_HOSTS in .env.' });
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'POST' && p.startsWith('/api/') && crossSiteWrite(req)) return sendJson(res, 403, { error: 'Not allowed.' });

    if (req.method === 'GET' && p === '/api/config') {
      return sendJson(res, 200, {
        sttProvider: config.sttProvider, hasElevenLabs: !!config.elevenKey, hasAnthropic: !!config.anthropicKey, model: config.claudeModel,
        needPin: pinRequired(), pinOk: pinOk(req)
      });
    }
    if (req.method === 'POST' && p === '/api/pin') {
      const { pin } = JSON.parse((await readBody(req, 1000)).toString() || '{}');
      const r = tryPin(req, pin);
      if (!r.ok) return sendJson(res, r.status, { error: r.error });
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': r.cookie });
      return res.end('{"ok":true}');
    }
    if (p.startsWith('/api/') && !pinOk(req)) return sendJson(res, 401, { error: 'Enter the PIN first.' });
    if (req.method === 'POST' && p === '/api/tts') {
      if (needKey(res, config.elevenKey, 'ELEVENLABS_API_KEY')) return;
      const { text } = JSON.parse((await readBody(req, 20000)).toString() || '{}');
      const audio = await tts(text);
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': audio.length, 'cache-control': 'no-store' });
      return res.end(audio);
    }
    if (req.method === 'POST' && p === '/api/stt') {
      if (needKey(res, config.elevenKey, 'ELEVENLABS_API_KEY')) return;
      const audio = await readBody(req, 6 * 1024 * 1024);
      if (!audio.length) return sendJson(res, 200, { text: '' });
      return sendJson(res, 200, { text: await stt(audio, req.headers['content-type']) });
    }
    if (req.method === 'POST' && p === '/api/judge') {
      if (needKey(res, config.anthropicKey, 'ANTHROPIC_API_KEY')) return;
      return sendJson(res, 200, await judge(JSON.parse((await readBody(req, 20000)).toString() || '{}')));
    }
    if (req.method === 'POST' && p === '/api/explain') {
      if (needKey(res, config.anthropicKey, 'ANTHROPIC_API_KEY')) return;
      return sendJson(res, 200, await explain(JSON.parse((await readBody(req, 20000)).toString() || '{}')));
    }
    if (p === '/api/store' && req.method === 'GET') return sendJson(res, 200, readStore());
    if (p === '/api/store' && req.method === 'POST') {
      return sendJson(res, 200, writeStore(JSON.parse((await readBody(req, 400000)).toString() || '{}')));
    }
    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });

    if (req.method === 'GET') {
      if (!fs.existsSync(DIST)) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('The app is not built yet. For development run "npm run dev" and open http://localhost:5173. For this server run "npm run build" first.');
      }
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
      let file = path.normalize(path.join(DIST, rel));
      if (!file.startsWith(DIST + path.sep) && file !== DIST) return sendJson(res, 404, { error: 'Not found' });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e.message);
    sendJson(res, 500, { error: e.message });
  }
}

function tlsOptions() {
  if (!config.httpsCert && !config.httpsKey) return null;
  for (const [name, file] of [['HTTPS_CERT', config.httpsCert], ['HTTPS_KEY', config.httpsKey]]) {
    if (!file || !fs.existsSync(file)) throw new Error(name + ' file not found: ' + (file || '(not set)') + '. See "Use it on the iPad" in README.md.');
  }
  return { cert: fs.readFileSync(config.httpsCert), key: fs.readFileSync(config.httpsKey) };
}
const tls = tlsOptions();
export const server = tls ? https.createServer(tls, handle) : http.createServer(handle);

/** Addresses to type on the iPad, best first. */
function lanAddresses(scheme) {
  const out = [];
  try {
    if (process.platform === 'darwin') out.push(execFileSync('scutil', ['--get', 'LocalHostName']).toString().trim() + '.local');
  } catch { /* ignore */ }
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out.map((h) => scheme + '://' + h + ':' + config.port);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const local = ['127.0.0.1', 'localhost', '::1'].includes(config.host);
  if (!local && !config.appPin) {
    console.error('HOST=' + config.host + ' lets other devices reach this server and your API keys. Set APP_PIN in .env first.');
    process.exit(1);
  }
  const scheme = tls ? 'https' : 'http';
  server.listen(config.port, config.host, () => {
    console.log('Jayshri Math Voice: ' + scheme + '://localhost:' + config.port);
    if (!local) {
      console.log('On the iPad (same Wi-Fi), open: ' + lanAddresses(scheme).join('  or  '));
      if (!tls) console.log('Note: without HTTPS_CERT/HTTPS_KEY the iPad cannot use the microphone.');
    }
    if (!config.elevenKey) console.log('Missing ELEVENLABS_API_KEY (add it to .env)');
    if (!config.anthropicKey) console.log('Missing ANTHROPIC_API_KEY (add it to .env)');
    console.log('Claude model:', config.claudeModel, '| Listening with:', config.sttProvider);
  });
}

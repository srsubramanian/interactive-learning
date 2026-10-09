#!/usr/bin/env node
/*
  Local API for Jayshri Math Voice.
  - ElevenLabs: speaks (text to speech) and can listen (speech to text).
  - Claude: reviews spoken answers and can draw custom picture lessons.
  - Keeps both API keys on this computer; the browser never sees them.
  In production (npm start) it also serves the built React app from dist/.
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, ROOT } from './config.js';
import { tts, stt } from './eleven.js';
import { judge, explain } from './claude.js';
import { readStore, writeStore } from './store.js';

const DIST = path.join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.map': 'application/json'
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

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (req.method === 'GET' && p === '/api/config') {
      return sendJson(res, 200, { sttProvider: config.sttProvider, hasElevenLabs: !!config.elevenKey, hasAnthropic: !!config.anthropicKey, model: config.claudeModel });
    }
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
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(config.port, '127.0.0.1', () => {
    console.log('Jayshri Math Voice API: http://localhost:' + config.port);
    if (!config.elevenKey) console.log('Missing ELEVENLABS_API_KEY (add it to .env)');
    if (!config.anthropicKey) console.log('Missing ANTHROPIC_API_KEY (add it to .env)');
    console.log('Claude model:', config.claudeModel, '| Listening with:', config.sttProvider);
  });
}

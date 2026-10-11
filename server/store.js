import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { cleanStore } from './schema.js';

const DATA_DIR = config.dataDir;
const FILE = path.join(DATA_DIR, 'store.json');

export function readStore() {
  try {
    return cleanStore(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return cleanStore(null);
  }
}

export function writeStore(raw) {
  const clean = cleanStore(raw);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(clean));
  fs.renameSync(tmp, FILE);
  return clean;
}

import type { Mode, Question } from '../types';

export const MODES: { id: Mode; label: string }[] = [
  { id: 'add10', label: 'Adding up to 10' },
  { id: 'add20', label: 'Adding up to 20' },
  { id: 'sub10', label: 'Taking away within 10' },
  { id: 'sub20', label: 'Taking away within 20' },
  { id: 'mix20', label: 'A mix of everything' }
];

const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

function one(mode: Mode): Question {
  if (mode === 'mix20') mode = (['add10', 'add20', 'sub10', 'sub20'] as Mode[])[rnd(0, 3)];
  if (mode === 'add10') {
    const a = rnd(1, 9), b = rnd(1, 10 - a);
    return { a, b, op: '+', answer: a + b };
  }
  if (mode === 'add20') {
    const a = rnd(2, 18), b = rnd(Math.max(2, 11 - a), Math.min(18, 20 - a));
    return { a, b, op: '+', answer: a + b };
  }
  if (mode === 'sub10') {
    const a = rnd(2, 10), b = rnd(1, a - 1);
    return { a, b, op: '-', answer: a - b };
  }
  const a = rnd(11, 20), b = rnd(2, a - 1);
  return { a, b, op: '-', answer: a - b };
}

export const keyOf = (q: Question) => q.a + q.op + q.b;

/** A new question that has not come up yet in this round. */
export function makeQuestion(mode: Mode, seen: Set<string>): Question {
  for (let i = 0; i < 200; i++) {
    const q = one(mode);
    if (!seen.has(keyOf(q))) { seen.add(keyOf(q)); return q; }
  }
  seen.clear();
  const q = one(mode);
  seen.add(keyOf(q));
  return q;
}

export const words = (q: { a: number; b: number; op: string }) => q.a + (q.op === '+' ? ' plus ' : ' minus ') + q.b;

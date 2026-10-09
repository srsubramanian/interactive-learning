import type { Attempt } from '../types';

/** How well she knows a skill (adding or taking away): level 1 (new) to 4 (strong). */
export function understanding(list: Attempt[]) {
  const last = list.slice(-10);
  const n = last.length;
  const score = n ? last.reduce((s, x) => s + (x.r === 'first' ? 1 : x.r === 'retry' ? 0.5 : 0), 0) / n : 0;
  const level = n < 3 || score < 0.45 ? 1 : score < 0.7 ? 2 : score < 0.88 ? 3 : 4;
  return { n, score: Math.round(score * 100) / 100, level };
}

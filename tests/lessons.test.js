import { describe, it, expect } from 'vitest';
import { buildLesson } from '../src/lessons/builders.ts';
import { cleanLesson, cleanStore, lessonConsistent } from '../server/schema.js';
import { understanding } from '../src/state/level.ts';

describe('built-in lessons', () => {
  it('are valid and arithmetically consistent for every combination', () => {
    let n = 0;
    for (const op of ['+', '-'])
      for (let a = 0; a <= 20; a++)
        for (let b = 1; b <= 20; b++) {
          if (op === '-' && b > a) continue;
          for (let lv = 1; lv <= 4; lv++) {
            const l = buildLesson(a, op, b, lv);
            const c = cleanLesson(l);
            expect(c, `${a}${op}${b} L${lv}`).not.toBeNull();
            expect(c.steps.length, `${a}${op}${b} L${lv} steps kept`).toBe(l.steps.length);
            expect(lessonConsistent(c, l.answer), `${a}${op}${b} L${lv}`).toBe(true);
            // ten frames never overflow
            for (const s of l.steps) if (s.visual.type === 'tenframes') for (const f of s.visual.frames) expect(f.length).toBe(10);
            n++;
          }
        }
    expect(n).toBeGreaterThan(1000);
  });
  it('rejects bad input', () => {
    expect(() => buildLesson(3, '-', 5, 1)).toThrow();
    expect(() => buildLesson(30, '+', 5, 1)).toThrow();
  });
  it('lessonConsistent catches wrong arithmetic', () => {
    const l = buildLesson(7, '+', 5, 1);
    expect(lessonConsistent(l, 11)).toBe(false);
    l.steps.push({ say: 'x', visual: { type: 'equation', lines: ['7 + 5 = 13'] } });
    expect(lessonConsistent(l, 12)).toBe(false);
  });
});

describe('understanding level', () => {
  const at = (r, n) => Array.from({ length: n }, () => ({ r }));
  it('starts at 1, grows with accuracy', () => {
    expect(understanding([]).level).toBe(1);
    expect(understanding(at('first', 10)).level).toBe(4);
    expect(understanding(at('miss', 10)).level).toBe(1);
    expect(understanding([...at('first', 5), ...at('miss', 5)]).level).toBe(2);
  });
});

describe('lesson checks', () => {
  const one = (visual, say = 'Look.') => ({ answer: 12, steps: [{ say, visual }] });
  const eq = (...lines) => one({ type: 'equation', lines });
  it('checks chains and either side of "="', () => {
    expect(lessonConsistent(eq('7 + 3 + 2 = 12'), 12)).toBe(true);
    expect(lessonConsistent(eq('7 + 3 + 2 = 13'), 12)).toBe(false);
    expect(lessonConsistent(eq('12 = 7 + 5'), 12)).toBe(true);
    expect(lessonConsistent(eq('13 = 7 + 5'), 12)).toBe(false);
    expect(lessonConsistent(eq('7 + 5 = 10 + 2'), 12)).toBe(true);
    expect(lessonConsistent(eq('7 + 5 = 10 + 3'), 12)).toBe(false);
    expect(lessonConsistent(eq('15 − 3 = 12'), 12)).toBe(true);
  });
  it('allows blanks and plain text, rejects what it cannot check', () => {
    expect(lessonConsistent(eq('7 + 5 = ?', '7 and 5'), 12)).toBe(true);
    expect(lessonConsistent(eq('7 + 5 = twelve'), 12)).toBe(false);
    expect(lessonConsistent(eq('7 × 2 = 14'), 12)).toBe(false);
  });
  it('checks sums said out loud', () => {
    const v = { type: 'equation', lines: [] };
    expect(lessonConsistent(one(v, 'So 7 plus 5 is 12.'), 12)).toBe(true);
    expect(lessonConsistent(one(v, 'So 7 plus 5 is 13.'), 12)).toBe(false);
    expect(lessonConsistent(one(v, 'Seven plus five is twelve!'), 12)).toBe(true);
    expect(lessonConsistent(one(v, 'Seven plus five makes thirteen!'), 12)).toBe(false);
    expect(lessonConsistent(one(v, 'Twenty take away three leaves seventeen.'), 12)).toBe(true);
    expect(lessonConsistent(one(v, '8, 9 and 10 make three hops.'), 12)).toBe(true);
  });
  it('drops saved lessons that fail the checks', () => {
    const good = { id: 'g', title: 'ok', answer: 12, a: 7, b: 5, op: '+', steps: [{ say: '7 plus 5 is 12.', visual: { type: 'equation', lines: ['7 + 5 = 12'] } }] };
    const bad = { ...good, id: 'b', steps: [{ say: 'x', visual: { type: 'equation', lines: ['7 + 5 = 13'] } }] };
    expect(cleanStore({ lessons: [good, bad] }).lessons.map((l) => l.id)).toEqual(['g']);
  });
});

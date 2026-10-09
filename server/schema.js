// Cleaning and checking for anything that came from Claude or from disk.
// Lessons are data (steps with pictures), never code, so nothing here is executed.

const arr = (x) => (Array.isArray(x) ? x : []);

export function clampInt(n, lo, hi) {
  n = Math.round(Number(n));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
export function str(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
}
const nullableInt = (x) => (x == null ? null : clampInt(x, 0, 40));

export function cleanVisual(v) {
  if (!v || typeof v !== 'object') return { type: 'equation', lines: [] };
  switch (v.type) {
    case 'dots':
      return {
        type: 'dots',
        groups: arr(v.groups).slice(0, 3).map((g) => ({
          n: clampInt(g && g.n, 0, 30),
          color: g && g.color === 'b' ? 'b' : 'a',
          crossed: clampInt((g && g.crossed) || 0, 0, 30)
        })),
        counted: clampInt(v.counted || 0, 0, 60)
      };
    case 'numberline': {
      const max = clampInt(v.max || 20, 5, 30);
      return {
        type: 'numberline',
        max,
        at: v.at == null ? null : clampInt(v.at, 0, max),
        marks: arr(v.marks).slice(0, 10).map((n) => clampInt(n, 0, max)),
        jumps: arr(v.jumps).slice(0, 20).map((j) => ({ from: clampInt(j && j.from, 0, max), to: clampInt(j && j.to, 0, max) }))
      };
    }
    case 'tenframes':
      return {
        type: 'tenframes',
        frames: arr(v.frames).slice(0, 3).map((f) => {
          const cells = arr(f).slice(0, 10).map((c) => clampInt(c, 0, 3));
          while (cells.length < 10) cells.push(0);
          return cells;
        })
      };
    case 'bond':
      return { type: 'bond', whole: nullableInt(v.whole), a: nullableInt(v.a), b: nullableInt(v.b) };
    case 'equation':
      return { type: 'equation', lines: arr(v.lines).slice(0, 5).map((s) => str(s, 40)) };
    default:
      return { type: 'equation', lines: [] };
  }
}

export function cleanLesson(l) {
  if (!l || typeof l !== 'object') return null;
  const steps = arr(l.steps)
    .slice(0, 9)
    .map((s) => ({ say: str(s && s.say, 260), visual: cleanVisual(s && s.visual) }))
    .filter((s) => s.say);
  if (!steps.length) return null;
  return {
    title: str(l.title, 60) || 'Picture lesson',
    level: clampInt(l.level || 1, 1, 4),
    answer: Number.isInteger(l.answer) ? l.answer : null,
    steps
  };
}

// Arithmetic that can be checked in code: equation lines like "7 + 5 = 12" and number bonds.
const EQ = /^\s*(\d+)\s*([+−-])\s*(\d+)\s*=\s*(\d+)\s*$/;
export function lessonConsistent(lesson, answer) {
  if (answer != null && lesson.answer !== answer) return false;
  for (const st of lesson.steps) {
    const v = st.visual;
    if (v.type === 'bond' && v.whole != null && v.a != null && v.b != null && v.a + v.b !== v.whole) return false;
    if (v.type === 'equation') {
      for (const line of v.lines) {
        const m = line.match(EQ);
        if (!m) continue;
        const x = Number(m[1]), y = Number(m[3]), z = Number(m[4]);
        if ((m[2] === '+' ? x + y : x - y) !== z) return false;
      }
    }
  }
  return true;
}

export function cleanStore(s) {
  const out = { progress: { add: [], sub: [] }, lessons: [] };
  if (!s || typeof s !== 'object') return out;
  for (const k of ['add', 'sub']) {
    const list = s.progress && Array.isArray(s.progress[k]) ? s.progress[k] : [];
    out.progress[k] = list.slice(-40).map((x) => ({
      r: x && ['first', 'retry', 'miss'].includes(x.r) ? x.r : 'miss',
      a: clampInt(x && x.a, 0, 40),
      b: clampInt(x && x.b, 0, 40),
      op: k === 'add' ? '+' : '-',
      said: x && Number.isInteger(x.said) ? x.said : null,
      ts: x && Number.isFinite(x.ts) ? x.ts : 0
    }));
  }
  out.lessons = arr(s.lessons)
    .slice(0, 30)
    .map((l) => {
      const c = cleanLesson(l);
      if (!c) return null;
      c.id = str(l.id, 40) || String(Date.now() + Math.random());
      c.source = 'claude';
      c.ts = Number.isFinite(l.ts) ? l.ts : Date.now();
      if (l.a != null && l.b != null && (l.op === '+' || l.op === '-')) {
        c.a = clampInt(l.a, 0, 40);
        c.b = clampInt(l.b, 0, 40);
        c.op = l.op;
      }
      return c;
    })
    .filter(Boolean);
  return out;
}

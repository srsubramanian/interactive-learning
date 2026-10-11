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

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 0 to 99 as words ("twenty-one"); other numbers stay as digits. */
export function numberWord(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
const WORD_VALUE = new Map(Array.from({ length: 100 }, (_, n) => [numberWord(n), n]));
const toNum = (t) => (/^\d+$/.test(t) ? Number(t) : WORD_VALUE.get(t.toLowerCase().replace(/\s+/, '-')));

// Arithmetic that can be checked in code.
// Equation lines: every side of every "=" must be whole numbers joined by + or −, and all sides equal
// ("7 + 5 = 12", "7 + 3 + 2 = 12", "12 = 10 + 2"). A side with "?" is a blank to fill and is skipped.
// Anything else next to "=" cannot be checked, so the lesson is rejected.
const SIDE = /^\d+(\s*[+-]\s*\d+)*$/;
function evalSide(side) {
  let total = 0, sign = 1;
  for (const tok of side.match(/\d+|[+-]/g)) {
    if (tok === '+') sign = 1;
    else if (tok === '-') sign = -1;
    else total += sign * Number(tok);
  }
  return total;
}
export function equationOk(line) {
  if (!line.includes('=')) return true;
  const sides = line.replace(/[−–]/g, '-').split('=').map((s) => s.trim());
  if (sides.some((s) => s.includes('?'))) return true;
  if (!sides.every((s) => SIDE.test(s))) return false;
  const v = sides.map(evalSide);
  return v.every((x) => x === v[0]);
}

// Spoken text: "7 plus 5 is 12", "seven take away two leaves five", "3 + 4 = 7".
const NUM = '(\\d+|(?:twenty|thirty|forty)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|' + ONES.join('|') + ')';
const SAID = new RegExp('\\b' + NUM + '\\s+(plus|\\+|minus|-|−|take away|takes away)\\s+' + NUM + '\\s+(is|are|equals|=|makes|make|gives|leaves)\\s+' + NUM + '\\b', 'gi');
export function sayOk(text) {
  for (const m of text.matchAll(SAID)) {
    const [x, op, y, z] = [toNum(m[1]), m[2].toLowerCase(), toNum(m[3]), toNum(m[5])];
    const want = op === 'plus' || op === '+' ? x + y : x - y;
    if (want !== z) return false;
  }
  return true;
}

export function lessonConsistent(lesson, answer) {
  if (answer != null && lesson.answer !== answer) return false;
  for (const st of lesson.steps) {
    if (!sayOk(st.say)) return false;
    const v = st.visual;
    if (v.type === 'bond' && v.whole != null && v.a != null && v.b != null && v.a + v.b !== v.whole) return false;
    if (v.type === 'equation' && !v.lines.every(equationOk)) return false;
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
      // Saved lessons are read back from disk, so they get the same checks as a fresh one.
      const answer = c.op ? (c.op === '+' ? c.a + c.b : c.a - c.b) : null;
      return lessonConsistent(c, answer) ? c : null;
    })
    .filter(Boolean);
  return out;
}

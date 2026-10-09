import type { Lesson, Op, Step, Visual } from '../types';

export const LEVEL_NAMES: Record<Op, string[]> = {
  '+': ['Count them all', 'Count on', 'Make ten', 'Number families'],
  '-': ['Count what is left', 'Count back', 'Go through ten', 'Think addition']
};

const MINUS = '−';
const sym = (op: Op) => (op === '+' ? '+' : MINUS);
const word = (op: Op) => (op === '+' ? 'plus' : 'minus');

/** "1, 2, 3, 4" */
const countList = (from: number, to: number) => {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out.join(', ');
};
const countDownList = (from: number, to: number) => {
  const out: number[] = [];
  for (let i = from; i >= to; i--) out.push(i);
  return out.join(', ');
};

/** A ten frame: `blue` blue dots, then `coral` coral dots, then `hollow` hollow dots. */
const frame = (blue: number, coral = 0, hollow = 0) => {
  const cells: number[] = [];
  for (let i = 0; i < blue; i++) cells.push(1);
  for (let i = 0; i < coral; i++) cells.push(2);
  for (let i = 0; i < hollow; i++) cells.push(3);
  while (cells.length < 10) cells.push(0);
  return cells.slice(0, 10);
};

const eq = (...lines: string[]): Visual => ({ type: 'equation', lines });
const dots = (groups: { n: number; color: 'a' | 'b'; crossed?: number }[], counted = 0): Visual => ({
  type: 'dots',
  groups: groups.map((g) => ({ n: g.n, color: g.color, crossed: g.crossed || 0 })),
  counted
});

function addSteps(a: number, b: number, level: number): Step[] {
  const ans = a + b;
  const big = Math.max(a, b), small = Math.min(a, b);
  const total = `${a} plus ${b} is ${ans}.`;
  const finish: Step = { say: `So ${total}`, visual: eq(`${a} + ${b} = ${ans}`) };

  if (level === 1) {
    return [
      { say: `Here are ${a} dots. Let us count them.`, visual: dots([{ n: a, color: 'a' }], a) },
      { say: `Now ${b} more dots join them.`, visual: dots([{ n: a, color: 'a' }, { n: b, color: 'b' }], a) },
      { say: `Count them all: ${countList(1, ans)}.`, visual: dots([{ n: a, color: 'a' }, { n: b, color: 'b' }], ans) },
      finish
    ];
  }
  if (level === 2) {
    const jumps = Array.from({ length: small }, (_, i) => ({ from: big + i, to: big + i + 1 }));
    return [
      { say: `Start with the bigger number, ${big}. Then count on ${small} more.`, visual: { type: 'numberline', max: Math.max(10, ans), at: big, marks: [big], jumps: [] } },
      { say: `${big}, then ${countList(big + 1, ans)}. One hop for each number.`, visual: { type: 'numberline', max: Math.max(10, ans), at: ans, marks: [big, ans], jumps } },
      finish
    ];
  }
  if (level === 3) {
    if (ans <= 10) {
      return [
        { say: `Use a ten frame. Put ${a} blue dots in it.`, visual: { type: 'tenframes', frames: [frame(a)] } },
        { say: `Now add ${b} orange dots. They all fit!`, visual: { type: 'tenframes', frames: [frame(a, b)] } },
        { say: `${a} and ${b} fill ${ans} spaces.`, visual: { type: 'tenframes', frames: [frame(a, b)] } },
        finish
      ];
    }
    if (big <= 10) {
      const need = 10 - big, rem = small - need;
      return [
        { say: `Start with ${big} in a ten frame.`, visual: { type: 'tenframes', frames: [frame(big)] } },
        { say: `We need ${need} more to make ten. Take ${need} from the ${small}.`, visual: { type: 'tenframes', frames: [frame(big, need)] } },
        { say: `That leaves ${rem} more. Put them in a new frame.`, visual: { type: 'tenframes', frames: [frame(big, need), frame(0, rem)] } },
        { say: `Ten and ${rem} makes ${ans}.`, visual: eq(`10 + ${rem} = ${ans}`) },
        finish
      ];
    }
    const t = big - 10;
    const steps: Step[] = [
      { say: `${big} is ten and ${t} more.`, visual: { type: 'tenframes', frames: [frame(10), frame(t)] } },
      { say: `Add ${small}. First, ${t} plus ${small}.`, visual: { type: 'tenframes', frames: [frame(10), frame(t, t + small <= 10 ? small : 0)] } },
      { say: `${t} plus ${small} is ${t + small}.`, visual: eq(`${t} + ${small} = ${t + small}`) },
      { say: `Ten and ${t + small} makes ${ans}.`, visual: eq(`10 + ${t + small} = ${ans}`) },
      finish
    ];
    return steps;
  }
  // level 4: number families
  const lines2 = a === b ? [`${a} + ${b} = ${ans}`] : [`${a} + ${b} = ${ans}`, `${b} + ${a} = ${ans}`];
  const lines3 = a === b ? [`${ans} ${MINUS} ${a} = ${b}`] : [`${ans} ${MINUS} ${a} = ${b}`, `${ans} ${MINUS} ${b} = ${a}`];
  return [
    { say: `${a} and ${b} are partners. Together they make ${ans}.`, visual: { type: 'bond', whole: ans, a, b } },
    { say: `Partners can swap places. The answer stays ${ans}.`, visual: eq(...lines2) },
    { say: `Take one partner away and you get the other one.`, visual: eq(...lines3) },
    finish
  ];
}

function subSteps(a: number, b: number, level: number): Step[] {
  const ans = a - b;
  const finish: Step = { say: `So ${a} minus ${b} is ${ans}.`, visual: eq(`${a} ${MINUS} ${b} = ${ans}`) };

  if (level === 1) {
    return [
      { say: `Here are ${a} dots.`, visual: dots([{ n: a, color: 'a' }], 0) },
      { say: `Take away ${b}. They are crossed out.`, visual: dots([{ n: a, color: 'a', crossed: b }], 0) },
      { say: ans === 0 ? 'Nothing is left. Zero!' : `Count what is left: ${countList(1, ans)}.`, visual: dots([{ n: a, color: 'a', crossed: b }], ans) },
      finish
    ];
  }
  if (level === 2) {
    const max = Math.max(10, a);
    const jumps = Array.from({ length: b }, (_, i) => ({ from: a - i, to: a - i - 1 }));
    return [
      { say: `Start at ${a}. Count back ${b}.`, visual: { type: 'numberline', max, at: a, marks: [a], jumps: [] } },
      { say: `${a}, then ${countDownList(a - 1, ans)}. One hop back for each number.`, visual: { type: 'numberline', max, at: ans, marks: [a, ans], jumps } },
      finish
    ];
  }
  if (level === 3) {
    if (a <= 10) {
      return [
        { say: `Put ${a} dots in a ten frame.`, visual: { type: 'tenframes', frames: [frame(a)] } },
        { say: `Take away ${b}. They turn into empty circles.`, visual: { type: 'tenframes', frames: [frame(ans, 0, b)] } },
        { say: `${ans} dots are left.`, visual: { type: 'tenframes', frames: [frame(ans, 0, b)] } },
        finish
      ];
    }
    const ones = a - 10;
    if (b <= ones) {
      return [
        { say: `${a} is ten and ${ones} more.`, visual: { type: 'tenframes', frames: [frame(10), frame(ones)] } },
        { say: `Take ${b} away from the ${ones}.`, visual: { type: 'tenframes', frames: [frame(10), frame(ones - b, 0, b)] } },
        { say: `Ten and ${ones - b} is ${ans}.`, visual: eq(`10 + ${ones - b} = ${ans}`) },
        finish
      ];
    }
    const r = b - ones;
    return [
      { say: `${a} is ten and ${ones} more. We take away ${b}.`, visual: { type: 'numberline', max: Math.max(10, a), at: a, marks: [a, 10], jumps: [] } },
      { say: `First take away the ${ones} ones to get to ten.`, visual: { type: 'numberline', max: Math.max(10, a), at: 10, marks: [a, 10], jumps: [{ from: a, to: 10 }] } },
      { say: `We still need to take away ${r} more. Ten minus ${r} is ${ans}.`, visual: { type: 'numberline', max: Math.max(10, a), at: ans, marks: [a, 10, ans], jumps: [{ from: a, to: 10 }, { from: 10, to: ans }] } },
      finish
    ];
  }
  // level 4: think addition
  return [
    { say: `Ask a different question. ${b} plus what makes ${a}?`, visual: { type: 'bond', whole: a, a: b, b: null } },
    { say: `${b} plus ${ans} makes ${a}. So the missing partner is ${ans}.`, visual: { type: 'bond', whole: a, a: b, b: ans } },
    { say: `Adding and taking away are a team.`, visual: eq(`${b} + ${ans} = ${a}`, `${a} ${MINUS} ${b} = ${ans}`) },
    finish
  ];
}

export function buildLesson(a: number, op: Op, b: number, level: number): Lesson {
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) throw new Error('Pick whole numbers from 0 to 20.');
  if (b < 1) throw new Error('The second number should be at least 1.');
  const answer = op === '+' ? a + b : a - b;
  if (answer < 0) throw new Error('For taking away, the first number must be the bigger one.');
  const lv = Math.min(4, Math.max(1, Math.round(level)));
  const steps = op === '+' ? addSteps(a, b, lv) : subSteps(a, b, lv);
  return {
    title: `${a} ${sym(op)} ${b}: ${LEVEL_NAMES[op][lv - 1]}`,
    level: lv,
    answer,
    a,
    b,
    op,
    source: 'built-in',
    steps
  };
}

export const speakable = (s: string) => s.replace(/\+/g, ' plus ').replace(/−|-/g, ' minus ').replace(/=/g, ' equals ');
export { word as opWord };

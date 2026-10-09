export type Op = '+' | '-';
export type Mode = 'add10' | 'add20' | 'sub10' | 'sub20' | 'mix20';

export type Visual =
  | { type: 'dots'; groups: { n: number; color: 'a' | 'b'; crossed: number }[]; counted: number }
  | { type: 'numberline'; max: number; at: number | null; marks: number[]; jumps: { from: number; to: number }[] }
  | { type: 'tenframes'; frames: number[][] }
  | { type: 'bond'; whole: number | null; a: number | null; b: number | null }
  | { type: 'equation'; lines: string[] };

export interface Step { say: string; visual: Visual }

export interface Lesson {
  id?: string;
  title: string;
  level: number;
  answer: number | null;
  a?: number;
  b?: number;
  op?: Op;
  source: 'built-in' | 'claude';
  steps: Step[];
  ts?: number;
}

export type Result = 'first' | 'retry' | 'miss';
export interface Attempt { r: Result; a: number; b: number; op: Op; said: number | null; ts: number }
export interface Store { progress: { add: Attempt[]; sub: Attempt[] }; lessons: Lesson[] }
export interface Question { a: number; b: number; op: Op; answer: number }

export interface Config { sttProvider: 'elevenlabs' | 'browser'; hasElevenLabs: boolean; hasAnthropic: boolean; model: string }
export interface JudgeResult { said: number | null; verdict: 'correct' | 'wrong' | 'unclear'; line: string; answer: number }
export interface ExplainRequest { a: number; b: number; op: Op; level: number; said: number | null }

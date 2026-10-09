import type { Visual as V } from '../types';

function Dots({ v }: { v: Extract<V, { type: 'dots' }> }) {
  let counter = 0;
  return (
    <div className="dots">
      {v.groups.map((g, gi) => (
        <div className="dgroup" key={gi}>
          {Array.from({ length: g.n }, (_, i) => {
            const crossed = i >= g.n - g.crossed;
            let label = '';
            if (!crossed) {
              counter++;
              if (counter <= v.counted) label = String(counter);
            }
            return (
              <span key={i} className={'dot ' + (g.color === 'b' ? 'b' : 'a') + (crossed ? ' x' : '')}>
                {label}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function NumberLine({ v }: { v: Extract<V, { type: 'numberline' }> }) {
  const W = 680, pad = 24, y = 78;
  const step = (W - 2 * pad) / v.max;
  const x = (n: number) => pad + n * step;
  const showAll = v.max <= 20;
  return (
    <svg viewBox={`0 0 ${W} 140`} className="nl" role="img" aria-label="number line">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--dot-b)" />
        </marker>
      </defs>
      <line x1={x(0)} x2={x(v.max)} y1={y} y2={y} stroke="var(--ink2)" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: v.max + 1 }, (_, n) => (
        <g key={n}>
          <line x1={x(n)} x2={x(n)} y1={y - 7} y2={y + 7} stroke="var(--ink2)" strokeWidth="2" />
          {(showAll || n % 5 === 0 || v.marks.includes(n)) && (
            <text x={x(n)} y={y + 28} textAnchor="middle" className="nl-t">{n}</text>
          )}
        </g>
      ))}
      {v.jumps.map((j, i) => {
        const x1 = x(j.from), x2 = x(j.to), mid = (x1 + x2) / 2;
        const lift = Math.min(60, 22 + Math.abs(x2 - x1) * 0.35);
        return (
          <path key={i} d={`M${x1},${y - 8} Q${mid},${y - 8 - lift} ${x2},${y - 8}`} fill="none" stroke="var(--dot-b)" strokeWidth="3" markerEnd="url(#arrowhead)" />
        );
      })}
      {v.marks.map((n, i) => (
        <circle key={'m' + i} cx={x(n)} cy={y} r="11" fill="none" stroke="var(--dot-a)" strokeWidth="4" />
      ))}
      {v.at != null && <circle cx={x(v.at)} cy={y} r="8" fill="var(--sun)" stroke="var(--sun-ink)" strokeWidth="2" />}
    </svg>
  );
}

function TenFrames({ v }: { v: Extract<V, { type: 'tenframes' }> }) {
  return (
    <div className="frames">
      {v.frames.map((cells, fi) => (
        <div className="frame" key={fi}>
          {cells.map((c, i) => (
            <span key={i} className={'cell c' + c}>
              <i />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Bond({ v }: { v: Extract<V, { type: 'bond' }> }) {
  const t = (n: number | null) => (n == null ? '?' : String(n));
  return (
    <svg viewBox="0 0 240 180" className="bond" role="img" aria-label="number bond">
      <line x1="120" y1="56" x2="55" y2="116" stroke="var(--ink2)" strokeWidth="3" />
      <line x1="120" y1="56" x2="185" y2="116" stroke="var(--ink2)" strokeWidth="3" />
      {[[120, 38, v.whole], [55, 138, v.a], [185, 138, v.b]].map(([cx, cy, n], i) => (
        <g key={i}>
          <circle cx={cx as number} cy={cy as number} r="30" fill={n == null ? 'var(--sun)' : 'var(--card)'} stroke="var(--dot-a)" strokeWidth="4" />
          <text x={cx as number} y={(cy as number) + 10} textAnchor="middle" className="bond-t">{t(n as number | null)}</text>
        </g>
      ))}
    </svg>
  );
}

function Equation({ v }: { v: Extract<V, { type: 'equation' }> }) {
  return (
    <div className="eqs">
      {v.lines.map((l, i) => (
        <div key={i} className="eqline">{l}</div>
      ))}
    </div>
  );
}

export function Visual({ v }: { v: V }) {
  switch (v.type) {
    case 'dots': return <Dots v={v} />;
    case 'numberline': return <NumberLine v={v} />;
    case 'tenframes': return <TenFrames v={v} />;
    case 'bond': return <Bond v={v} />;
    case 'equation': return <Equation v={v} />;
  }
}

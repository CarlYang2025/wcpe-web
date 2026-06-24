import type { Top5Score } from '../lib/types'
import { QUADRANT_COLORS } from '../lib/types'

interface Props {
  top5Scores: Top5Score[]
  homeWinProb: number
  awayWinProb: number
}

/**
 * Reclassify score into quadrant with pre-match strength context.
 * Mirrors classifyQuadrant() in analysis-engine.ts.
 */
function reclassifyQuadrant(score: string, homeWinProb: number, awayWinProb: number): string {
  const parts = score.split(/[:-]/);
  if (parts.length !== 2) return 'Q2';
  const h = parseInt(parts[0]);
  const a = parseInt(parts[1]);
  if (isNaN(h) || isNaN(a)) return 'Q2';

  const homeStrong = homeWinProb > 0.45 && (homeWinProb - awayWinProb) >= 0.15;
  const awayStrong = awayWinProb > 0.45 && (awayWinProb - homeWinProb) >= 0.15;
  const diff = Math.abs(h - a);
  const total = h + a;

  if (homeStrong && h < a) return 'Q3';
  if (awayStrong && h > a) return 'Q3';

  if (homeStrong && h > a && diff >= 2) return 'Q1';
  if (awayStrong && h < a && diff >= 2) return 'Q1';

  if (total >= 4 && h >= 2 && a >= 2) return 'Q4';

  if (diff >= 3) return 'Q1';

  return 'Q2';
}

export default function QuadrantChart({ top5Scores, homeWinProb, awayWinProb }: Props) {
  const size = 240
  const half = size / 2
  const pad = 24
  const tick = 22 // vertical spacing between scores

  const q = [
    { id: 'Q1', x: pad, y: pad, w: half - pad, h: half - pad, color: QUADRANT_COLORS.Q1, label: '强队碾压' },
    { id: 'Q4', x: half, y: pad, w: half - pad, h: half - pad, color: QUADRANT_COLORS.Q4, label: '对攻大战' },
    { id: 'Q2', x: pad, y: half, w: half - pad, h: half - pad, color: QUADRANT_COLORS.Q2, label: '均势博弈' },
    { id: 'Q3', x: half, y: half, w: half - pad, h: half - pad, color: QUADRANT_COLORS.Q3, label: '冷门爆冷' },
  ]

  // Group scores by quadrant, reclassifying on the fly (safety net)
  const grouped = new Map<string, Top5Score[]>()
  for (const s of top5Scores) {
    const quadrant = reclassifyQuadrant(s.score, homeWinProb, awayWinProb)
    if (!grouped.has(quadrant)) grouped.set(quadrant, [])
    grouped.get(quadrant)!.push(s)
  }

  // Stick each quadrant's scores centered vertically within that quadrant
  const placed: { x: number; y: number; r: number; score: string; rank: number; color: string }[] = []
  for (const qr of q) {
    const scores = grouped.get(qr.id) || []
    const totalH = scores.length * tick
    const startY = qr.y + qr.h / 2 - totalH / 2 + 12
    scores.forEach((s, si) => {
      placed.push({
        x: qr.x + 20 + si * 28,
        y: startY + si * tick,
        r: 7,
        score: s.score,
        rank: top5Scores.indexOf(s) + 1,
        color: qr.color,
      })
    })
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2}
        rx="8" fill="#1a1f3a" stroke="#1a1f3a" strokeWidth="1" />
      <line x1={half} y1={pad} x2={half} y2={size - pad} stroke="#0a0e27" strokeWidth="2" />
      <line x1={pad} y1={half} x2={size - pad} y2={half} stroke="#0a0e27" strokeWidth="2" />

      {q.map((r, i) => (
        <g key={i}>
          <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4}
            rx="4" fill={r.color} fillOpacity="0.08" stroke={r.color} strokeWidth="1" strokeOpacity="0.25" />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 3} textAnchor="middle" fill={r.color}
            fontSize="11" fontWeight="bold" fontFamily="sans-serif" opacity="0.6">
            {r.label}
          </text>
        </g>
      ))}

      {placed.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity="0.9" />
          <text x={p.x + p.r + 4} y={p.y + 4} fill={p.color} fontSize="11" fontWeight="bold"
            fontFamily="monospace">
            {p.score}
          </text>
        </g>
      ))}

      <text x={half} y={pad - 3} textAnchor="middle" fill="#555555" fontSize="8">高进球</text>
      <text x={half} y={size - 5} textAnchor="middle" fill="#555555" fontSize="8">低进球</text>
      <text x={pad - 3} y={half + 5} textAnchor="end" fill="#555555" fontSize="8">弱</text>
      <text x={size - pad + 3} y={half + 5} textAnchor="start" fill="#555555" fontSize="8">强</text>
    </svg>
  )
}

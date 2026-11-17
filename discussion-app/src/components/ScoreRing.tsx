export function ScoreRing({ total }: { total: number | null }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const ratio = total === null ? 0 : Math.max(0, Math.min(100, total)) / 100
  return (
    <div className="score-ring" aria-label={total === null ? '점수 없음' : `총점 ${total}점`}>
      <svg viewBox="0 0 128 128" width="128" height="128" role="img">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(31,29,26,0.10)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 64 64)"
        />
        <defs>
          <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f5bd5" />
            <stop offset="100%" stopColor="#c0603f" />
          </linearGradient>
        </defs>
      </svg>
      <div className="score-ring-label">
        <strong>{total === null ? '–' : total}</strong>
        <span>/ 100</span>
      </div>
    </div>
  )
}

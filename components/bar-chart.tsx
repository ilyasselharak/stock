'use client'

export function BarChart({
  data,
  color = '#6366f1',
  height = 180,
  formatValue,
}: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
  formatValue?: (n: number) => string
}) {
  if (!data.length) return <NoChartData />
  const max = Math.max(...data.map((d) => d.value), 1)
  const width = 600
  const pad = 28
  const chartH = height - pad - 18
  const barWidth = Math.min(40, (width - 40) / data.length - 6)
  const step = (width - 40) / data.length

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[400px]">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={20}
            x2={width - 20}
            y1={pad + chartH * (1 - f)}
            y2={pad + chartH * (1 - f)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * chartH, 2)
          const x = 20 + i * step + step / 2 - barWidth / 2
          const y = pad + chartH - h
          const label = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={h} rx="4" fill={color} opacity="0.9">
                <title>{d.label}: {formatValue ? formatValue(d.value) : d.value}</title>
              </rect>
              <text x={x + barWidth / 2} y={pad + chartH + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {label}
              </text>
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">
                {formatValue ? formatValue(d.value) : d.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function NoChartData() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-400">—</div>
  )
}

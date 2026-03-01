interface KpiCardProps {
  label: string
  value: string | number | undefined | null
  change?: number | null
  prefix?: string
  suffix?: string
  description?: string
}

export function KpiCard({ label, value, change, prefix, suffix, description }: KpiCardProps) {
  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0

  const displayValue = value === null || value === undefined ? '—' : value

  return (
    <div className="bg-white rounded-lg border border-stone-200 p-5 flex flex-col gap-1">
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-stone-800">
        {prefix}{typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}{suffix}
      </p>
      {change !== null && change !== undefined && (
        <p className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-stone-400'}`}>
          {isPositive ? '↑' : isNegative ? '↓' : '–'} {Math.abs(change)}% vs prev period
        </p>
      )}
      {description && <p className="text-xs text-stone-400 mt-1">{description}</p>}
    </div>
  )
}

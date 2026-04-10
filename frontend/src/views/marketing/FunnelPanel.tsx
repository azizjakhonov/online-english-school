import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ArrowDown } from 'lucide-react'
import api from '../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStep { step: string; count: number; drop_off_pct: number }
interface FunnelData  { period_days: number; funnel: FunnelStep[] }

// ─── Step colors ──────────────────────────────────────────────────────────────

const STEP_COLORS = [
  { bar: 'bg-blue-500',    text: 'text-blue-700',    light: 'bg-blue-50'    },
  { bar: 'bg-violet-500',  text: 'text-violet-700',  light: 'bg-violet-50'  },
  { bar: 'bg-amber-500',   text: 'text-amber-700',   light: 'bg-amber-50'   },
  { bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
  { bar: 'bg-rose-500',    text: 'text-rose-700',    light: 'bg-rose-50'    },
]

// ─── Funnel step row ──────────────────────────────────────────────────────────

function FunnelStepRow({
  step, index, topCount,
}: {
  step: FunnelStep
  index: number
  topCount: number
}) {
  const color = STEP_COLORS[index % STEP_COLORS.length]
  const widthPct = topCount > 0 ? Math.max((step.count / topCount) * 100, 2) : 0
  const conversionFromTop = topCount > 0 ? ((step.count / topCount) * 100).toFixed(1) : '0'

  return (
    <div>
      <div className={`rounded-2xl border border-stone-200 ${color.light} px-5 py-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full ${color.bar} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-stone-800">{step.step}</span>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-stone-400">Count</p>
              <p className="text-lg font-bold text-stone-800">{step.count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">From top</p>
              <p className={`text-lg font-bold ${color.text}`}>{conversionFromTop}%</p>
            </div>
          </div>
        </div>
        {/* Bar */}
        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color.bar} transition-all duration-500`}
            style={{ width: `${widthPct}%` }}
          />
        </div>
      </div>

      {/* Drop-off arrow between steps */}
      {index < 4 && step.drop_off_pct > 0 && (
        <div className="flex items-center gap-2 py-1.5 px-6">
          <ArrowDown className="w-3.5 h-3.5 text-stone-300" />
          <span className="text-xs text-stone-400">
            <span className="text-red-500 font-medium">−{step.drop_off_pct}%</span> drop-off here
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

import { usePageTitle } from '../../lib/usePageTitle';

export default function FunnelPanel() {
  usePageTitle('Conversion Funnel');
  const [period, setPeriod] = useState(30)

  const { data, isLoading } = useQuery<FunnelData>({
    queryKey: ['marketing-funnel', period],
    queryFn: () => api.get(`/api/marketing/metrics/funnel/?period=${period}`).then(r => r.data),
  })

  const steps  = data?.funnel ?? []
  const topCount = steps[0]?.count ?? 0

  // Overall conversion: signups → first payment
  const lastStep   = steps[steps.length - 1]
  const overallCvr = topCount > 0 && lastStep
    ? ((lastStep.count / topCount) * 100).toFixed(2)
    : '0.00'

  // Biggest drop-off step
  const biggestDrop = steps.length > 1
    ? steps.slice(1).reduce((max, s) => s.drop_off_pct > max.drop_off_pct ? s : max, steps[1])
    : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Acquisition Funnel</h1>
        <select
          value={period} onChange={e => setPeriod(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Total signups</p>
          {isLoading
            ? <div className="h-7 w-16 bg-stone-100 animate-pulse rounded" />
            : <p className="text-2xl font-bold text-stone-800">{topCount.toLocaleString()}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Overall conversion</p>
          {isLoading
            ? <div className="h-7 w-20 bg-stone-100 animate-pulse rounded" />
            : <p className="text-2xl font-bold text-emerald-600">{overallCvr}%</p>}
          <p className="text-xs text-stone-400 mt-0.5">signup → payment</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Biggest drop-off</p>
          {isLoading
            ? <div className="h-7 w-28 bg-stone-100 animate-pulse rounded" />
            : biggestDrop
              ? <>
                  <p className="text-lg font-bold text-red-500">−{biggestDrop.drop_off_pct}%</p>
                  <p className="text-xs text-stone-400 mt-0.5 truncate">{biggestDrop.step}</p>
                </>
              : <p className="text-2xl font-bold text-stone-300">—</p>}
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-4">Conversion funnel</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : steps.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-stone-300 text-sm">No data for this period</div>
        ) : (
          <div className="space-y-0">
            {steps.map((step, i) => (
              <FunnelStepRow key={step.step} step={step} index={i} topCount={topCount} />
            ))}
          </div>
        )}
      </div>

      {/* Step-by-step table */}
      {!isLoading && steps.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Step detail</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">Step</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Count</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">% of top</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.step} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-2.5 text-sm text-stone-700">
                    <span className="font-medium">{i + 1}.</span> {s.step}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right font-semibold text-stone-800">{s.count.toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-sm text-right text-emerald-600 font-medium">
                    {topCount > 0 ? ((s.count / topCount) * 100).toFixed(1) : '0'}%
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right">
                    {i === 0
                      ? <span className="text-stone-300">—</span>
                      : <span className="text-red-500 font-medium">−{s.drop_off_pct}%</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

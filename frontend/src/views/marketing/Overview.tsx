import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
} from 'recharts'
import { KpiCard } from '../../components/marketing/KpiCard'
import api from '../../lib/api'

function shortDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtUZS(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M UZS`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K UZS`
  return `${v.toLocaleString()} UZS`
}

export default function MarketingOverview() {
  const [period, setPeriod] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-kpis', period],
    queryFn: () => api.get(`/api/marketing/metrics/kpis/?period=${period}`).then(r => r.data),
  })

  const { data: revData } = useQuery({
    queryKey: ['marketing-revenue', period],
    queryFn: () => api.get(`/api/marketing/metrics/revenue/?period=${period}`).then(r => r.data),
  })

  const { data: funnelData } = useQuery({
    queryKey: ['marketing-funnel', period],
    queryFn: () => api.get(`/api/marketing/metrics/funnel/?period=${period}`).then(r => r.data),
  })

  const revenueSparkline = (revData?.daily_revenue ?? []).map((d: any) => ({
    label: shortDate(d.date),
    revenue: d.revenue,
  }))

  const funnelSteps: { step: string; count: number; drop_off_pct: number }[] = funnelData?.funnel ?? []
  const topCount = funnelSteps[0]?.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Marketing Overview</h1>
        <select
          value={period}
          onChange={e => setPeriod(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="New Leads"        value={data?.new_leads?.value}                              change={data?.new_leads?.change_pct} />
          <KpiCard label="Revenue (UZS)"    value={data?.revenue?.value != null ? fmtUZS(data.revenue.value) : '—'} change={data?.revenue?.change_pct} />
          <KpiCard label="Conversion Rate"  value={data?.conversion_rate}   suffix="%" />
          <KpiCard label="LTV"              value={data?.ltv != null ? Number(data.ltv).toFixed(0) : null} suffix=" UZS" description="Avg lifetime value" />
          <KpiCard label="CAC"              value={data?.cac != null ? Number(data.cac).toFixed(0) : null} suffix=" UZS" description="Customer acq. cost" />
          <KpiCard label="LTV : CAC"        value={data?.ltv_cac_ratio ?? '—'} description="Target: > 3×" />
          <KpiCard label="ROAS"             value={data?.roas ?? '—'}           description="Return on ad spend" />
          <KpiCard label="Lessons Done"     value={data?.lessons_completed} />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">

        {/* Revenue sparkline */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Revenue trend</h2>
            <a href="/marketing/revenue" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Full report →</a>
          </div>
          {revenueSparkline.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-stone-300 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={revenueSparkline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#78716c' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <Tooltip
                  formatter={(v: number | undefined) => [fmtUZS(v ?? 0), 'Revenue']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Funnel summary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Conversion funnel</h2>
            <a href="/marketing/funnel" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Full report →</a>
          </div>
          {funnelSteps.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-stone-300 text-sm">No data</div>
          ) : (
            <div className="space-y-2 mt-1">
              {funnelSteps.map((s, i) => {
                const pct = topCount > 0 ? Math.max((s.count / topCount) * 100, 2) : 0
                const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
                return (
                  <div key={s.step}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-stone-600 truncate max-w-[60%]">{s.step}</span>
                      <span className="font-semibold text-stone-700">{s.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-stone-400 pt-1">
                Overall: <span className="font-semibold text-emerald-600">
                  {topCount > 0 && funnelSteps.length > 1
                    ? ((funnelSteps[funnelSteps.length - 1].count / topCount) * 100).toFixed(1)
                    : '0'}% conversion
                </span>
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

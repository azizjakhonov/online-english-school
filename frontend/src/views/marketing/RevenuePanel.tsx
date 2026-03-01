import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar,
} from 'recharts'
import { Loader2, TrendingUp, CreditCard, Receipt } from 'lucide-react'
import api from '../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyRevenue { date: string; revenue: number; payments: number }
interface RevenueData {
  period_days: number
  total_revenue: number
  total_payments: number
  avg_order_value: number
  currency: string
  daily_revenue: DailyRevenue[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUZS(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return v.toLocaleString()
}

function shortDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-stone-700 mb-1">{shortDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? `${fmtUZS(p.value)} UZS` : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RevenuePanel() {
  const [period, setPeriod] = useState(90)
  const [view, setView] = useState<'revenue' | 'payments'>('revenue')

  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ['marketing-revenue', period],
    queryFn: () => api.get(`/api/marketing/metrics/revenue/?period=${period}`).then(r => r.data),
  })

  const chartData = (data?.daily_revenue ?? []).map(d => ({
    ...d,
    date: d.date,
    label: shortDate(d.date),
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Revenue & Pipeline</h1>
        <select
          value={period} onChange={e => setPeriod(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-start gap-4">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Total revenue</p>
            {isLoading
              ? <div className="h-7 w-24 bg-stone-100 animate-pulse rounded" />
              : <p className="text-2xl font-bold text-stone-800">{fmtUZS(data?.total_revenue ?? 0)} <span className="text-sm font-normal text-stone-400">UZS</span></p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-start gap-4">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Total payments</p>
            {isLoading
              ? <div className="h-7 w-16 bg-stone-100 animate-pulse rounded" />
              : <p className="text-2xl font-bold text-stone-800">{data?.total_payments ?? 0}</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-start gap-4">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Avg order value</p>
            {isLoading
              ? <div className="h-7 w-24 bg-stone-100 animate-pulse rounded" />
              : <p className="text-2xl font-bold text-stone-800">{fmtUZS(data?.avg_order_value ?? 0)} <span className="text-sm font-normal text-stone-400">UZS</span></p>}
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-stone-700">
            {view === 'revenue' ? 'Daily Revenue (UZS)' : 'Daily Payments'}
          </h2>
          <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('revenue')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'revenue' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Revenue
            </button>
            <button
              onClick={() => setView('payments')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'payments' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Payments
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-stone-300 text-sm">No data for this period</div>
        ) : view === 'revenue' ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ede8" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={v => fmtUZS(v)} width={52} />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone" dataKey="revenue" name="Revenue"
                stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ede8" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="payments" name="Payments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily breakdown table (last 10 days) */}
      {!isLoading && chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Recent days</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Revenue (UZS)</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Payments</th>
                </tr>
              </thead>
              <tbody>
                {[...chartData].reverse().slice(0, 10).map(row => (
                  <tr key={row.date} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-2.5 text-sm text-stone-600">{shortDate(row.date)}</td>
                    <td className="px-5 py-2.5 text-sm text-right font-medium text-stone-800">{row.revenue.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-sm text-right text-stone-600">{row.payments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

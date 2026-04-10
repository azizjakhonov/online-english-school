import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Loader2, Users, TrendingDown, RefreshCw, UserCheck } from 'lucide-react'
import api from '../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetentionData {
  active_students_30d: number
  churned_students_30d: number
  total_students: number
  churn_rate: number
  retention_rate: number
}

interface AcquisitionData {
  period_days: number
  total_signups: number
  by_role: Record<string, number>
  daily_signups: { date: string; signups: number }[]
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#e5e7eb']

function shortDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-stone-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-stone-800">{value}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Custom pie label ─────────────────────────────────────────────────────────

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) {
  if (value === 0) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {value}
    </text>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

import { usePageTitle } from '../../lib/usePageTitle';

export default function RetentionPanel() {
  usePageTitle('Retention');
  const [acqPeriod, setAcqPeriod] = useState(30)

  const { data: ret, isLoading: retLoading } = useQuery<RetentionData>({
    queryKey: ['marketing-retention'],
    queryFn: () => api.get('/api/marketing/metrics/retention/').then(r => r.data),
  })

  const { data: acq, isLoading: acqLoading } = useQuery<AcquisitionData>({
    queryKey: ['marketing-acquisition', acqPeriod],
    queryFn: () => api.get(`/api/marketing/metrics/acquisition/?period=${acqPeriod}`).then(r => r.data),
  })

  // Pie data: active, churned, other (total - active - churned)
  const total   = ret?.total_students ?? 0
  const active  = ret?.active_students_30d ?? 0
  const churned = ret?.churned_students_30d ?? 0
  const other   = Math.max(total - active - churned, 0)

  const pieData = [
    { name: 'Active (30d)', value: active  },
    { name: 'Churned',      value: churned },
    { name: 'Inactive',     value: other   },
  ].filter(d => d.value > 0)

  const dailySignups = (acq?.daily_signups ?? []).map(d => ({
    ...d, label: shortDate(d.date),
  }))

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-stone-800">Retention & Churn</h1>

      {/* ── Retention KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active students (30d)"
          value={retLoading ? '…' : (ret?.active_students_30d ?? 0).toLocaleString()}
          sub="Logged in at least once"
          icon={UserCheck}
          color="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Churned students (30d)"
          value={retLoading ? '…' : (ret?.churned_students_30d ?? 0).toLocaleString()}
          sub="Active 30–60d ago, gone now"
          icon={TrendingDown}
          color="bg-red-50 text-red-500"
        />
        <MetricCard
          label="Retention rate"
          value={retLoading ? '…' : `${ret?.retention_rate ?? 0}%`}
          sub="Past 30 days"
          icon={RefreshCw}
          color="bg-blue-50 text-blue-600"
        />
        <MetricCard
          label="Total students"
          value={retLoading ? '…' : (ret?.total_students ?? 0).toLocaleString()}
          icon={Users}
          color="bg-stone-100 text-stone-600"
        />
      </div>

      {/* ── Retention pie + churn rate ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Student engagement breakdown</h2>
          {retLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
            </div>
          ) : total === 0 ? (
            <div className="h-48 flex items-center justify-center text-stone-300 text-sm">No student data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={2} dataKey="value"
                  labelLine={false} label={<PieLabel />}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => (v ?? 0).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col items-center justify-center">
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-medium">Churn rate (30d)</p>
          {retLoading ? (
            <div className="h-24 w-24 bg-stone-100 animate-pulse rounded-full" />
          ) : (
            <>
              {/* Simple ring using SVG */}
              <svg viewBox="0 0 120 120" className="w-32 h-32">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1ede8" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={ret?.churn_rate && ret.churn_rate > 15 ? '#ef4444' : ret?.churn_rate && ret.churn_rate > 8 ? '#f59e0b' : '#10b981'}
                  strokeWidth="12"
                  strokeDasharray={`${((ret?.churn_rate ?? 0) / 100) * 314} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="55" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="700" fill="#1c1917">
                  {ret?.churn_rate ?? 0}%
                </text>
                <text x="60" y="74" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#78716c">
                  churn rate
                </text>
              </svg>
              <div className="mt-3 text-center">
                <p className="text-xs text-stone-500">
                  {ret?.churn_rate && ret.churn_rate > 15
                    ? '⚠️ High churn — investigate drop-off reasons'
                    : ret?.churn_rate && ret.churn_rate > 8
                      ? 'Moderate churn — monitor closely'
                      : '✓ Healthy churn rate'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Acquisition: daily signups ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-stone-700">New sign-ups over time</h2>
            {!acqLoading && acq && (
              <p className="text-xs text-stone-400 mt-0.5">{acq.total_signups.toLocaleString()} total in period</p>
            )}
          </div>
          <select
            value={acqPeriod} onChange={e => setAcqPeriod(Number(e.target.value))}
            className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {acqLoading ? (
          <div className="h-52 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : dailySignups.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-stone-300 text-sm">No sign-up data</div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={dailySignups} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ede8" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                formatter={(v: number | undefined) => [v ?? 0, 'Sign-ups']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
              />
              <Bar dataKey="signups" name="Sign-ups" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Role breakdown */}
        {!acqLoading && acq?.by_role && Object.keys(acq.by_role).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 pt-4 border-t border-stone-100">
            {Object.entries(acq.by_role).map(([role, count]) => (
              <div key={role} className="flex items-center gap-1.5 bg-stone-50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-semibold text-stone-700 capitalize">{role.toLowerCase()}</span>
                <span className="text-xs text-stone-400">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

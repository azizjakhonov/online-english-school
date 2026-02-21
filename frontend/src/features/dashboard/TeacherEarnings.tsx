import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, TrendingUp,
  CheckCircle, Clock, Calendar, Wallet,
  BadgeDollarSign
} from 'lucide-react';
import api from '../../lib/api';
import { formatUZS, formatUZSCompact } from '../../lib/formatCurrency';
import { formatDate } from '../../utils/datetime';

// --- TYPES ---
interface EarningsSummary {
  rate_per_lesson_uzs: number;
  payout_day: number;
  current_period_earned_uzs: number;
  pending_payout_uzs: number;
  /** Explicit server-computed aggregate: total_earned - total_paid (≥ 0).
   *  Preferred over pending_payout_uzs for the "Awaiting payout" card. */
  awaiting_payout_uzs: number;
  total_paid_uzs: number;
  next_payout_date: string;
  period_start: string;
}

interface EarningsEvent {
  id: number;
  event_type: string;
  event_label: string;
  amount_uzs: number;
  reason: string;
  lesson_id: number | null;
  payout_ref: string;
  created_at: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  lesson_credit: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  adjustment: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  payout: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  correction: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

export default function TeacherEarnings() {
  const navigate = useNavigate();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [history, setHistory] = useState<EarningsEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get('/api/accounts/earnings/summary/');
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load earnings summary', err);
        setError('Could not load earnings data. Please try again.');
      } finally {
        setSummaryLoading(false);
      }
    };

    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/accounts/earnings/history/');
        setHistory(res.data);
      } catch (err) {
        console.error('Failed to load earnings history', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchSummary();
    fetchHistory();
  }, []);

  // Countdown to next payout
  const daysUntilPayout = summary
    ? Math.max(0, Math.ceil((new Date(summary.next_payout_date).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">

      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Earnings & Payouts</h1>
          <p className="text-slate-500 font-medium">Track your UZS revenue and payout history.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto">

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">

              {/* Rate */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BadgeDollarSign size={22} /></div>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded">Per Lesson</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900">{formatUZSCompact(summary.rate_per_lesson_uzs)}</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Your current rate</p>
              </div>

              {/* Current period earned */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl"><TrendingUp size={22} /></div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">This Period</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900">{formatUZSCompact(summary.current_period_earned_uzs)}</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Since {formatDate(summary.period_start)}</p>
              </div>

              {/* Awaiting payout — uses server-computed aggregate (total_earned - total_paid) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Wallet size={22} /></div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">Pending</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  {formatUZSCompact(summary.awaiting_payout_uzs ?? summary.pending_payout_uzs)}
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Awaiting payout</p>
              </div>

              {/* Next payout countdown */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-blue-600 rounded-xl"><Calendar size={22} /></div>
                  <span className="px-2 py-1 bg-white/10 text-white text-xs font-bold rounded">Next Payout</span>
                </div>
                <h3 className="text-2xl font-black">{daysUntilPayout} days</h3>
                <p className="text-slate-400 text-sm font-medium mt-1">
                  {formatDate(summary.next_payout_date)} (day {summary.payout_day})
                </p>
              </div>
            </div>

            {/* All-time paid */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 mb-8 flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-bold">Total Paid Out (All Time)</p>
                <p className="text-3xl font-black mt-1">{formatUZS(summary.total_paid_uzs)}</p>
              </div>
              <CheckCircle size={48} className="text-white/30" />
            </div>
          </>
        ) : null}

        {/* History Table */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="text-blue-600" /> Event History
          </h3>

          {historyLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Wallet size={48} className="mx-auto mb-4 opacity-40" />
              <p className="font-medium">No earnings events yet.</p>
              <p className="text-sm mt-1">Events appear here when lessons are completed or admin makes adjustments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-sm uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Date</th>
                    <th className="pb-4 font-semibold">Type</th>
                    <th className="pb-4 font-semibold">Reason</th>
                    <th className="pb-4 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map(event => {
                    const style = EVENT_COLORS[event.event_type] || EVENT_COLORS['correction'];
                    const isPositive = event.amount_uzs >= 0;
                    return (
                      <tr key={event.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-medium text-slate-700 whitespace-nowrap">
                          {formatDate(event.created_at)}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                            {event.event_label}
                          </span>
                        </td>
                        <td className="py-4 text-slate-600 text-sm max-w-[200px]">
                          <span className="truncate block">{event.reason || '—'}</span>
                          {event.payout_ref && (
                            <span className="text-xs text-slate-400 mt-0.5 block">Ref: {event.payout_ref}</span>
                          )}
                        </td>
                        <td className="py-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                            {isPositive ? '+' : ''}{formatUZS(event.amount_uzs)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
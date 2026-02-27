import { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header — same pattern as TeacherLessonHistory */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Earnings & Payouts</h1>
            <p className="text-xs text-slate-500 font-medium">Track your UZS revenue and payout history</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Summary cards — same grid/card style as TeacherLessonHistory stats */}
        {summaryLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 size={36} className="animate-spin text-blue-600" />
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl shrink-0 bg-blue-50 text-blue-600"><BadgeDollarSign size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Per Lesson</p>
                  <p className="text-2xl font-black text-slate-900">{formatUZSCompact(summary.rate_per_lesson_uzs)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl shrink-0 bg-green-50 text-green-600"><TrendingUp size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">This Period</p>
                  <p className="text-2xl font-black text-slate-900">{formatUZSCompact(summary.current_period_earned_uzs)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl shrink-0 bg-amber-50 text-amber-600"><Wallet size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Awaiting Payout</p>
                  <p className="text-2xl font-black text-slate-900">{formatUZSCompact(summary.awaiting_payout_uzs ?? summary.pending_payout_uzs)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl shrink-0 bg-indigo-50 text-indigo-600"><Calendar size={20} /></div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Next Payout</p>
                  <p className="text-2xl font-black text-slate-900">{daysUntilPayout} days</p>
                </div>
              </div>
            </div>

            {/* All-time paid — keep as highlight card, align with History palette */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Paid Out (All Time)</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{formatUZS(summary.total_paid_uzs)}</p>
              </div>
              <CheckCircle size={40} className="text-green-500 shrink-0" />
            </div>
          </>
        ) : null}

        {/* History table — same card as TeacherLessonHistory table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" /> Event History
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lessons completed and admin adjustments</p>
          </div>

          {historyLoading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center">
              <Wallet size={48} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No earnings events yet</h3>
              <p className="text-slate-500 text-sm">Events appear here when lessons are completed or admin makes adjustments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-4 py-4 text-left font-semibold">Type</th>
                    <th className="px-4 py-4 text-left font-semibold">Reason</th>
                    <th className="px-4 py-4 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map(event => {
                    const style = EVENT_COLORS[event.event_type] || EVENT_COLORS['correction'];
                    const isPositive = event.amount_uzs >= 0;
                    return (
                      <tr key={event.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 text-sm whitespace-nowrap">{formatDate(event.created_at)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                            {event.event_label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 text-sm max-w-[200px]">
                          <span className="truncate block">{event.reason || '—'}</span>
                          {event.payout_ref && <span className="text-xs text-slate-400 mt-0.5 block">Ref: {event.payout_ref}</span>}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-sm whitespace-nowrap">
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
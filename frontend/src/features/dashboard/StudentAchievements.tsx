import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Medal, Star, Zap, Award, ArrowLeft, Loader2, Lock,
  CheckCircle2, X, Printer, Sparkles
} from 'lucide-react';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Badge {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  milestone: number;
  gradient: string;
  ringColor: string;
  textColor: string;
  certColor: string;
  emoji: string;
}

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES: Badge[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Complete your first lesson.',
    icon: <Zap size={28} />,
    milestone: 1,
    gradient: 'from-amber-400 to-yellow-300',
    ringColor: 'ring-amber-300',
    textColor: 'text-amber-600',
    certColor: '#f59e0b',
    emoji: '⚡',
  },
  {
    id: 'warming-up',
    title: 'Warming Up',
    description: 'Complete 5 lessons.',
    icon: <Star size={28} />,
    milestone: 5,
    gradient: 'from-sky-500 to-blue-400',
    ringColor: 'ring-sky-300',
    textColor: 'text-sky-600',
    certColor: '#0ea5e9',
    emoji: '🌟',
  },
  {
    id: 'dedicated',
    title: 'Dedicated',
    description: 'Complete 10 lessons.',
    icon: <Medal size={28} />,
    milestone: 10,
    gradient: 'from-violet-500 to-purple-400',
    ringColor: 'ring-violet-300',
    textColor: 'text-violet-600',
    certColor: '#8b5cf6',
    emoji: '🏅',
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Complete 20 lessons.',
    icon: <Trophy size={28} />,
    milestone: 20,
    gradient: 'from-emerald-500 to-green-400',
    ringColor: 'ring-emerald-300',
    textColor: 'text-emerald-600',
    certColor: '#10b981',
    emoji: '🏆',
  },
  {
    id: 'master',
    title: 'Master',
    description: 'Complete 50 lessons.',
    icon: <Award size={28} />,
    milestone: 50,
    gradient: 'from-rose-500 to-red-400',
    ringColor: 'ring-rose-300',
    textColor: 'text-rose-600',
    certColor: '#f43f5e',
    emoji: '🎖️',
  },
];

// ── Certificate Modal ─────────────────────────────────────────────────────────
function CertificateModal({
  badge,
  studentName,
  onClose,
}: {
  badge: Badge;
  studentName: string;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Certificate – ${badge.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600&display=swap');
            body { margin: 0; background: #fff; font-family: 'Inter', sans-serif; }
            .cert { width: 900px; margin: 40px auto; padding: 60px; border: 8px solid ${badge.certColor}; border-radius: 24px; text-align: center; background: linear-gradient(135deg, #fffbf0, #fff); }
            .badge-emoji { font-size: 80px; margin-bottom: 16px; }
            h1 { font-family: 'Playfair Display', serif; font-size: 22px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; margin: 0 0 8px; }
            .award-title { font-family: 'Playfair Display', serif; font-size: 56px; font-weight: 700; color: ${badge.certColor}; margin: 0 0 24px; }
            .divider { width: 120px; height: 3px; background: ${badge.certColor}; margin: 0 auto 24px; border-radius: 999px; }
            .presented-to { font-size: 16px; color: #94a3b8; margin-bottom: 8px; }
            .student-name { font-family: 'Playfair Display', serif; font-size: 42px; color: #0f172a; margin-bottom: 32px; font-style: italic; }
            .description { font-size: 16px; color: #475569; margin-bottom: 40px; }
            .date { font-size: 14px; color: #94a3b8; }
            .school { font-size: 18px; font-weight: 600; color: ${badge.certColor}; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="cert">
            <div class="badge-emoji">${badge.emoji}</div>
            <h1>Certificate of Achievement</h1>
            <div class="award-title">${badge.title}</div>
            <div class="divider"></div>
            <p class="presented-to">This certificate is proudly presented to</p>
            <div class="student-name">${studentName}</div>
            <p class="description">${badge.description}</p>
            <p class="date">Awarded on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p class="school">Allright.uz Online School</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className={`bg-gradient-to-r ${badge.gradient} p-8 text-center text-white relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="text-6xl mb-3">{badge.emoji}</div>
          <h2 className="text-2xl font-black">Certificate of Achievement</h2>
          <p className="text-white/80 text-sm mt-1">{badge.title}</p>
        </div>

        {/* Certificate preview (ref for print) */}
        <div ref={printRef} className="p-8 text-center">
          <p className="text-slate-500 text-sm mb-2">This certificate is proudly presented to</p>
          <p className="text-3xl font-black text-slate-900 italic mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            {studentName}
          </p>
          <div className={`w-16 h-1 mx-auto rounded-full bg-gradient-to-r ${badge.gradient} my-4`} />
          <p className="text-slate-600 font-medium mb-1">{badge.description}</p>
          <p className="text-xs text-slate-400 mt-4">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm font-bold mt-1" style={{ color: badge.certColor }}>
            Allright.uz Online School
          </p>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className={`flex-[2] py-3 bg-gradient-to-r ${badge.gradient} text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 hover:opacity-90`}
          >
            <Printer size={16} /> Print Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
import { usePageTitle } from '../../lib/usePageTitle';

export default function StudentAchievements() {
  usePageTitle('Achievements');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lessonCount, setLessonCount] = useState(0);
  const [studentName, setStudentName] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, meRes] = await Promise.all([
          api.get('/api/student/profile/'),
          api.get('/api/me/'),
        ]);

        // Use the backend's pre-computed completed_lessons count from stats.
        // This is already calculated server-side with the correct uppercase 'COMPLETED' status.
        // Fallback: count lesson_history manually (case-insensitive) if stats is missing.
        const completed =
          profileRes.data.stats?.completed_lessons ??
          (profileRes.data.lesson_history || []).filter(
            (l: { status: string }) => l.status.toUpperCase() === 'COMPLETED'
          ).length;

        setLessonCount(completed);
        setStudentName(meRes.data?.full_name || '');

        // Detect newly unlocked (could store previous count in localStorage for animation)
        const prevCount = parseInt(localStorage.getItem('achievements_prev_count') || '0', 10);
        const unlocked = new Set<string>();
        BADGES.forEach((b) => {
          if (completed >= b.milestone && prevCount < b.milestone) {
            unlocked.add(b.id);
          }
        });
        setNewlyUnlocked(unlocked);
        localStorage.setItem('achievements_prev_count', String(completed));
      } catch (err) {
        console.error('Failed to load achievements', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Next milestone info
  const nextBadge = BADGES.find((b) => lessonCount < b.milestone);
  const prevMilestone = nextBadge
    ? (BADGES[BADGES.indexOf(nextBadge) - 1]?.milestone ?? 0)
    : BADGES[BADGES.length - 1].milestone;
  const progressPct = nextBadge
    ? Math.min(100, ((lessonCount - prevMilestone) / (nextBadge.milestone - prevMilestone)) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-300 rounded-xl text-white shadow-md shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Achievements</h1>
            <p className="text-xs text-slate-500 font-medium">Complete lessons to earn badges & certificates</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Stats + Progress Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-300 shadow-lg shadow-amber-200 shrink-0">
                <Medal size={28} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Lessons Completed</p>
                <p className="text-4xl font-black text-slate-900 leading-none">{lessonCount}</p>
              </div>
            </div>

            {nextBadge && (
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500">
                    Next: <span className={nextBadge.textColor}>{nextBadge.title}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {lessonCount} / {nextBadge.milestone}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${nextBadge.gradient} transition-all duration-700`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {nextBadge.milestone - lessonCount} more lesson{nextBadge.milestone - lessonCount !== 1 ? 's' : ''} to unlock
                </p>
              </div>
            )}

            {!nextBadge && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl font-bold text-sm">
                <CheckCircle2 size={18} /> All badges unlocked!
              </div>
            )}
          </div>
        </div>

        {/* Badge Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-blue-600" size={36} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BADGES.map((badge) => {
              const isUnlocked = lessonCount >= badge.milestone;
              const isNew = newlyUnlocked.has(badge.id);

              return (
                <div
                  key={badge.id}
                  className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${isUnlocked
                    ? 'bg-white border-slate-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-default'
                    : 'bg-slate-50 border-slate-200 opacity-70'
                    }`}
                >
                  {/* Glowing top bar for unlocked */}
                  {isUnlocked && (
                    <div className={`h-1 w-full bg-gradient-to-r ${badge.gradient}`} />
                  )}

                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className={`p-3 rounded-2xl ${isUnlocked
                          ? `bg-gradient-to-br ${badge.gradient} shadow-lg`
                          : 'bg-slate-200'
                          }`}
                      >
                        {isUnlocked ? (
                          <span className="text-white">{badge.icon}</span>
                        ) : (
                          <Lock size={24} className="text-slate-400" />
                        )}
                      </div>

                      {isUnlocked && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg flex items-center gap-1">
                            <CheckCircle2 size={11} /> Unlocked
                          </span>
                          {isNew && (
                            <span className="text-xs font-bold bg-amber-100 text-amber-600 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Sparkles size={11} /> New!
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <h3 className={`text-lg font-black mb-0.5 ${isUnlocked ? 'text-slate-900' : 'text-slate-400'}`}>
                      {badge.title}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium mb-4">{badge.description}</p>

                    {/* Milestone chip */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isUnlocked ? `${badge.textColor} bg-slate-50` : 'text-slate-400 bg-slate-100'
                        }`}>
                        {badge.milestone} lesson{badge.milestone !== 1 ? 's' : ''}
                      </span>

                      {isUnlocked && (
                        <button
                          onClick={() => setSelectedBadge(badge)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r ${badge.gradient} text-white shadow-sm hover:opacity-90 transition-all flex items-center gap-1`}
                        >
                          <Trophy size={11} /> Certificate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {selectedBadge && (
        <CertificateModal
          badge={selectedBadge}
          studentName={studentName}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
}
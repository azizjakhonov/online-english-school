import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Medal, Star, Zap, Award, ArrowLeft, Loader2, Lock
} from 'lucide-react';
import api from '../../lib/api';

// Fix: Define Type for Lesson
interface Lesson {
  end_time: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  condition: (lessonCount: number) => boolean;
  color: string;
}

const BADGES: Achievement[] = [
  {
    id: 'first-step', title: 'First Step', description: 'Complete your first lesson.',
    icon: <Zap size={24} />, condition: (n) => n >= 1, color: 'text-yellow-500 bg-yellow-100'
  },
  {
    id: 'warming-up', title: 'Warming Up', description: 'Complete 5 lessons.',
    icon: <Star size={24} />, condition: (n) => n >= 5, color: 'text-blue-500 bg-blue-100'
  },
  {
    id: 'dedicated', title: 'Dedicated', description: 'Complete 10 lessons.',
    icon: <Medal size={24} />, condition: (n) => n >= 10, color: 'text-purple-500 bg-purple-100'
  },
  {
    id: 'scholar', title: 'Scholar', description: 'Complete 20 lessons.',
    icon: <Trophy size={24} />, condition: (n) => n >= 20, color: 'text-green-500 bg-green-100'
  },
  {
    id: 'master', title: 'Master', description: 'Complete 50 lessons.',
    icon: <Award size={24} />, condition: (n) => n >= 50, color: 'text-red-500 bg-red-100'
  },
];

export default function StudentAchievements() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lessonCount, setLessonCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/my-lessons/');
        // Fix: Use Lesson type instead of any
        const completed = res.data.filter((l: Lesson) => new Date(l.end_time) < new Date()).length;
        setLessonCount(completed);
      } catch (err) {
        console.error("Failed to load achievements", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
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
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Achievements</h1>
            <p className="text-xs text-slate-500 font-medium">Track progress and earn badges</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats card — same pattern as TeacherLessonHistory */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <Medal size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Lessons completed</p>
            <p className="text-2xl font-black text-slate-900">{lessonCount}</p>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-auto hidden sm:block">Keep learning to unlock more</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-blue-600" size={36} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BADGES.map((badge) => {
              const isUnlocked = badge.condition(lessonCount);

              return (
                <div
                  key={badge.id}
                  className={`p-5 rounded-2xl border border-slate-200 shadow-sm transition-all relative overflow-hidden ${isUnlocked ? 'bg-white' : 'bg-slate-50 opacity-80'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`p-3 rounded-xl shrink-0 ${isUnlocked ? badge.color : 'bg-slate-200 text-slate-400'}`}>
                      {isUnlocked ? badge.icon : <Lock size={22} />}
                    </div>
                    {isUnlocked && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">Unlocked</span>}
                  </div>

                  <h3 className={`text-lg font-bold mb-1 ${isUnlocked ? 'text-slate-900' : 'text-slate-500'}`}>{badge.title}</h3>
                  <p className="text-sm text-slate-500 font-medium">{badge.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
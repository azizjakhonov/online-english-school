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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Achievements</h1>
            <p className="text-slate-500 font-medium">Track your progress and earn badges.</p>
          </div>
        </header>

        {/* Stats */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Total Lessons Completed</h2>
            <p className="text-slate-500">Keep learning to unlock more!</p>
          </div>
          <div className="text-4xl font-black text-blue-600">{lessonCount}</div>
        </div>

        {/* Badges Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BADGES.map((badge) => {
              const isUnlocked = badge.condition(lessonCount);

              return (
                <div
                  key={badge.id}
                  className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${isUnlocked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-75'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${isUnlocked ? badge.color : 'bg-slate-200 text-slate-400'}`}>
                      {isUnlocked ? badge.icon : <Lock size={24} />}
                    </div>
                    {isUnlocked && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md">Unlocked</span>}
                  </div>

                  <h3 className={`text-xl font-bold mb-1 ${isUnlocked ? 'text-slate-900' : 'text-slate-500'}`}>{badge.title}</h3>
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
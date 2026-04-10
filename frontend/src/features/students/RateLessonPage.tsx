import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Loader2, ChevronLeft, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';

interface LessonInfo {
  teacher_name: string;
  start_time: string;
}

interface ApiError {
  response?: { data?: { error?: string } };
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

import { usePageTitle } from '../../lib/usePageTitle';

export default function RateLessonPage() {
  usePageTitle('Rate Your Lesson');
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lessonInfo, setLessonInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await api.get('/api/my-lessons/');
        const lesson = res.data.find((l: { id: number }) => String(l.id) === lessonId);
        if (lesson) {
          setLessonInfo({ teacher_name: lesson.teacher_name, start_time: lesson.start_time });
        }
      } catch {
        // lesson info is optional; silently ignore
      }
    };
    fetchLesson();
  }, [lessonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/api/lessons/${lessonId}/rate/`, { rating, comment });
      setSubmitted(true);
    } catch (err) {
      const e = err as ApiError;
      setError(e.response?.data?.error || 'Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Thank You!</h2>
          <p className="text-slate-500 text-sm font-medium mb-4">
            Your rating has been submitted. Your feedback helps our teachers improve.
          </p>
          <div className="flex items-center justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={28}
                className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'}
              />
            ))}
          </div>
          <button
            onClick={() => navigate('/student/schedule')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/student/schedule')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-700 mb-6 transition-colors uppercase tracking-widest"
        >
          <ChevronLeft size={16} /> My Schedule
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <h1 className="text-2xl font-black text-slate-900 mb-1">Rate Your Lesson</h1>
          <p className="text-sm text-slate-500 font-medium mb-8">
            {lessonInfo
              ? <>How was your lesson with <span className="font-bold text-slate-700">{lessonInfo.teacher_name}</span>?</>
              : 'How was your lesson?'}
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star rating */}
            <div className="text-center">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Your Rating
              </label>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                  >
                    <Star
                      size={44}
                      className={`transition-colors ${
                        star <= (hovered || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-slate-200 fill-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {(hovered || rating) > 0 && (
                <p className="text-sm font-bold text-slate-700 mt-3 h-5">
                  {RATING_LABELS[hovered || rating]}
                </p>
              )}
              {!hovered && !rating && <p className="text-sm text-slate-400 mt-3 h-5">Tap a star to rate</p>}
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Comment (optional)
              </label>
              <textarea
                rows={3}
                placeholder="Share what you enjoyed or how the lesson could be improved…"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-300 resize-none"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || rating === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Submit Rating'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/student/schedule')}
              className="w-full text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

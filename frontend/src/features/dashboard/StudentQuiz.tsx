import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Loader2, Save
} from 'lucide-react';
import api from '../../lib/api';

interface ApiError {
  response?: { data?: { error?: string } };
}

interface Option {
  id: number;
  text: string;
}

interface Question {
  id: number;
  text: string;
  points: number;
  options: Option[];
}

interface QuizData {
  id: number;
  title: string;
  description: string;
  is_completed: boolean;
  score: number;
  questions: Question[];
}

export default function StudentQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number, total: number } | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/api/homework/assignment/${id}/`);
        setQuiz(res.data);
        if (res.data.is_completed) {
          setResult({ score: res.data.score, total: res.data.total_points || 100 });
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load quiz");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id, navigate]);

  const handleSelect = (questionId: number, optionId: number) => {
    if (quiz?.is_completed) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    const payload = {
      answers: Object.entries(answers).map(([qId, optId]) => ({
        question_id: parseInt(qId),
        option_id: optId
      }))
    };

    if (payload.answers.length < quiz.questions.length) {
      if (!confirm("You haven't answered all questions. Submit anyway?")) return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/api/homework/assignment/${id}/submit/`, payload);
      setResult({ score: res.data.score, total: res.data.total });
      // Update local quiz state to show as completed immediately
      setQuiz(prev => prev ? { ...prev, is_completed: true } : null);
      window.scrollTo(0, 0);
    } catch (error) {
      const err = error as ApiError;
      alert("Error: " + (err.response?.data?.error || "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!quiz) return <div>Quiz not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8 pb-20">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate('/student/homework')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-4 transition-colors">
            <ArrowLeft size={18} /> Back to Homework
          </button>
          <h1 className="text-3xl font-black text-slate-900 mb-2">{quiz.title}</h1>
          <p className="text-slate-500">{quiz.description}</p>
        </div>

        {/* Result Banner */}
        {(result || quiz.is_completed) && (
          <div className="bg-green-100 border border-green-200 p-6 rounded-2xl flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-green-800 text-lg">Quiz Completed!</h3>
              <p className="text-green-700">
                Final Score: <span className="font-black text-2xl ml-1">{result ? result.score : quiz.score} / {result ? result.total : "Total"}</span>
              </p>
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <span className="bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded text-xs mt-1">Q{idx + 1}</span>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{q.text}</h3>
                  <span className="text-xs font-bold text-slate-400">{q.points} points</span>
                </div>
              </div>

              <div className="space-y-2 pl-4">
                {q.options.map((opt) => {
                  const isSelected = answers[q.id] === opt.id;
                  const disabled = quiz.is_completed || !!result;

                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all 
                        ${isSelected
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                        }
                        ${disabled ? 'opacity-70 cursor-not-allowed' : ''}
                      `}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.id}
                        checked={isSelected}
                        onChange={() => handleSelect(q.id, opt.id)}
                        disabled={disabled}
                        className="w-4 h-4 text-blue-600 accent-blue-600"
                      />
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {opt.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        {!(result || quiz.is_completed) && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-slate-300 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              Submit Quiz
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
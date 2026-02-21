import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, BookOpen } from 'lucide-react';
import api from '../../lib/api';

interface Homework {
  id: number;
  title: string;
  level: string;
  created_at: string;
}

interface QuestionOption {
  text: string;
  is_correct: boolean;
}

export default function AdminHomeworks() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [level, setLevel] = useState('A1');
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Question Form State
  const [qText, setQText] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<QuestionOption[]>([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ]);

  // FIX: Standard async function (no useCallback needed)
  const fetchHomeworks = async () => {
    try {
      const res = await api.get('/api/homework/library/');
      setHomeworks(res.data);
    } catch (error) {
      console.error("Failed to fetch homeworks", error);
    }
  };

  // FIX: Run only once on mount
  useEffect(() => {
    fetchHomeworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateHomework = async () => {
    try {
      const res = await api.post('/api/homework/create/', { title, description: desc, level });
      setCreatedId(res.data.id);
      alert("Step 1 Complete: Homework Created. Now add questions.");
    } catch (error) {
      console.error(error);
      alert("Failed to create homework");
    }
  };

  const handleAddQuestion = async () => {
    if (!createdId) return;
    try {
      await api.post(`/api/homework/${createdId}/add_question/`, {
        text: qText,
        question_type: 'SC',
        points: points,
        options: options
      });
      alert("Question Added!");
      // Reset question form
      setQText('');
      setOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }]);
    } catch (error) {
      console.error(error);
      alert("Failed to add question");
    }
  };

  const updateOption = (idx: number, field: keyof QuestionOption, val: string | boolean) => {
    const newOpts = [...options];
    newOpts[idx] = { ...newOpts[idx], [field]: val };
    setOptions(newOpts);
  };

  const handleDelete = async (id: number) => {
    if(!confirm("Delete this homework?")) return;
    try {
        await api.delete(`/api/homework/${id}/delete/`);
        fetchHomeworks();
    } catch (error) {
        console.error(error);
        alert("Failed to delete");
    }
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Homework Builder</h1>
            <p className="text-slate-500">Create and manage your quiz library.</p>
          </div>
          {view === 'list' && (
            <button onClick={() => setView('create')} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
              <Plus size={20}/> Create New
            </button>
          )}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-4">
            {homeworks.map(hw => (
              <div key={hw.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                     <BookOpen size={24}/>
                   </div>
                   <div>
                     <h3 className="font-bold text-lg">{hw.title}</h3>
                     <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">{hw.level}</span>
                   </div>
                </div>
                <button onClick={() => handleDelete(hw.id)} className="text-red-400 hover:text-red-600 p-2">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CREATE VIEW */}
        {view === 'create' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            
            {/* Step 1: Homework Details */}
            <div className="p-8 border-b border-slate-100">
               <h3 className="font-bold text-lg mb-4">1. Quiz Details</h3>
               <div className="grid grid-cols-2 gap-4 mb-4">
                 <input placeholder="Title (e.g. Past Tense)" className="border p-3 rounded-lg" value={title} onChange={e => setTitle(e.target.value)} disabled={!!createdId}/>
                 <input placeholder="Level (A1, B2)" className="border p-3 rounded-lg" value={level} onChange={e => setLevel(e.target.value)} disabled={!!createdId}/>
               </div>
               <textarea placeholder="Description..." className="w-full border p-3 rounded-lg mb-4" value={desc} onChange={e => setDesc(e.target.value)} disabled={!!createdId}></textarea>
               
               {!createdId && (
                 <button onClick={handleCreateHomework} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">
                   Save & Start Adding Questions
                 </button>
               )}
            </div>

            {/* Step 2: Add Questions (Only appears after saving Step 1) */}
            {createdId && (
              <div className="p-8 bg-slate-50">
                <h3 className="font-bold text-lg mb-4">2. Add Question</h3>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                   <input 
                     className="w-full font-bold text-lg border-none outline-none mb-4 placeholder:text-slate-300"
                     placeholder="Type question here..."
                     value={qText}
                     onChange={e => setQText(e.target.value)}
                   />
                   
                   <div className="space-y-3 mb-6">
                     {options.map((opt, i) => (
                       <div key={i} className="flex items-center gap-3">
                         <button 
                           onClick={() => updateOption(i, 'is_correct', !opt.is_correct)}
                           className={`h-6 w-6 rounded-full border flex items-center justify-center transition-colors ${opt.is_correct ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}
                         >
                           {opt.is_correct && <CheckCircle size={14}/>}
                         </button>
                         <input 
                           className="flex-1 border-b border-slate-200 outline-none py-1 text-sm"
                           placeholder={`Option ${i+1}`}
                           value={opt.text}
                           onChange={e => updateOption(i, 'text', e.target.value)}
                         />
                       </div>
                     ))}
                     <button onClick={() => setOptions([...options, {text:'', is_correct:false}])} className="text-xs font-bold text-blue-600">+ Add Option</button>
                   </div>

                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-500">Points:</span>
                        <input type="number" className="w-16 border rounded p-1 text-center" value={points} onChange={e => setPoints(Number(e.target.value))}/>
                     </div>
                     <button onClick={handleAddQuestion} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                       <Plus size={16}/> Add Question
                     </button>
                   </div>
                </div>

                <div className="flex justify-end">
                   <button onClick={() => { setView('list'); setCreatedId(null); fetchHomeworks(); }} className="text-slate-500 font-bold hover:text-slate-900">
                     Done & Return to List
                   </button>
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
}
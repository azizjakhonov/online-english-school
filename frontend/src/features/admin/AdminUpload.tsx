import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, CheckCircle, FileText } from 'lucide-react';

export default function AdminUpload() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    setIsUploading(true);

    // 1. Prepare FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('unit', '1'); // Hardcoded for now, or fetch units dynamically
    formData.append('slides_pdf', file);

    try {
      // 2. Send to Django
      const res = await fetch('http://localhost:8000/api/curriculum/lessons/', {
        method: 'POST',
        headers: {
             'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: formData, // Browser automatically sets Content-Type to multipart/form-data
      });

      if (res.ok) {
        // Success!
        navigate('/admin/lessons');
      } else {
        const errorData = await res.json();
        alert('Upload failed: ' + JSON.stringify(errorData));
        setIsUploading(false);
      }
    } catch (error) {
      console.error(error);
      alert('Network error occurred');
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Upload New Lesson</h1>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Lesson Title</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. Introduction to Physics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* File Dropzone */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
            <input 
              type="file" 
              accept="application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              {file ? (
                <>
                  <FileText className="text-blue-600" size={48} />
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <UploadCloud className="text-slate-400" size={48} />
                  <p className="font-medium text-slate-700">Click to upload PDF</p>
                  <p className="text-sm text-slate-500">Supported format: .pdf only</p>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isUploading || !file}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" /> Processing PDF...
              </>
            ) : (
              <>
                <CheckCircle /> Create Lesson
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
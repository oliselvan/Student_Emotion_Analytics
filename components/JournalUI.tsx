
import React, { useState, useEffect } from 'react';
import { analyzeStudentJournal } from '../services/geminiService';
import { TextSentimentResult, StudentRecord } from '../types';

interface JournalUIProps {
  students: StudentRecord[];
  isStudentView?: boolean;
}

const JournalUI: React.FC<JournalUIProps> = ({ students, isStudentView }) => {
  const [journalText, setJournalText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<TextSentimentResult | null>(null);

  useEffect(() => {
    if (!selectedStudent && students.length > 0) {
      setSelectedStudent(students[0].id);
    }
  }, [students]);

  const handleAnalyze = async () => {
    if (!journalText.trim()) return;
    setIsAnalyzing(true);
    const analysis = await analyzeStudentJournal(journalText);
    if (analysis) {
      setResult(analysis);
    }
    setIsAnalyzing(false);
  };

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4">
        <div className="text-6xl">✍️</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Journal Unavailable</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">
          Sentiment analysis requires at least one registered student. Please add students in the roster tab.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h2 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${isStudentView ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
          <span>✍️</span> {isStudentView ? 'My Reflection Journal' : 'Sentiment Analysis Engine'}
        </h2>
        
        <div className="space-y-6">
          {!isStudentView && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500 dark:text-slate-400">Student Source:</label>
                <select 
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                >
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {isStudentView ? 'How are you feeling today?' : 'Paste Reflection / Essay Segment:'}
            </label>
            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder={isStudentView ? "Write down your thoughts about school, work, or anything on your mind..." : "e.g. I felt really overwhelmed today with the math project..."}
              className="w-full h-48 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !journalText.trim()}
            className={`w-full py-4 rounded-xl text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
              isStudentView 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
            }`}
          >
            {isAnalyzing ? (
              <><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Processing Insights...</>
            ) : (
              isStudentView ? 'Submit Reflection' : 'Analyze Content'
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Analytical Insights</h3>
              <p className="text-slate-500 dark:text-slate-400">Primary Sentiment: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{result.sentiment}</span></p>
            </div>
            {result.interventionRecommended && !isStudentView && (
              <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/50 animate-pulse">
                Intervention Required
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Stress Score</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{result.stressScore}/10</p>
            </div>
            <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Lexical Markers</p>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map(kw => (
                  <span key={kw} className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">
              {isStudentView ? 'What this means:' : 'Synthesized Analysis:'}
            </h4>
            <p className="text-indigo-800 dark:text-indigo-300/80 leading-relaxed text-sm">{result.analysis}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalUI;

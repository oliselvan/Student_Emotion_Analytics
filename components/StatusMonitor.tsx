
import React, { useState } from 'react';
import { StudentRecord } from '../types';

interface StatusMonitorProps {
  students: StudentRecord[];
  onSendFeedback: (id: string, text: string) => void;
  onDrillDown?: (id: string) => void;
}

const StatusMonitor: React.FC<StatusMonitorProps> = ({ students, onSendFeedback, onDrillDown }) => {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [search, setSearch] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState<StudentRecord | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const filtered = students.filter(s => {
    const matchesFilter = filter === 'all' || s.isFlagged;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSend = () => {
    if (feedbackTarget && feedbackText.trim()) {
      onSendFeedback(feedbackTarget.id, feedbackText.trim());
      setFeedbackText('');
      setFeedbackTarget(null);
    }
  };

  const getStatusColor = (score: number) => {
    if (score >= 8) return 'bg-rose-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStatusBg = (score: number) => {
    if (score >= 8) return 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
    if (score >= 5) return 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30';
    return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
  };

  const getStatusText = (score: number) => {
    if (score >= 8) return 'text-rose-700 dark:text-rose-400';
    if (score >= 5) return 'text-amber-700 dark:text-amber-400';
    return 'text-emerald-700 dark:text-emerald-400';
  };

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4">
        <div className="text-6xl text-slate-300">🩺</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Monitor Unavailable</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">
          You need to add students to the roster before you can monitor their status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Status Monitor</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">Direct intervention and wellness tracking.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-full md:w-64"
          />
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('flagged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'flagged' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              At Risk
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(student => {
          const score = student.lastAnalysis?.stressScore || 0;
          return (
            <div key={student.id} className={`p-5 rounded-[2rem] border transition-all hover:shadow-lg ${getStatusBg(score)}`}>
              <div className="flex items-center gap-4 mb-4">
                <img src={student.avatar || null} className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-black/20" alt={student.name} referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{student.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(score)}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusText(score)}`}>
                      {score >= 8 ? 'Critical' : score >= 5 ? 'Warning' : 'Healthy'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter">Emotion</span>
                  <span className="font-black text-slate-800 dark:text-slate-100">{student.lastAnalysis?.emotion || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter">Engagement</span>
                  <span className="font-black text-slate-800 dark:text-slate-100">{student.lastAnalysis?.engagement || 'N/A'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex gap-2">
                <button 
                  onClick={() => setFeedbackTarget(student)}
                  className="flex-1 py-2 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all border border-indigo-100 dark:border-indigo-900"
                >
                  Send Feedback
                </button>
                {onDrillDown && (
                  <button 
                    onClick={() => onDrillDown(student.id)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all"
                  >
                    Details
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback Modal */}
      {feedbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setFeedbackTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Feedback for {feedbackTarget.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">This message will appear on the student's personal dashboard.</p>
            
            <textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. You're doing a great job staying focused today! Take a quick break if you feel tired."
              className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none mb-6"
            />

            <div className="flex gap-3">
              <button onClick={() => setFeedbackTarget(null)} className="flex-1 py-3 text-sm font-bold text-slate-500">Cancel</button>
              <button 
                onClick={handleSend}
                disabled={!feedbackText.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                Post Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusMonitor;

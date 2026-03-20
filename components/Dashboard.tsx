
import React, { useState, useMemo } from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { StudentRecord, EmotionType } from '../types';

interface DashboardProps {
  students: StudentRecord[];
  isStudentView?: boolean;
  onSendFeedback?: (id: string, text: string) => void;
  setActiveTab?: (tab: any) => void;
  onDrillDown?: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, isStudentView, onSendFeedback, setActiveTab, onDrillDown }) => {
  const [feedbackTarget, setFeedbackTarget] = useState<StudentRecord | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

  // --- Aggregate Data Calculations ---
  const classStats = useMemo(() => {
    if (students.length === 0) return null;

    const analyzedStudents = students.filter(s => s.lastAnalysis);
    if (analyzedStudents.length === 0) return null;

    const totalStress = analyzedStudents.reduce((acc, s) => acc + (s.lastAnalysis?.stressScore || 0), 0);
    const avgStress = (totalStress / analyzedStudents.length).toFixed(1);

    const emotionCounts: Record<string, number> = {};
    analyzedStudents.forEach(s => {
      const e = s.lastAnalysis?.emotion || 'Unknown';
      emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    });

    const primaryEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral';

    return {
      avgStress: parseFloat(avgStress),
      primaryEmotion,
      totalCount: analyzedStudents.length
    };
  }, [students]);

  const highStressStudents = useMemo(() => 
    students.filter(s => s.lastAnalysis && s.lastAnalysis.stressScore >= 7),
    [students]
  );

  const emotionData = useMemo(() => [
    { name: 'Happy', count: students.filter(s => s.lastAnalysis?.emotion === EmotionType.HAPPY).length },
    { name: 'Neutral', count: students.filter(s => s.lastAnalysis?.emotion === EmotionType.NEUTRAL).length },
    { name: 'Focused', count: students.filter(s => s.lastAnalysis?.engagement === 'High').length },
    { name: 'Concern', count: highStressStudents.length },
  ], [students, highStressStudents]);

  const trendData = useMemo(() => {
    if (isStudentView && students[0]?.history?.length > 0) {
      return students[0].history.map((h, i) => ({ time: `Scan ${i + 1}`, value: h.stressScore }));
    }
    return [
      { time: 'T1', value: 0 }, { time: 'T2', value: 0 }, { time: 'T3', value: 0 }
    ];
  }, [isStudentView, students]);

  const handleQuickFeedback = () => {
    if (feedbackTarget && feedbackText.trim() && onSendFeedback) {
      onSendFeedback(feedbackTarget.id, feedbackText.trim());
      setFeedbackText('');
      setFeedbackTarget(null);
    }
  };

  if (students.length === 0 && !isStudentView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center animate-in zoom-in-95 duration-500">
        <div className="text-9xl mb-4">🏫</div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Your Classroom is Empty</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-lg leading-relaxed">
            Start by adding students to your class roster or import a previously saved database backup.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button 
              onClick={() => setActiveTab && setActiveTab('roster')}
              className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-bold shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
            >
              Go to Class Roster
            </button>
            <button 
              onClick={() => setActiveTab && setActiveTab('settings')}
              className="px-8 py-4 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-[2rem] font-bold shadow-md hover:bg-slate-50 transition-all active:scale-95"
            >
              Import Backup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {isStudentView ? `Welcome back, ${students[0]?.name}!` : 'Class Insight Engine'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">
            {isStudentView ? 'Monitoring your personal mindful learning journey.' : 'Class-wide aggregate analysis for the current session.'}
          </p>
        </div>
      </div>

      {!isStudentView && highStressStudents.length > 0 && (
        <section className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-[2.5rem] p-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-rose-800 dark:text-rose-400 font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <span>⚠️</span> Critical Focus: High Stress Levels
            </h3>
            <span className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-full">
              {highStressStudents.length} ALERTS
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highStressStudents.map(s => (
              <div key={s.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-rose-100 dark:border-rose-800/50 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group/avatar">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-rose-500 to-orange-500 rounded-2xl blur opacity-25 group-hover/avatar:opacity-50 transition duration-500"></div>
                    <img src={s.avatar || null} className="relative w-12 h-12 rounded-2xl bg-slate-50 border-2 border-white dark:border-slate-800 object-cover shadow-sm transition-transform duration-300 group-hover/avatar:scale-105" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{s.name}</h4>
                    <p className="text-xs font-black text-rose-600 uppercase">Stress Score: {s.lastAnalysis?.stressScore}/10</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2 mb-4">
                  "{s.lastAnalysis?.summary}"
                </p>
                <button 
                  onClick={() => setFeedbackTarget(s)}
                  className="w-full py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 dark:shadow-none"
                >
                  Quick Respond
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold mb-6 text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {isStudentView ? 'Personal Stress Trend' : 'Emotion Distribution'}
            </h3>
            <div className="h-64">
              {isStudentView ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorArea)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emotionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {emotionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {!isStudentView && (
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {emotionData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isStudentView ? (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-6 flex items-center gap-2">
                  <span>📬</span> Teacher Feedback
                </h3>
                {students[0]?.feedback && students[0].feedback.length > 0 ? (
                  <div className="space-y-4">
                    {students[0].feedback.slice(0, 2).map(msg => (
                      <div key={msg.id} className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20">
                        <p className="text-lg font-medium leading-relaxed italic">"{msg.text}"</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest mt-2 text-white/60">{msg.date}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 italic">No feedback messages yet. Keep up the good work!</p>
                )}
              </div>
              <div className="absolute top-0 right-0 p-8 text-8xl opacity-10">💬</div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Class Roster Status</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {students.slice(0, 10).map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => onDrillDown && onDrillDown(s.id)}
                            className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 ${onDrillDown ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <img src={s.avatar || null} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 object-cover" referrerPolicy="no-referrer" />
                                    {s.lastAnalysis?.stressScore && s.lastAnalysis.stressScore > 7 && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
                                    )}
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{s.name}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                                s.lastAnalysis?.stressScore && s.lastAnalysis.stressScore > 7 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {s.lastAnalysis?.emotion || 'Waiting'}
                            </div>
                        </div>
                    ))}
                    {students.length > 10 && <p className="text-center text-[10px] text-slate-400 font-bold uppercase py-2">And {students.length - 10} more...</p>}
                </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {!isStudentView ? (
            /* CLASS AGGREGATE CARD (TEACHER VIEW) */
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-inner">
                👥
              </div>
              <h4 className="font-black text-2xl dark:text-white mb-1">Class Wellness</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aggregate Pulse</p>
              
              <div className="w-full space-y-4 mt-8">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Average Stress</p>
                  <p className={`text-3xl font-black ${
                    (classStats?.avgStress || 0) > 6 ? 'text-rose-600' : 
                    (classStats?.avgStress || 0) > 3 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {classStats?.avgStress || '0.0'}
                  </p>
                </div>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Dominant Emotion</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {classStats?.primaryEmotion || 'Neutral'}
                  </p>
                </div>

                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none">
                  <p className="text-[10px] uppercase font-black opacity-70 mb-1">Active Monitoring</p>
                  <p className="text-xl font-bold">{classStats?.totalCount || 0} Students Scanned</p>
                </div>
              </div>
            </div>
          ) : (
            /* INDIVIDUAL PROFILE CARD (STUDENT VIEW) */
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center">
              <div className="relative inline-block mb-4">
                <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] blur-md opacity-20 animate-pulse"></div>
                <img src={students[0]?.avatar || null} className="relative w-24 h-24 rounded-[2rem] mx-auto border-4 border-white dark:border-slate-800 shadow-2xl object-cover" referrerPolicy="no-referrer" />
              </div>
              <h4 className="font-black text-2xl dark:text-white">{students[0]?.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Status: Logged In</p>
              
              <div className="grid grid-cols-2 gap-2 mt-6">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Emotion</p>
                  <p className="font-bold text-indigo-600">{students[0]?.lastAnalysis?.emotion || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Stress</p>
                  <p className="font-bold text-rose-600">{students[0]?.lastAnalysis?.stressScore || 0}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-800/30">
            <h5 className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-widest mb-2">
                {isStudentView ? 'My Engagement' : 'Class Engagement'}
            </h5>
            <p className="text-emerald-900 dark:text-emerald-200 text-xl font-bold">
              {isStudentView ? (students[0]?.lastAnalysis?.engagement || 'Unmeasured') : 'Stabilized'}
            </p>
          </div>
        </div>
      </div>

      {feedbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setFeedbackTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Respond to {feedbackTarget.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Send a reassuring message based on the recent stress alert.</p>
            
            <textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. I noticed you might be feeling a bit overwhelmed. Would you like to take a 5-minute breather?"
              className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 transition-all resize-none mb-6"
            />

            <div className="flex gap-3">
              <button onClick={() => setFeedbackTarget(null)} className="flex-1 py-3 text-sm font-bold text-slate-500">Cancel</button>
              <button 
                onClick={handleQuickFeedback}
                disabled={!feedbackText.trim()}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700 disabled:opacity-50 transition-all"
              >
                Send Support
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

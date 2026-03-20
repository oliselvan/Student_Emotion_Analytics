
import React, { useState, useRef } from 'react';
import { StudentRecord } from '../types';
import { generateAIAvatar } from '../services/geminiService';

interface ProfileSetupProps {
  student: StudentRecord;
  teacherEmail: string;
  onComplete: (name: string, avatar: string, gender: 'male' | 'female' | 'other') => void;
  onLogout: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ student, teacherEmail, onComplete, onLogout }) => {
  const [name, setName] = useState(student.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(student.gender || '');
  const [avatar, setAvatar] = useState(student.avatar || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAIGen = async () => {
    if (!name) {
      alert("Please enter your name first!");
      return;
    }
    if (!gender) {
      alert("Please select your gender first!");
      return;
    }
    setIsGenerating(true);
    const newAvatar = await generateAIAvatar(name, gender);
    if (newAvatar) setAvatar(newAvatar);
    setIsGenerating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = () => {
    if (!name || !avatar || !gender) {
      alert("Please provide your name, gender, and a profile photo.");
      return;
    }
    onComplete(name, avatar, gender as any);
  };

  if (!hasAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617] p-6 animate-in fade-in duration-1000">
        <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="bg-indigo-600 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-wrap gap-8 p-4">
              {Array.from({length: 20}).map((_,i) => <span key={i} className="text-4xl">📩</span>)}
            </div>
            <div className="relative z-10 space-y-4">
              <span className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Classroom Access</span>
              <h2 className="text-4xl font-black tracking-tight">Welcome!</h2>
              <p className="text-white/80 font-medium">Your educator has added you to their Sentient Learning environment.</p>
            </div>
          </div>
          <div className="p-12 text-center space-y-10">
            <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classroom Educator</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{teacherEmail}</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => setHasAccepted(true)}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
              >
                Enter Classroom
              </button>
              <button onClick={onLogout} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                Not your class? Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617] p-6 animate-in slide-in-from-right-8 duration-700">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row">
        
        <div className="md:w-64 bg-slate-900 dark:bg-indigo-900/40 p-10 text-white flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-black mb-2">Setup</h2>
            <p className="text-white/50 text-sm">Identity profile for {teacherEmail}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Signed in as</p>
            <p className="text-xs font-bold truncate opacity-80">{student.email?.endsWith('.local') ? student.name : student.email}</p>
          </div>
        </div>

        <div className="flex-1 p-10 md:p-14 space-y-10">
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Introduce Yourself</h3>
            <p className="text-slate-500 text-sm">Create a recognizable profile for the class dashboard.</p>
          </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:border-indigo-600 transition-all font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  <div className="flex gap-2">
                    {['male', 'female', 'other'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g as any)}
                        className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold capitalize ${
                          gender === g 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                            : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Digital Representation</label>
              <div className="flex items-center gap-6">
                <div className="relative group/avatar w-24 h-24">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2rem] blur opacity-20 group-hover/avatar:opacity-40 transition duration-500"></div>
                  <div className="relative w-24 h-24 rounded-[2rem] bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
                    {avatar ? <img src={avatar} className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" alt="" referrerPolicy="no-referrer" /> : <span className="text-2xl opacity-20">📸</span>}
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Upload</button>
                    <button onClick={handleAIGen} disabled={isGenerating} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                      {isGenerating ? '✨ ...' : '✨ AI Avatar'}
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                </div>
              </div>
            </div>

            <button onClick={handleFinish} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
              Join Classroom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;

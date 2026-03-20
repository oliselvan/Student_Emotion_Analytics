
import React, { useState } from 'react';
import { StudentRecord } from '../types';

interface StudentRosterProps {
  students: StudentRecord[];
  teacherEmail: string;
  onAddStudent: (name: string, gender: 'male' | 'female' | 'other', password?: string, email?: string) => void;
  onUpdateStudent: (id: string, updates: Partial<StudentRecord>) => void;
  onDeleteStudent: (id: string) => void;
  onSendFeedback: (id: string, text: string) => void;
  onDrillDown?: (id: string) => void;
}

const StudentRoster: React.FC<StudentRosterProps> = ({ students, teacherEmail, onAddStudent, onDeleteStudent, onSendFeedback, onDrillDown }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredStudents = students.filter(s => 
    (s.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) || 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentPassword.trim() || !newStudentGender) {
      alert("Please fill in name, password, and select a gender.");
      return;
    }
    
    setIsProcessing(true);
    onAddStudent(newStudentName.trim(), newStudentGender as any, newStudentPassword.trim(), newStudentEmail.trim() || undefined);
    
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentPassword('');
    setNewStudentGender('');
    setIsModalOpen(false);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Classroom Roster</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">Manage students and their access credentials.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input 
            type="text" placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="px-6 py-3.5 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-slate-900 dark:text-white transition-all shadow-sm md:w-80 font-medium"
          />
          <button 
            onClick={() => { setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl flex items-center gap-2 active:scale-95"
          >
            <span>Add Student</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <div key={student.id} className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 transition-all relative group ${student.isProfileComplete ? 'border-slate-100 dark:border-slate-800' : 'border-dashed border-slate-300 dark:border-slate-700'}`}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDeleteStudent(student.id);
              }} 
              className="absolute top-6 right-6 p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all z-10"
              title="Delete Student"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="relative group/avatar">
                <img 
                  src={student.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student.name)}`} 
                  className="w-16 h-16 rounded-3xl object-cover shadow-2xl ring-4 ring-white dark:ring-slate-800 transition-transform duration-300 group-hover/avatar:scale-110" 
                  alt="" 
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 ${student.isProfileComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-800 dark:text-white truncate text-lg">{student.name}</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{student.email || 'Password Login'}</p>
              </div>
            </div>
            <div className="space-y-4 mb-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Access Password</span>
                <span className="text-indigo-500 font-mono">{student.password || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Profile Status</span>
                <span className={student.isProfileComplete ? 'text-emerald-500' : 'text-amber-500'}>{student.isProfileComplete ? 'Verified' : 'Pending'}</span>
              </div>
            </div>
            {onDrillDown && (
              <button 
                onClick={() => onDrillDown(student.id)}
                className="w-full py-3 bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-50 dark:border-indigo-900/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
              >
                View Individual Dashboard
              </button>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Add Student</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">Create a student account with a name and password. They will use these to log in.</p>
            <form onSubmit={handleAddStudentSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Student Name</label>
                <input 
                  type="text" autoFocus required value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="John Doe"
                  className="w-full p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:border-indigo-600 transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Student Email (Optional)</label>
                <input 
                  type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="john@example.com"
                  className="w-full p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:border-indigo-600 transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                <div className="flex gap-2">
                  {['male', 'female', 'other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNewStudentGender(g as any)}
                      className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold capitalize text-xs ${
                        newStudentGender === g 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                          : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Password</label>
                <input 
                  type="text" required value={newStudentPassword} onChange={(e) => setNewStudentPassword(e.target.value)} placeholder="Secret123"
                  className="w-full p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white outline-none focus:border-indigo-600 transition-all font-bold font-mono"
                />
              </div>
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                {isProcessing ? 'Processing...' : 'Add to Roster'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentRoster;

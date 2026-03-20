
import React, { useRef, useState } from 'react';
import { UserRole, StudentRecord } from '../types';
import { generateAIAvatar } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface SettingsProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  userRole: UserRole;
  student?: StudentRecord | null;
  onUpdateStudent?: (id: string, updates: Partial<StudentRecord>) => void;
  onResetDatabase?: () => void;
  onImportDatabase?: (students: StudentRecord[]) => void;
  allStudents?: StudentRecord[];
  userEmail: string;
}

const Settings: React.FC<SettingsProps> = ({ 
  theme, 
  setTheme, 
  userRole, 
  student, 
  onUpdateStudent, 
  onResetDatabase, 
  onImportDatabase,
  allStudents = [],
  userEmail
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbImportRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && student && onUpdateStudent) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateStudent(student.id, { avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = () => {
    storageService.exportToJSON(allStudents, userEmail);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportDatabase) {
      try {
        const imported = await storageService.importFromJSON(file, userEmail);
        onImportDatabase(imported);
        alert(`Imported ${imported.length} records to ${userEmail}`);
      } catch (err) {
        alert("Import failed. Check file format.");
      }
    }
  };

  const handleAIGen = async () => {
    if (student && onUpdateStudent) {
      setIsGenerating(true);
      const newAvatar = await generateAIAvatar(student.name, student.gender);
      if (newAvatar) {
        onUpdateStudent(student.id, { avatar: newAvatar });
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">System Configuration</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium italic">Identity: <span className="text-indigo-600 dark:text-indigo-400 not-italic">{userEmail}</span></p>
      </div>

      {userRole === UserRole.STUDENT && student && (
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Digital Avatar</h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative group/avatar">
              <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur-lg opacity-20 group-hover/avatar:opacity-40 transition duration-700"></div>
              <img src={student.avatar || null} className="relative w-32 h-32 rounded-[2.5rem] bg-white dark:bg-slate-800 shadow-2xl border-4 border-white dark:border-slate-800 object-cover transition-transform duration-500 group-hover/avatar:scale-105" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                Personalize your presence. Upload a real photo or use the "AI Avatar" button to generate a stylized clay-style 3D character.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  📷 Upload Photo
                </button>
                <button 
                  onClick={handleAIGen}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
                >
                  {isGenerating ? '✨ Magic in progress...' : '✨ AI Avatar'}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <section>
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Display Theme</h3>
          <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Classroom Ambience</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Light mode for focus, dark mode for late-night grading.</p>
            </div>
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setTheme('light')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                ☀️ Light
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </section>

        {userRole === UserRole.TEACHER && (
          <section className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Local Intelligence & Privacy</h3>
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">📦</span>
                  <div className="flex-1">
                    <p className="font-bold text-indigo-900 dark:text-indigo-300">Namespaced Backup</p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400/80 mb-6 leading-relaxed">
                      Your database is isolated to <strong>{userEmail}</strong>. Export to move your classroom to another machine, or Import to restore a previous roster.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={handleExport}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                      >
                        📥 Export DB
                      </button>
                      <button 
                        onClick={() => dbImportRef.current?.click()}
                        className="px-6 py-2.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                      >
                        📤 Import Backup
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm("Force a full cloud sync? This will overwrite the cloud database with your current local data.")) {
                            try {
                              await storageService.saveStudents(userEmail, allStudents);
                              alert("Full sync complete!");
                            } catch (e) {
                              alert("Sync failed. Check connection.");
                            }
                          }
                        }}
                        className="px-6 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95"
                      >
                        🔄 Force Full Sync
                      </button>
                      <input type="file" ref={dbImportRef} className="hidden" accept=".json" onChange={handleImport} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">🧨</span>
                  <div className="flex-1">
                    <p className="font-bold text-rose-900 dark:text-rose-300">Account Deletion</p>
                    <p className="text-xs text-rose-700 dark:text-rose-400/80 mb-4">
                      Wiping your database will permanently remove all data associated with <strong>{userEmail}</strong> from this browser.
                    </p>
                    <button 
                      onClick={onResetDatabase}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all active:scale-95 shadow-sm"
                    >
                      Factory Reset Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;

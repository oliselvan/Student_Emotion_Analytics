
import React from 'react';
import { UserRole } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'capture' | 'roster' | 'journals' | 'settings' | 'status' | 'chat';
  setActiveTab: (tab: 'dashboard' | 'capture' | 'roster' | 'journals' | 'settings' | 'status' | 'chat') => void;
  onLogout: () => void;
  userRole: UserRole;
  userEmail: string;
  studentAvatar?: string;
  studentName?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, userRole, userEmail, studentAvatar, studentName }) => {
  const allTabs = [
    { id: 'dashboard', label: userRole === UserRole.TEACHER ? 'Overview' : 'My Progress', icon: '📊', roles: [UserRole.TEACHER, UserRole.STUDENT] },
    { id: 'status', label: 'Status Monitor', icon: '🩺', roles: [UserRole.TEACHER] },
    { id: 'roster', label: 'Class Roster', icon: '👥', roles: [UserRole.TEACHER] },
    { id: 'capture', label: 'Visual Check-in', icon: '📷', roles: [UserRole.STUDENT] },
    { id: 'journals', label: 'Journal Analysis', icon: '✍️', roles: [UserRole.STUDENT] },
    { id: 'chat', label: 'Peer Chat', icon: '💬', roles: [UserRole.STUDENT] },
    { id: 'settings', label: 'Settings', icon: '⚙️', roles: [UserRole.TEACHER, UserRole.STUDENT] },
  ];

  const filteredTabs = allTabs.filter(tab => tab.roles.includes(userRole));

  return (
    <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full transition-colors duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
          <span className="text-3xl">🧠</span> SLP
        </h1>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
          {userRole === UserRole.TEACHER ? 'Educator Hub' : 'Student Hub'}
        </p>
      </div>

      {userRole === UserRole.STUDENT && (
        <div className="px-6 pb-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <img 
              src={studentAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(studentName || userEmail)}`} 
              className="w-10 h-10 rounded-xl object-cover shadow-md ring-2 ring-white dark:ring-slate-700" 
              alt="" 
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-white truncate">{studentName || 'Student'}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1">
        {filteredTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === tab.id
                ? userRole === UserRole.TEACHER 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 space-y-4">
        {/* Auto-backup Indicator */}
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center gap-2 border border-emerald-100 dark:border-emerald-800">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Auto-Backup Active</span>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all font-semibold"
        >
          <span className="text-xl">🚪</span> Logout
        </button>
        <div className="text-center px-2">
          <p className="text-[10px] text-slate-400 font-medium leading-tight">Sentient Learning Platform © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

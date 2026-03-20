
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CaptureUI from './components/CaptureUI';
import JournalUI from './components/JournalUI';
import StudentRoster from './components/StudentRoster';
import Settings from './components/Settings';
import Login from './components/Login';
import StatusMonitor from './components/StatusMonitor';
import StudentChat from './components/StudentChat';
import ProfileSetup from './components/ProfileSetup';
import { storageService, safeLocalStorage } from './services/storageService';
import { chatService } from './services/chatService';
import { generateAIAvatar } from './services/geminiService';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { StudentRecord, EmotionalAnalysis, UserRole, Conversation } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Teacher or Student logged in via Firebase Auth
        // For custom tokens, user.email might be null, so we fallback to stored email
        const email = user.email || safeLocalStorage.getItem('userEmail') || '';
        const role = (safeLocalStorage.getItem('userRole') as UserRole) || UserRole.TEACHER;
        
        setUserEmail(email);
        setUserRole(role);
        setIsLoggedIn(true);
        
        if (role === UserRole.TEACHER) {
          setTeacherNamespace(email);
        } else {
          // Student logged in via Email/Google - No longer supported
          // We clear the session to force password login
          await signOut(auth);
          setIsLoggedIn(false);
          setUserRole(null);
        }
      } else {
        // Check for student password session
        const wasLoggedIn = safeLocalStorage.getItem('isLoggedIn') === 'true';
        const storedRole = safeLocalStorage.getItem('userRole') as UserRole;
        if (wasLoggedIn && storedRole === UserRole.STUDENT) {
          setIsLoggedIn(true);
          setUserRole(UserRole.STUDENT);
          setUserEmail(safeLocalStorage.getItem('userEmail') || '');
          setTeacherNamespace(safeLocalStorage.getItem('teacherNamespace') || '');
          setCurrentStudentId(safeLocalStorage.getItem('currentStudentId') || null);
        } else {
          setIsLoggedIn(false);
          setUserRole(null);
        }
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);
  const currentStudentIdRef = React.useRef(currentStudentId);
  useEffect(() => { currentStudentIdRef.current = currentStudentId; }, [currentStudentId]);
  const [teacherNamespace, setTeacherNamespace] = useState<string>(() => safeLocalStorage.getItem('teacherNamespace') || '');
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'capture' | 'roster' | 'journals' | 'settings' | 'status' | 'chat'>('dashboard');
  const activeTabRef = React.useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Drill-down state for teachers
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const studentsRef = React.useRef(students);
  useEffect(() => { studentsRef.current = students; }, [students]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (safeLocalStorage.getItem('theme') as 'light' | 'dark') || 'light');
  
  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentStudentId(null);
    setSelectedStudentId(null);
    setUserEmail('');
    setTeacherNamespace('');
    safeLocalStorage.removeItem('isLoggedIn');
    safeLocalStorage.removeItem('userRole');
    safeLocalStorage.removeItem('currentStudentId');
    safeLocalStorage.removeItem('userEmail');
    safeLocalStorage.removeItem('teacherNamespace');
    setStudents([]);
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    if (!teacherNamespace) {
      setStudents([]);
      setIsInitialized(false);
      return;
    }

    setIsInitialized(false);
    
    // Load from local storage immediately for instant feel
    const localData = safeLocalStorage.getItem(`slp_backup_${teacherNamespace}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          setStudents(parsed);
          setIsInitialized(true);
        }
      } catch (e) {
        console.error("Failed to load local backup:", e);
      }
    }

    const unsubscribe = storageService.subscribeToStudents(teacherNamespace, (updatedStudents) => {
      setStudents(prev => {
        // Merge existing conversations to prevent race condition wipe
        return updatedStudents.map(newS => {
          const existingS = prev.find(ps => ps.id === newS.id);
          return {
            ...newS,
            conversations: existingS?.conversations || newS.conversations || []
          };
        });
      });
      
      // Check if current student still exists
      if (currentStudentIdRef.current && !updatedStudents.find(s => s.id === currentStudentIdRef.current)) {
        // Only logout if we are sure the data is loaded and the student is truly missing
        // (Firestore snapshot might be empty initially if it's the first load)
        if (updatedStudents.length > 0) {
          console.warn("Current student not found in updated roster, logging out...");
          handleLogout();
        }
      }
      
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [teacherNamespace, handleLogout]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    safeLocalStorage.setItem('theme', theme);
  }, [theme]);

  // Guard against unauthorized tab access
  useEffect(() => {
    if (!userRole) return;
    
    const teacherTabs = ['dashboard', 'roster', 'status', 'settings'];
    const studentTabs = ['dashboard', 'capture', 'journals', 'chat', 'settings'];
    
    if (userRole === UserRole.TEACHER && !teacherTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    } else if (userRole === UserRole.STUDENT && !studentTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, userRole]);

  // Remove the redundant auto-save useEffect that saves the entire collection.
  // We now rely on granular updates in the handlers below.
  
  const handleLogin = useCallback(async (role: UserRole, email: string, name?: string, picture?: string, password?: string, teacherEmail?: string, studentId?: string) => {
    setIsInitialized(false);
    
    const normalizedTeacherEmail = teacherEmail?.toLowerCase().trim();
    const normalizedUserEmail = email.toLowerCase().trim();

    if (role === UserRole.STUDENT && normalizedTeacherEmail) {
      // If we already have a studentId (from server-side login), use it directly
      if (studentId) {
        setUserEmail(normalizedUserEmail);
        setUserRole(role);
        setIsLoggedIn(true);
        setTeacherNamespace(normalizedTeacherEmail);
        setCurrentStudentId(studentId);
        
        safeLocalStorage.setItem('isLoggedIn', 'true');
        safeLocalStorage.setItem('userRole', role);
        safeLocalStorage.setItem('userEmail', normalizedUserEmail);
        safeLocalStorage.setItem('teacherNamespace', normalizedTeacherEmail);
        safeLocalStorage.setItem('currentStudentId', studentId);
        
        await storageService.saveAccountInfo(normalizedUserEmail, role, name, picture);
        return;
      }

      // Custom Password Login (Legacy fallback)
      if (password) {
        try {
          const found = await storageService.getStudentByName(normalizedTeacherEmail, name || '');
          
          if (!found) {
            throw new Error(`Student "${name}" not found in classroom "${normalizedTeacherEmail}". \n\nTips:\n1. Check the spelling of your name.\n2. Ensure the Teacher Email is exactly what your teacher provided.\n3. Ask your teacher if they have added you to the roster.`);
          }
          if (String(found.password || '').trim() !== String(password || '').trim()) {
            throw new Error(`Incorrect password.`);
          }

          const studentEmail = found.email || `${found.name.replace(/\s+/g, '.').toLowerCase()}@slp.local`;
          
          setUserEmail(studentEmail);
          setUserRole(role);
          setIsLoggedIn(true);
          setTeacherNamespace(normalizedTeacherEmail);
          setCurrentStudentId(found.id);
          
          safeLocalStorage.setItem('isLoggedIn', 'true');
          safeLocalStorage.setItem('userRole', role);
          safeLocalStorage.setItem('userEmail', studentEmail);
          safeLocalStorage.setItem('teacherNamespace', normalizedTeacherEmail);
          safeLocalStorage.setItem('currentStudentId', found.id);
          
          await storageService.saveAccountInfo(studentEmail, role, found.name, found.avatar);
          return;
        } catch (error: any) {
          throw error;
        }
      }
    }

    // Teacher or Student via Firebase Auth (already signed in via Login.tsx)
    setUserEmail(normalizedUserEmail);
    setUserRole(role);
    setIsLoggedIn(true);
    safeLocalStorage.setItem('isLoggedIn', 'true');
    safeLocalStorage.setItem('userRole', role);
    safeLocalStorage.setItem('userEmail', normalizedUserEmail);

    await storageService.saveAccountInfo(normalizedUserEmail, role, name, picture);

    if (role === UserRole.TEACHER) {
      setTeacherNamespace(normalizedUserEmail);
      safeLocalStorage.setItem('teacherNamespace', normalizedUserEmail);
    }
  }, [teacherNamespace, userEmail]);

  const handleAddStudent = async (name: string, gender: 'male' | 'female' | 'other', password?: string, email?: string) => {
    // Initial placeholder based on gender using Lorelei style (more modern/aesthetic)
    const placeholderAvatar = gender === 'male' 
      ? `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}&hair=short01,short02,short03,short04,short05&backgroundColor=b6e3f4,c0aede,d1d4f9`
      : gender === 'female'
        ? `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}&hair=long01,long02,long03,long04,long05&backgroundColor=ffdfbf,ffd5dc,f1f4dc`
        : `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc,f1f4dc`;

    const newStudent: StudentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      gender,
      password,
      avatar: placeholderAvatar,
      isProfileComplete: !!password,
      history: [],
      isFlagged: false,
      feedback: [],
      conversations: []
    };
    
    setStudents(prev => [...prev, newStudent]);
    
    // Explicit save for immediate feedback
    if (teacherNamespace) {
      setIsSaving(true);
      storageService.addStudent(teacherNamespace, newStudent)
        .catch(error => console.error("Failed to add student to Firestore:", error))
        .finally(() => setIsSaving(false));
    }

    // Try to generate a better AI avatar in the background
    generateAIAvatar(name, gender).then(aiAvatar => {
      if (aiAvatar) {
        handleUpdateStudent(newStudent.id, { avatar: aiAvatar });
      }
    });
  };

  const handleDeleteStudent = async (id: string) => {
    console.log("Deleting student:", id);
    setStudents(prev => prev.filter(s => s.id !== id));
    
    if (teacherNamespace) {
      setIsSaving(true);
      try {
        await storageService.deleteStudent(teacherNamespace, id);
      } catch (e) {
        console.error("Delete failed:", e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleUpdateStudent = async (id: string, updates: Partial<StudentRecord>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    
    if (teacherNamespace) {
      setIsSaving(true);
      // Non-blocking update for instant feel
      storageService.updateStudent(teacherNamespace, id, updates)
        .finally(() => setIsSaving(false));
    }
  };

  const handleAnalysisResult = async (studentId: string, analysis: EmotionalAnalysis) => {
    const updates = { 
      lastAnalysis: analysis, 
      isFlagged: analysis.stressScore >= 7 
    };
    
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const history = [...s.history, analysis];
        return { ...s, ...updates, history };
      }
      return s;
    }));

    if (teacherNamespace) {
      setIsSaving(true);
      // Use efficient append instead of sending full history
      storageService.appendToStudentHistory(teacherNamespace, studentId, analysis)
        .finally(() => setIsSaving(false));
    }
  };

  const handleSendFeedback = async (id: string, text: string) => {
    const feedbackItem = { id: Math.random().toString(36).substr(2, 9), text, date: new Date().toLocaleString() };
    
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, feedback: [feedbackItem, ...(s.feedback || [])] };
      }
      return s;
    }));

    if (teacherNamespace) {
      setIsSaving(true);
      // Use efficient append
      storageService.appendToStudentFeedback(teacherNamespace, id, feedbackItem)
        .finally(() => setIsSaving(false));
    }
  };

  const [onlineStudentIds, setOnlineStudentIds] = useState<string[]>([]);

  // Firebase Chat & Presence Listeners
  useEffect(() => {
    if (isLoggedIn && userRole === UserRole.STUDENT && teacherNamespace && currentStudentId) {
      // 1. Update our own presence immediately
      chatService.updatePresence(teacherNamespace, currentStudentId, true);
      
      // 2. Set up heartbeat to keep presence fresh every minute
      const heartbeat = setInterval(() => {
        chatService.updatePresence(teacherNamespace, currentStudentId, true);
      }, 60000);

      // 3. Subscribe to classroom presence
      const unsubscribePresence = chatService.subscribeToPresence(teacherNamespace, (onlineIds) => {
        setOnlineStudentIds(onlineIds);
      });

      // 4. Subscribe to our conversations
      const unsubscribeChats = chatService.subscribeToConversations(teacherNamespace, currentStudentId, (conversations) => {
        setStudents(prev => prev.map(s => {
          if (s.id === currentStudentId) {
            // Check for new incoming requests to show alert
            const oldConversations = s.conversations || [];
            conversations.forEach(newConv => {
              const oldConv = oldConversations.find(c => c.participantId === newConv.participantId);
              if (newConv.status === 'pending' && newConv.initiatorId !== currentStudentId && (!oldConv || oldConv.status !== 'pending')) {
                if (activeTabRef.current !== 'chat') {
                  alert(`New chat request from a peer! Go to the Peer Chat tab to respond.`);
                }
              }
            });

            return { ...s, conversations };
          }
          return s;
        }));
      });

      // Cleanup
      return () => {
        clearInterval(heartbeat);
        chatService.updatePresence(teacherNamespace, currentStudentId, false);
        unsubscribePresence();
        unsubscribeChats();
      };
    }
  }, [isLoggedIn, userRole, teacherNamespace, currentStudentId]);

  const handleSendChatRequest = async (targetId: string) => {
    if (!teacherNamespace || !currentStudentId) {
      console.error("[App] Chat request failed: Missing namespace or student ID", { teacherNamespace, currentStudentId });
      alert("Session error. Please log in again.");
      return;
    }
    console.log(`[App] Sending chat request to ${targetId}`);
    try {
      await chatService.sendRequest(teacherNamespace, currentStudentId, targetId);
      console.log(`[App] Chat request sent successfully`);
    } catch (error: any) {
      console.error("[App] Failed to send chat request:", error);
      alert("Could not send request. Please check your connection.");
    }
  };

  const handleRespondChatRequest = async (targetId: string, accept: boolean) => {
    if (!teacherNamespace || !currentStudentId) return;
    try {
      await chatService.respondToRequest(teacherNamespace, currentStudentId, targetId, accept);
    } catch (error: any) {
      console.error("Failed to respond to chat request:", error);
      alert("Action failed. Please try again.");
    }
  };

  const handleCancelChatRequest = async (targetId: string) => {
    if (!teacherNamespace || !currentStudentId) return;
    try {
      await chatService.cancelRequest(teacherNamespace, currentStudentId, targetId);
    } catch (error: any) {
      console.error("Failed to cancel chat request:", error);
    }
  };

  const handleSendMessage = async (targetId: string, text: string) => {
    if (!teacherNamespace || !currentStudentId) return;
    try {
      await chatService.sendMessage(teacherNamespace, currentStudentId, targetId, text);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      alert("Message failed to send.");
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Verifying Session...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  if (userRole === UserRole.STUDENT) {
    if (!teacherNamespace || !currentStudentId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="text-center space-y-4">
            <p className="text-rose-500 font-bold">Session Error: Student profile not found.</p>
            <button onClick={handleLogout} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Return to Login</button>
          </div>
        </div>
      );
    }
    const currentStudent = students.find(s => s.id === currentStudentId);
    if (currentStudent && !currentStudent.isProfileComplete) {
      return (
        <ProfileSetup 
          student={currentStudent} teacherEmail={teacherNamespace}
          onComplete={(name, avatar, gender) => handleUpdateStudent(currentStudent.id, { name, avatar, gender, isProfileComplete: true })}
          onLogout={handleLogout}
        />
      );
    }
  }

  const currentStudent = students.find(s => s.id === currentStudentId);
  const studentViewStudents = currentStudent ? [currentStudent] : [];
  
  // Drill-down logic for teachers
  const drillDownStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;
  const dashboardStudents = userRole === UserRole.STUDENT 
    ? studentViewStudents 
    : (drillDownStudent ? [drillDownStudent] : students);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'dashboard') setSelectedStudentId(null);
        }} 
        onLogout={handleLogout} 
        userRole={userRole!} 
        userEmail={userEmail}
        studentAvatar={currentStudent?.avatar}
        studentName={currentStudent?.name}
      />
      <main className="flex-1 overflow-y-auto p-8 relative">
        {isSaving && (
          <div className="fixed top-6 right-6 z-[100] flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Syncing...</span>
          </div>
        )}
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {userRole === UserRole.TEACHER && drillDownStudent && (
                <button 
                  onClick={() => setSelectedStudentId(null)}
                  className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                >
                  <span>←</span> Back to Class Overview
                </button>
              )}
              <Dashboard 
                students={dashboardStudents} 
                isStudentView={userRole === UserRole.STUDENT || !!drillDownStudent} 
                onSendFeedback={handleSendFeedback} 
                setActiveTab={setActiveTab}
                onDrillDown={userRole === UserRole.TEACHER ? setSelectedStudentId : undefined}
              />
            </div>
          )}
          {activeTab === 'capture' && userRole === UserRole.STUDENT && <CaptureUI students={studentViewStudents} onResult={handleAnalysisResult} isStudentView={true} />}
          {activeTab === 'journals' && userRole === UserRole.STUDENT && <JournalUI students={studentViewStudents} isStudentView={true} />}
          {activeTab === 'roster' && userRole === UserRole.TEACHER && (
            <StudentRoster 
              students={students} 
              teacherEmail={userEmail} 
              onAddStudent={handleAddStudent} 
              onUpdateStudent={handleUpdateStudent} 
              onDeleteStudent={handleDeleteStudent} 
              onSendFeedback={handleSendFeedback} 
              onDrillDown={(id) => {
                setSelectedStudentId(id);
                setActiveTab('dashboard');
              }}
            />
          )}
          {activeTab === 'status' && userRole === UserRole.TEACHER && <StatusMonitor students={students} onSendFeedback={handleSendFeedback} onDrillDown={(id) => {
            setSelectedStudentId(id);
            setActiveTab('dashboard');
          }} />}
          {activeTab === 'chat' && userRole === UserRole.STUDENT && currentStudent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Network: Firebase Realtime
                  </span>
                </div>
              </div>
              <StudentChat 
                currentStudent={currentStudent} 
                allStudents={students} 
                onlineStudentIds={onlineStudentIds}
                onSendRequest={handleSendChatRequest} 
                onRespondRequest={handleRespondChatRequest} 
                onCancelRequest={handleCancelChatRequest}
                onSendMessage={handleSendMessage} 
              />
            </div>
          )}
          {activeTab === 'settings' && <Settings theme={theme} setTheme={setTheme} userRole={userRole!} student={currentStudent} onUpdateStudent={handleUpdateStudent} allStudents={students} userEmail={userEmail} onResetDatabase={() => { storageService.clearAllForUser(userEmail); storageService.saveStudents(userEmail, [], true); setStudents([]); }} onImportDatabase={setStudents} />}
        </div>
      </main>
    </div>
  );
};

export default App;


import React, { useState } from 'react';
import { UserRole } from '../types';
import { auth, googleProvider } from '../services/firebase';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { useEffect } from 'react';

interface LoginProps {
  onLogin: (role: UserRole, email: string, name?: string, picture?: string, password?: string, teacherEmail?: string, studentId?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [roleSelection, setRoleSelection] = useState<UserRole | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Handle redirect result on mount
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          const storedRole = localStorage.getItem('pendingRole') as UserRole;
          if (storedRole) {
            onLogin(storedRole, user.email!, user.displayName || undefined, user.photoURL || undefined);
            localStorage.removeItem('pendingRole');
          }
        }
      } catch (error: any) {
        console.error("Redirect Auth Error:", error);
        setAuthError("Authentication failed after redirect.");
      }
    };
    checkRedirect();
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    if (!roleSelection || isLoading) return;
    setAuthError(null);
    setIsLoading(true);
    
    try {
      // Try popup first
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      onLogin(roleSelection, user.email!, user.displayName || undefined, user.photoURL || undefined);
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      
      if (error.code === 'auth/popup-blocked') {
        // Fallback to redirect if popup is blocked
        setAuthError("Popup blocked. Redirecting to secure sign-in...");
        localStorage.setItem('pendingRole', roleSelection);
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError: any) {
          console.error("Redirect error:", redirectError);
          setAuthError("Could not initiate redirect. Please try Email Login.");
        }
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError("Sign-in request was cancelled. Please try again.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in window was closed. If this keeps happening, try clicking the 'Open in new tab' button at the top right of the app.");
      } else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
        setAuthError(
          "Google Sign-In is not enabled. \n\n" +
          "1. Go to Firebase Console > Authentication > Sign-in method.\n" +
          "2. Enable 'Google'.\n" +
          "3. Add this domain to 'Authorized domains' in Settings.\n\n" +
          "Until then, please use the Email login below."
        );
      } else {
        setAuthError("Google Sign-In failed. Please try Email Login.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [studentName, setStudentName] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [teacherEmailInput, setTeacherEmailInput] = useState('');
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  const [isClassroomValid, setIsClassroomValid] = useState<boolean | null>(null);
  const [isCheckingClassroom, setIsCheckingClassroom] = useState(false);

  // Check classroom existence when teacher email changes
  useEffect(() => {
    const checkClassroom = async () => {
      if (!teacherEmailInput.trim() || !teacherEmailInput.includes('@')) {
        setIsClassroomValid(null);
        return;
      }
      
      setIsCheckingClassroom(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/check-classroom/${encodeURIComponent(teacherEmailInput.trim())}`);
        const data = await response.json();
        setIsClassroomValid(data.exists);
      } catch (err) {
        console.error("Error checking classroom:", err);
        setIsClassroomValid(null);
      } finally {
        setIsCheckingClassroom(false);
      }
    };

    const timer = setTimeout(checkClassroom, 800);
    return () => clearTimeout(timer);
  }, [teacherEmailInput]);

  const handleStudentPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!studentName.trim() || !studentPassword.trim() || !teacherEmailInput.trim()) return;

    if (isClassroomValid === false) {
      setAuthError(`Classroom "${teacherEmailInput}" not found. Please check your teacher's email.`);
      return;
    }
    
    setIsLoading(true);
    try {
      // Ensure we are signed out from any previous session
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      // Call our backend to verify credentials and get a custom token
      // This bypasses the 'Anonymous' provider which might be restricted
      const response = await fetch(`${apiBaseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherEmail: teacherEmailInput.trim(),
          studentName: studentName.trim(),
          password: studentPassword.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}\n\n${data.details}` : (data.error || "Login failed.");
        throw new Error(errorMsg);
      }

      // Sign in with the custom token provided by our server
      await signInWithCustomToken(auth, data.token);
      
      // Complete the login in the app state
      await onLogin(
        UserRole.STUDENT, 
        data.student.email, 
        data.student.name, 
        data.student.avatar, 
        undefined, // Don't pass password, we already verified it
        teacherEmailInput.trim(),
        data.student.id // Pass the studentId
      );
    } catch (error: any) {
      console.error("Student Password Auth Error:", error);
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        setAuthError(
          "Authentication is restricted in Firebase.\n\n" +
          "1. Go to Firebase Console > Authentication > Settings.\n" +
          "2. Ensure 'User registration' is not disabled in Identity Platform.\n" +
          "3. Check 'Authorized domains' includes this URL."
        );
      } else {
        setAuthError(error.message || "Login failed. Please check your credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes('@') || !passwordInput) return;
    
    setIsLoading(true);
    setAuthError(null);
    setSuccessMessage(null);
    try {
      if (authView === 'login') {
        const result = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        const user = result.user;
        onLogin(roleSelection!, user.email!, user.displayName || undefined, user.photoURL || undefined);
      } else {
        // Registration
        const result = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        const user = result.user;
        onLogin(roleSelection!, user.email!, user.displayName || undefined, user.photoURL || undefined);
      }
    } catch (error: any) {
      console.error("Email Auth Error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setAuthError("Invalid email or password. If you don't have an account, please Register.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("This email is already registered. Please Login instead.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError(
          "Email/Password Sign-In is not enabled in Firebase.\n\n" +
          "1. Go to Firebase Console > Authentication > Sign-in method.\n" +
          "2. Enable 'Email/Password'.\n" +
          "3. Save changes."
        );
      } else {
        setAuthError(error.message || "Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes('@')) return;
    
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setOtpSent(true);
      setSuccessMessage("OTP sent to your email!");
    } catch (error: any) {
      setAuthError(error.message || "Failed to send OTP. Check SMTP settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput || !newPasswordInput) return;
    
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailInput, 
          otp: otpInput, 
          newPassword: newPasswordInput 
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setSuccessMessage("Password reset successfully! You can now login.");
      setAuthView('login');
      setOtpSent(false);
      setOtpInput('');
      setNewPasswordInput('');
    } catch (error: any) {
      setAuthError(error.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#020617] p-6 transition-colors duration-1000">
      {/* Platform Branding */}
      <div className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <span className="text-2xl text-white">🧠</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">SLP</h1>
        </div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] ml-1">Sentient Learning</p>
      </div>

      <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 p-10 md:p-14 overflow-hidden relative">
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-indigo-600 animate-[loading_1.5s_infinite]" />
          </div>
        )}

        <div className="min-h-[420px] flex flex-col">
          {!roleSelection ? (
            <div className="flex-1 flex flex-col justify-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Identity</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Select your role to access the portal.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => setRoleSelection(UserRole.TEACHER)}
                  className="group flex items-center gap-6 p-6 rounded-[2rem] border-2 border-slate-50 dark:border-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-300 text-left active:scale-[0.98]"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">👨‍🏫</span>
                  <div>
                    <span className="block font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] mb-1">Educator</span>
                    <span className="text-xs text-slate-400 font-medium">Manage students & analytics</span>
                  </div>
                </button>
                <button 
                  onClick={() => setRoleSelection(UserRole.STUDENT)}
                  className="group flex items-center gap-6 p-6 rounded-[2rem] border-2 border-slate-50 dark:border-slate-800/50 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-300 text-left active:scale-[0.98]"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">🎓</span>
                  <div>
                    <span className="block font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] mb-1">Student</span>
                    <span className="text-xs text-slate-400 font-medium">Capture pulse & reflections</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-in slide-in-from-right-8 duration-500">
              <div className="mb-10 flex items-center gap-4">
                <button 
                  onClick={() => { setRoleSelection(null); setAuthError(null); }} 
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-xl font-black dark:text-white tracking-tight leading-none mb-1">Sign In</h2>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{roleSelection} PORTAL</p>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {roleSelection === UserRole.STUDENT ? (
                  <form onSubmit={handleStudentPasswordLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teacher's Email (Class Code)</label>
                      <div className="relative group">
                        <input 
                          type="text"
                          placeholder="teacher@school.edu"
                          required
                          value={teacherEmailInput}
                          onChange={(e) => setTeacherEmailInput(e.target.value)}
                          className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border ${isClassroomValid === false ? 'border-rose-500' : isClassroomValid === true ? 'border-emerald-500' : 'border-slate-100 dark:border-slate-800'} text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300`}
                        />
                        {isCheckingClassroom && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          </span>
                        )}
                        {isClassroomValid === false && !isCheckingClassroom && (
                          <p className="absolute -bottom-5 left-1 text-[8px] font-black text-rose-500 uppercase tracking-widest">Classroom not found</p>
                        )}
                        {isClassroomValid === true && !isCheckingClassroom && (
                          <p className="absolute -bottom-5 left-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">Classroom found</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                      <input 
                        type="text"
                        placeholder="John Doe"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                      />
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 ml-1 font-medium italic">Must match the name on your teacher's roster exactly.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        required
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                      />
                    </div>
                    {authError && (
                      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 animate-in shake duration-500">
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold text-center whitespace-pre-line">
                          {authError}
                        </p>
                      </div>
                    )}
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      Enter Classroom
                    </button>
                  </form>
                ) : (
                  <>
                    {authView === 'forgot' ? (
                      <div className="space-y-6">
                        <div className="text-center">
                          <h3 className="text-lg font-black dark:text-white tracking-tight">Reset Password</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">OTP Verification</p>
                        </div>

                        {!otpSent ? (
                          <form onSubmit={handleSendOTP} className="space-y-4">
                            <div className="relative group">
                              <input 
                                type="email"
                                placeholder="Enter your email"
                                required
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="w-full p-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </span>
                            </div>
                            <button 
                              type="submit"
                              disabled={isLoading}
                              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                              Send OTP
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">6-Digit OTP</label>
                              <input 
                                type="text"
                                placeholder="123456"
                                required
                                maxLength={6}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                                className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center tracking-[1em] placeholder:text-slate-300"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                              <input 
                                type="password"
                                placeholder="••••••••"
                                required
                                value={newPasswordInput}
                                onChange={(e) => setNewPasswordInput(e.target.value)}
                                className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                              />
                            </div>
                            <button 
                              type="submit"
                              disabled={isLoading}
                              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                              Reset Password
                            </button>
                          </form>
                        )}
                        
                        <div className="text-center">
                          <button 
                            type="button"
                            onClick={() => { setAuthView('login'); setOtpSent(false); }}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors"
                          >
                            Back to Login
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Official Google Button */}
                        <div className="space-y-4">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Verified Provider</p>
                           <button 
                             onClick={handleGoogleLogin}
                             disabled={isLoading}
                             className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                           >
                             <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                             <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                               {authView === 'login' ? 'Sign in with Google' : 'Register with Google'}
                             </span>
                           </button>
                        </div>

                        <div className="flex items-center gap-4 px-6">
                          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-slate-800"></div>
                          <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">or Secure Email</span>
                          <div className="flex-1 h-[1px] bg-slate-100 dark:bg-slate-800"></div>
                        </div>

                        {/* Secure Email Form */}
                        <form onSubmit={handleEmailAuth} className="space-y-4">
                          <div className="relative group">
                            <input 
                              type="email"
                              placeholder="Enter school email"
                              required
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              className="w-full p-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </span>
                          </div>
                          <div className="relative group">
                            <input 
                              type="password"
                              placeholder="Password"
                              required
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              className="w-full p-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </span>
                          </div>
                          <button 
                            type="submit"
                            disabled={isLoading || !emailInput.includes('@') || !passwordInput}
                            className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                          >
                            {authView === 'login' ? 'Continue with Email' : 'Create Account'}
                          </button>
                        </form>

                        <div className="flex flex-col items-center gap-3 pt-2">
                          <button 
                            type="button"
                            onClick={() => { setAuthView(authView === 'login' ? 'register' : 'login'); setAuthError(null); }}
                            className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                          >
                            {authView === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                          </button>
                          {authView === 'login' && (
                            <button 
                              type="button"
                              onClick={() => { setAuthView('forgot'); setAuthError(null); }}
                              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {(authError || successMessage) && (
                  <div className={`p-4 rounded-2xl border animate-in ${authError ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50 shake' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'} duration-500`}>
                    <p className={`text-[10px] font-bold text-center whitespace-pre-line ${authError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {authError || successMessage}
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-medium px-8 leading-relaxed">
                  Firebase Authentication provides secure, scalable infrastructure for your classroom data.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
            <p className="text-[9px] text-slate-300 dark:text-slate-700 font-black uppercase tracking-[0.4em]">
              Firebase Backend Integration Active
            </p>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default Login;

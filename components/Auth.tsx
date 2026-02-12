
import React, { useState } from 'react';
// Updated imports to use local mock service
import { auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../services/firebase';
import { Hexagon, Loader2, Mail, Lock, AlertCircle, School, GraduationCap, User, Building2 } from 'lucide-react';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // New fields for Sign Up
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => {
    if (error) setError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName.trim() || !schoolName.trim()) {
           throw new Error("Please fill in all fields");
        }
        await createUserWithEmailAndPassword(auth, email, password, role, displayName, schoolName);
      }
    } catch (err: any) {
      console.warn("Auth Error", err);
      if (err.code === 'auth/unauthorized-domain') {
         setError(`Domain (${window.location.hostname}) not authorized in Firebase.`);
      } else if (err.code === 'auth/email-already-in-use') {
         setError("Email already in use.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
         setError("Invalid email or password.");
      } else {
         setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return; // Prevent multiple clicks
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
         setError(`Domain "${window.location.hostname}" is not authorized. Please add it to Firebase Console > Auth > Settings > Authorized Domains.`);
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
         // User closed popup or clicked again, ignore or show mild message
         setError("Sign in cancelled.");
      } else if (err.code === 'auth/popup-blocked') {
         setError("Popup blocked. Please allow popups for this site.");
      } else if (err.message && (err.message.includes("INTERNAL ASSERTION FAILED") || err.message.includes("Pending promise"))) {
         // Handle internal firebase race conditions gracefully
         setError("Connection interrupted. Please try again.");
      } else {
         setError("Google Sign In failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
        <div className="p-8 text-center bg-indigo-600">
           <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4">
              <Hexagon className="w-8 h-8 text-white fill-white" />
           </div>
           <h1 className="text-2xl font-bold text-white tracking-tight">NextHorizon</h1>
           <p className="text-indigo-100 mt-1 font-medium text-sm">AI-Powered Educational Core</p>
        </div>

        <div className="p-8">
           <div className="flex justify-center mb-6 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign Up
              </button>
           </div>

           {!isLogin && (
             <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in">
                <button 
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${role === 'teacher' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                >
                   <School size={24} />
                   <span className="text-xs font-bold uppercase">Teacher</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${role === 'student' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                >
                   <GraduationCap size={24} />
                   <span className="text-xs font-bold uppercase">Student</span>
                </button>
             </div>
           )}

           <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
             {isLogin ? 'Welcome Back' : `Create ${role === 'teacher' ? 'Teacher' : 'Student'} Account`}
           </h2>

           <form onSubmit={handleAuth} className="space-y-4">
              
              {!isLogin && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        required={!isLogin}
                        value={displayName}
                        onChange={(e) => { setDisplayName(e.target.value); clearError(); }}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-medium transition-all"
                        placeholder="e.g. Cikgu Sarah"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">School Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        required={!isLogin}
                        value={schoolName}
                        onChange={(e) => { setSchoolName(e.target.value); clearError(); }}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-medium transition-all"
                        placeholder="e.g. SMK Damansara Utama"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-medium transition-all"
                    placeholder={role === 'teacher' ? "teacher@school.edu.my" : "student@school.edu.my"}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-medium transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-xl flex items-start gap-3 animate-fade-in">
                  <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
              </button>
           </form>

           <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or continue with</span></div>
              </div>

              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                type="button"
                className={`mt-4 w-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md group ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                 {loading ? <Loader2 className="animate-spin w-5 h-5 text-indigo-600" /> : (
                 <>
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    <span>Continue with Google</span>
                 </>
                 )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

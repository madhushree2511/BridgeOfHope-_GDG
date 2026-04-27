import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Mail, Lock, User as UserIcon, Loader2, Heart, Shield, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup';
  initialRole?: string;
}

export default function AuthModal({ isOpen, onClose, initialMode, initialRole = 'Donor' }: AuthModalProps) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { registerWithEmail, loginWithEmail, loginWithGoogle } = useAuth();

  // Reset state when modal opens or initialMode changes
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRole(initialRole);
      setLocalError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialMode, initialRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);
    try {
      if (mode === 'signup') {
        await registerWithEmail(email, password, name, role);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      setLocalError(err.message || 'An authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !loading) return null; // We still want to let AnimatePresence handle null, but we'll move the condition inside

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-8 md:p-12 relative my-auto"
          >
            <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-gray-100 rounded-2xl transition-all">
              <X size={24} />
            </button>

            <div className="text-center mb-10">
              <h2 className="text-4xl font-black tracking-tight mb-3">
                {mode === 'signup' ? 'Join the Mission' : 'Welcome Back'}
              </h2>
              <p className="text-gray-500 font-bold">
                {mode === 'signup' ? 'Create an account to start your journey.' : 'Login to your control panel.'}
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { id: 'Donor', icon: Heart, label: 'Donor' },
                    { id: 'Orphanage', icon: Shield, label: 'NGO' },
                    { id: 'Admin', icon: ShieldAlert, label: 'Admin' }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                        role === r.id 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <r.icon size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{r.label}</span>
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    placeholder="Full Name / Charity Name"
                    className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl py-4 pl-16 pr-6 outline-none focus:border-blue-600 focus:bg-white transition-all font-bold"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="relative group">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input
                type="email"
                required
                placeholder="Email Address"
                className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl py-4 pl-16 pr-6 outline-none focus:border-blue-600 focus:bg-white transition-all font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input
                type="password"
                required
                placeholder="Password"
                className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl py-4 pl-16 pr-6 outline-none focus:border-blue-600 focus:bg-white transition-all font-bold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {localError && (
              <p className="text-red-500 text-sm font-bold text-center bg-red-50 p-4 rounded-2xl border border-red-100 italic">
                {localError}
              </p>
            )}

            <button 
              disabled={loading}
              className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-black text-xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center gap-4">
             <button 
              onClick={() => loginWithGoogle()}
              className="w-full bg-white border-2 border-gray-100 text-gray-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
             >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Continue with Google
             </button>

             <p className="text-gray-400 font-bold text-sm">
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                  className="text-blue-600 ml-2 hover:underline"
                >
                  {mode === 'signup' ? 'Log In' : 'Sign Up'}
                </button>
             </p>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}

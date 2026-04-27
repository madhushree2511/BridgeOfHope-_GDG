/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import Landing from './components/Landing.tsx';
import DonorDashboard from './components/DonorDashboard.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import NGODashboard from './components/NGODashboard.tsx';
import RequirementHub from './components/RequirementHub.tsx';
import AuthModal from './components/AuthModal.tsx';
import { Heart, User as UserIcon, Shield, Search, ShieldAlert, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import axios from 'axios';

function Navbar() {
  const { user, logout, registeredUser, setAuthModal } = useAuth();

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md fixed top-0 left-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-black text-2xl text-blue-600 tracking-tighter">
          <Heart fill="currentColor" size={28} />
          <span>BridgeOfHope</span>
        </Link>
        <div className="flex items-center gap-8">
          <Link to="/requirements" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-black text-sm uppercase tracking-widest transition-colors">
            <Search size={18} /> Dataset Hub
          </Link>
          {user ? (
            <>
              <div className="flex flex-col items-end">
                <Link to="/dashboard" className="text-gray-900 hover:text-blue-600 font-black text-sm uppercase tracking-widest">Dashboard</Link>
                {registeredUser && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md mt-1 ${
                    registeredUser.role === 'Admin' ? 'bg-red-100 text-red-600' : 
                    registeredUser.role === 'Donor' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {registeredUser.role}
                  </span>
                )}
              </div>
              <button onClick={logout} className="text-red-500 hover:text-red-600 font-black text-sm uppercase tracking-widest cursor-pointer">Logout</button>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                <UserIcon size={20} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4 relative">
              <button 
                onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
                className="text-gray-900 hover:text-blue-600 font-black text-sm uppercase tracking-widest"
              >
                Login
              </button>
              <button 
                onClick={() => setAuthModal({ isOpen: true, mode: 'signup' })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-blue-100"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}


function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, registeredUser, loading } = useAuth();
  
  if (loading) return null;
  
  if (!user) return <Navigate to="/" />;
  
  if (registeredUser && registeredUser.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-lg border-2 border-red-100">
          <Shield size={64} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Access Denied</h2>
          <p className="text-gray-500 font-bold mb-8 italic">
            You do not have the required administrative permissions to access this control panel.
          </p>
          <Link to="/dashboard" className="inline-block bg-gray-900 text-white px-10 py-4 rounded-2xl font-black transition-all hover:bg-black">
            Return to Safety
          </Link>
        </div>
      </div>
    );
  }

  return registeredUser ? <>{children}</> : <div className="p-20 text-center font-black italic">Verifying Authorization...</div>;
}

function DashboardRouter() {
  const { registeredUser, loading, user, logout } = useAuth();
  
  if (loading) return <div className="p-20 text-center font-black italic">Synchronizing...</div>;
  
  if (user && !registeredUser) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-12 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[3.5rem] shadow-2xl border-2 border-blue-50 max-w-xl w-full"
        >
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-blue-100">
            <Heart size={40} fill="currentColor" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Welcome to BridgeOfHope</h2>
          <p className="text-gray-500 font-bold mb-10 leading-relaxed">
            It looks like your profile needs to be set up. Please select your role to continue your mission.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-10">
            <button 
              onClick={async () => {
                try {
                  const token = await user.getIdToken();
                  await axios.post('/api/users/register', { role: 'Donor', displayName: user.displayName || 'Donor' }, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  window.location.reload();
                } catch (e) {
                  logout();
                }
              }}
              className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 p-6 rounded-3xl transition-all group"
            >
              <Heart className="mx-auto mb-2 text-blue-600 group-hover:text-white transition-colors" />
              <span className="font-black text-xs uppercase tracking-widest">Donor</span>
            </button>
            <button 
               onClick={async () => {
                try {
                  const token = await user.getIdToken();
                  await axios.post('/api/users/register', { role: 'Orphanage', displayName: user.displayName || 'NGO' }, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  window.location.reload();
                } catch (e) {
                  logout();
                }
              }}
              className="bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-600 p-6 rounded-3xl transition-all group"
            >
              <Shield className="mx-auto mb-2 text-purple-600 group-hover:text-white transition-colors" />
              <span className="font-black text-xs uppercase tracking-widest">Trust / NGO</span>
            </button>
          </div>

          <button 
            onClick={logout}
            className="text-gray-400 hover:text-red-500 font-black text-xs uppercase tracking-widest transition-colors"
          >
            Not you? Logout
          </button>
        </motion.div>
      </div>
    );
  }

  if (registeredUser?.role === 'Admin') return <AdminDashboard />;
  if (registeredUser?.role === 'Orphanage' || registeredUser?.role === 'OldAgeHome') return <NGODashboard />;
  return <DonorDashboard />;
}

export default function App() {
  const { authModal, setAuthModal } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 pt-20">
        <Navbar />
        <AuthErrorBanner />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/requirements" element={<RequirementHub />} />
          </Routes>
        </main>
        
        <AuthModal 
          isOpen={authModal.isOpen} 
          onClose={() => setAuthModal({ ...authModal, isOpen: false })} 
          initialMode={authModal.mode} 
          initialRole={authModal.role}
        />
      </div>
    </Router>
  );
}

function AuthErrorBanner() {
  const { error } = useAuth();
  if (!error) return null;

  return (
    <div className="bg-red-600 text-white p-4 text-center font-black animate-pulse flex items-center justify-center gap-2">
      <Shield size={20} />
      <span>{error}</span>
    </div>
  );
}

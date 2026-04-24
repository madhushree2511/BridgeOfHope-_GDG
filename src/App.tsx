/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import Landing from './components/Landing.tsx';
import DonorDashboard from './components/DonorDashboard.tsx';
import AdminVerify from './components/AdminVerify.tsx';
import { Heart, User as UserIcon, Shield } from 'lucide-react';

function Navbar() {
  const { user, login, logout } = useAuth();

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Heart fill="currentColor" size={24} />
          <span>BridgeOfHope</span>
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium">Dashboard</Link>
              <button onClick={logout} className="text-gray-600 hover:text-red-600 font-medium cursor-pointer">Logout</button>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
                <UserIcon size={18} />
              </div>
            </>
          ) : (
            <button onClick={login} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
              Sign In
            </button>
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

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-white text-gray-900 font-sans">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<PrivateRoute><DonorDashboard /></PrivateRoute>} />
              <Route path="/admin/verify" element={<PrivateRoute><AdminVerify /></PrivateRoute>} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

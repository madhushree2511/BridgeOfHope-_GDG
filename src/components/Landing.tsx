import React from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, ShieldCheck, PieChart, Users } from 'lucide-react';
import AuthModal from './AuthModal.tsx';

export default function Landing() {
  const { user, setAuthModal } = useAuth();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100"
          >
            <ShieldCheck size={18} />
            Verified & Trusted Donations
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-6xl font-extrabold leading-tight tracking-tight"
          >
            Direct Help to <span className="text-blue-600 italic">Orphanages</span> & Old Age Homes.
          </motion.h1>
          <p className="text-xl text-gray-600 max-w-xl">
            BridgeOfHope ensures your donations reach the right hands through a strict verification system and real-time impact tracking.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            {user ? (
              <Link to="/dashboard" className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <button 
                  onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
                  className="bg-white border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all"
                >
                  Login
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAuthModal({ isOpen: true, mode: 'signup', role: 'Donor' })}
                    className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                  >
                    <Heart size={20} /> I want to Donate
                  </button>
                  <button 
                    onClick={() => setAuthModal({ isOpen: true, mode: 'signup', role: 'Orphanage' })}
                    className="bg-gray-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-black transition-all shadow-lg"
                  >
                    I am an NGO
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 relative">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full aspect-square rounded-[40px] overflow-hidden relative shadow-2xl border-8 border-white group"
          >
             <img 
               src="/hero.png" 
               alt="Bridge of Hope Community" 
               className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
               referrerPolicy="no-referrer"
               onError={(e) => {
                 (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2070&auto=format&fit=crop";
               }}
             />
             <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                   <div className="absolute inset-0 blur-2xl bg-white/20 rounded-full scale-150" />
                   <Heart size={140} className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] opacity-90 relative z-10 scale-90 group-hover:scale-100 transition-transform duration-500" />
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Stats/Features Section */}
      <section className="w-full bg-gray-50 py-24 px-6 border-y border-gray-100">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md border border-gray-100">
              <ShieldCheck className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-bold">Strict Verification</h3>
            <p className="text-gray-500">Only verified donors and organizations can join our high-trust ecosystem.</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md border border-gray-100">
              <PieChart className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-bold">Impact Analytics</h3>
            <p className="text-gray-500">Track exactly where your donations go and the impact they create in real-time.</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md border border-gray-100">
              <Users className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-bold">Dual Rating System</h3>
            <p className="text-gray-500">Combining Google reviews and internal feedback for maximum transparency.</p>
          </div>
        </div>
      </section>

      {/* Trust Algorithm Section */}
      <section className="w-full py-24 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8 italic">The Trust Factor</h2>
        <div className="bg-white border-2 border-blue-50 rounded-3xl p-12 shadow-sm">
          <p className="text-lg text-gray-600 mb-8"> Our proprietary trust score ensures that only high-quality NGOs receive support.</p>
          <div className="bg-gray-900 text-white py-6 px-10 rounded-2xl inline-block text-2xl font-mono">
            $$TrustScore = (0.4 \times GoogleRating) + (0.6 \times InternalRating)$$
          </div>
        </div>
      </section>
    </div>
  );
}


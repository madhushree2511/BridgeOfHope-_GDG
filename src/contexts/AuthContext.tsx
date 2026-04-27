import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

import axios from 'axios';
import { ADMIN_WHITELIST } from '../constants.ts';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  registeredUser: any;
  setRegisteredUser: (user: any) => void;
  refreshProfile: () => Promise<void>;
  error: string | null;
  authModal: { isOpen: boolean; mode: 'login' | 'signup'; role?: string };
  setAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'signup'; role?: string }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'signup'; role?: string }>({
    isOpen: false,
    mode: 'login'
  });

  const refreshProfile = async (retryCount = 0) => {
    if (!auth.currentUser) {
      console.log('No Firebase user found in refreshProfile');
      setRegisteredUser(null);
      setLoading(false);
      return;
    }

    // Limit retries to prevent infinite loops - increased to 15 to allow Atlas propagation
    if (retryCount > 15) {
      console.error('Persistent failure in refreshProfile after 15 tries');
      setError('Database initialization is taking extra time. If this persists, please ensure your MongoDB Atlas IP Whitelist (0.0.0.0/0) is active and your MONGODB_URI is correct.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching profile (Try ${retryCount + 1}) for:`, auth.currentUser.email);
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Safety check for HTML warmup page
      if (typeof res.data === 'string' && res.data.includes('<!doctype html>')) {
        console.log('Profile fetch returned HTML (warmup), retrying in 3s...');
        setTimeout(() => refreshProfile(retryCount + 1), 3000);
        return; 
      }

      console.log('Profile fetched successfully. Status:', res.data.verificationStatus);
      setRegisteredUser(res.data);
      setLoading(false);
    } catch (err: any) {
      console.error('Profile fetch failed:', err.response?.status, err.response?.data || err.message);
      
      const respData = err.response?.data;
      const isWarmup = typeof respData === 'string' && respData.includes('<!doctype html>');
      
      if (err.response?.status === 503 || isWarmup) {
        console.log('Server/Database busy or warming up, retrying in 3s...');
        setTimeout(() => refreshProfile(retryCount + 1), 3000);
        return;
      }
      
      if (err.response?.status === 404 || err.response?.status === 403 || err.response?.status === 401) {
        console.log(`Access denied or user not found (${err.response?.status}). Checking if registration is possible.`);
        
        if (err.response?.status === 403) {
           setError('This account has been deactivated by an administrator.');
           await signOut(auth); // Force logout from Firebase
           setRegisteredUser(null);
           setLoading(false);
           return;
        }

        // Auto-register whitelisted admins if they log in via Google
        if (auth.currentUser && ADMIN_WHITELIST.includes(auth.currentUser.email || '')) {
           console.log('Auto-registering whitelisted admin...');
           await registerNewUser();
           return;
        }

        setRegisteredUser(null);
        setLoading(false);
      } else {
        const errorMsg = respData?.error || err.message || 'Failed to load profile';
        if (errorMsg.includes('whitelist') || errorMsg.includes('IP')) {
          setError('Database Access Denied: Please add your current IP to the MongoDB Atlas Whitelist.');
        } else {
          setError(errorMsg);
        }
        setRegisteredUser(null);
        setLoading(false);
      }
    }
  };

  const registerNewUser = async () => {
    if (!auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const isWhitelisted = auth.currentUser.email && ADMIN_WHITELIST.includes(auth.currentUser.email);
      
      const res = await axios.post('/api/users/register', {
        role: isWhitelisted ? 'Admin' : 'Donor',
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User'
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setRegisteredUser(res.data.user || res.data); 
    } catch (err: any) {
      console.error('Registration failed:', err.response?.data || err.message);
      if (err.response?.status === 503) {
        setError('Database registration failed: Connection offline.');
      }
      setRegisteredUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setRegisteredUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const registerWithEmail = async (email: string, pass: string, name: string, role: string) => {
    try {
      setLoading(true);
      setError(null);

      // Pre-registration whitelist check for Admin role
      if (role === 'Admin' && !ADMIN_WHITELIST.includes(email)) {
        throw new Error('Unauthorized Admin Email. Access Denied.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
      
      const idToken = await userCredential.user.getIdToken();
      const res = await axios.post('/api/users/register', {
        role,
        displayName: name
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      setRegisteredUser(res.data.user || res.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      setLoading(true);
      setError(null);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const getIdToken = async () => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      loginWithGoogle, 
      registerWithEmail,
      loginWithEmail,
      logout, 
      getIdToken, 
      registeredUser, 
      setRegisteredUser, 
      refreshProfile, 
      error,
      authModal,
      setAuthModal
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';
import { motion } from 'motion/react';
import { Upload, AlertCircle, Clock, CheckCircle, ShieldCheck } from 'lucide-react';

interface UserData {
  _id: string;
  role: string;
  isVerified: boolean;
  verificationStatus: string;
}

export default function DonorDashboard() {
  const { getIdToken, user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchProfile = async () => {
    try {
      const token = await getIdToken();
      const res = await axios.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(res.data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const mockUpload = async () => {
    setUploading(true);
    try {
      // Mocking a file upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const token = await getIdToken();
      await axios.post('/api/users/upload-doc', {
        name: 'Business License',
        url: 'https://example.com/dummy-license.pdf',
        docType: 'Business License'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchProfile();
      alert('Document uploaded for verification!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Donor Dashboard</h1>
        <p className="text-gray-500">Manage your donations and verification status.</p>
      </div>

      <div className="grid gap-6">
        {/* Verification Status Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-2xl p-6 ${
            userData?.verificationStatus === 'Approved' ? 'bg-green-50 border-green-200' :
            userData?.verificationStatus === 'Rejected' ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                {userData?.verificationStatus === 'Approved' ? (
                  <><ShieldCheck className="text-green-600" /> Account Verified</>
                ) : userData?.verificationStatus === 'Rejected' ? (
                  <><AlertCircle className="text-red-600" /> Verification Rejected</>
                ) : (
                  <><Clock className="text-amber-600" /> Verification Pending</>
                )}
              </h2>
              <p className="text-gray-600 mb-4">
                {userData?.verificationStatus === 'Approved' 
                  ? 'Your account is fully verified. You can now list items for donation.'
                  : userData?.verificationStatus === 'Rejected'
                  ? 'Your verification was rejected. Please re-upload your documents for review.'
                  : 'Our admins are reviewing your documents. You will be notified once verified.'}
              </p>
              
              {userData?.verificationStatus !== 'Approved' && (
                <button
                  onClick={mockUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Upload size={18} />
                  {uploading ? 'Uploading...' : 'Re-upload License'}
                </button>
              )}
            </div>
            
            <div className="hidden sm:block">
              {userData?.verificationStatus === 'Approved' ? (
                <CheckCircle className="text-green-600 w-12 h-12" />
              ) : (
                <AlertCircle className="text-amber-600 w-12 h-12" />
              )}
            </div>
          </div>
        </motion.div>

        {/* Action Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
          <div className="group relative">
            <button
              disabled={!userData?.isVerified}
              className={`w-full max-w-xs flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                userData?.isVerified 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 cursor-pointer' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Donate Items
            </button>
            {!userData?.isVerified && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-3 py-1.5 rounded pointer-events-none whitespace-nowrap">
                Account pending verification
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

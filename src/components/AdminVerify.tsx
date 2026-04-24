import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';
import { motion } from 'motion/react';
import { ShieldAlert, CheckCircle2, XCircle, FileText, Upload } from 'lucide-react';

interface PendingUser {
  _id: string;
  email: string;
  role: string;
  uploadedDocuments: Array<{ name: string, url: string, docType: string }>;
}

export default function AdminVerify() {
  const { getIdToken } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      const token = await getIdToken();
      const res = await axios.get('/api/users/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch pending users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleVerify = async (userId: string, status: 'Approved' | 'Rejected') => {
    try {
      const token = await getIdToken();
      await axios.patch(`/api/users/verify/${userId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Verification failed');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading pending verifications...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <ShieldAlert className="text-amber-500" />
        Verification Queue
      </h1>

      {pendingUsers.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
          No pending verifications at the moment.
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingUsers.map(user => (
            <motion.div 
              key={user._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">{user.email}</span>
                  <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                    {user.role}
                  </span>
                </div>
                <div className="text-sm text-gray-500 flex flex-wrap gap-4 mt-3">
                  {user.uploadedDocuments.map((doc, idx) => (
                    <a 
                      key={idx}
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                    >
                      <FileText size={16} />
                      <span className="font-medium">{doc.docType}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => handleVerify(user._id, 'Approved')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
                <button 
                  onClick={() => handleVerify(user._id, 'Rejected')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <XCircle size={18} />
                  Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

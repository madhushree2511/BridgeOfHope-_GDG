import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { ShieldAlert, Users, TrendingUp, Check, X, FileText, Loader2, Trash2, Search, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import MapboxMap from './MapboxMap.tsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const { getIdToken } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const [verifiedNGOs, setVerifiedNGOs] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [showReqForm, setShowReqForm] = useState(false);
  const [newReq, setNewReq] = useState({ title: '', ngo: '', categoriesNeeded: [] as string[], documentUrl: '', urgency: 'Medium' });

  useEffect(() => {
    fetchAdminData();
    fetchNGORelatedData();
  }, []);

  const fetchNGORelatedData = async () => {
    try {
      const [ngosRes, reqsRes] = await Promise.all([
        axios.get('/api/ngo/verified-ngos'),
        axios.get('/api/ngo/requirements')
      ]);
      setVerifiedNGOs(ngosRes.data || []);
      setRequirements(reqsRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch NGO meta data:', err.message, err.response?.data);
    }
  };

  const createRequirement = async () => {
    try {
      const token = await getIdToken();
      await axios.post('/api/ngo/requirements', newReq, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowReqForm(false);
      fetchNGORelatedData();
      alert('Requirement linked successfully!');
    } catch (err) {
      alert('Failed to link requirement.');
    }
  };

  const deleteRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    try {
      const token = await getIdToken();
      await axios.delete(`/api/ngo/requirements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequirements(requirements.filter((r: any) => r._id !== id));
      alert('Requirement deleted successfully');
    } catch (err) {
      console.error('Delete requirement failed:', err);
      alert('Delete failed.');
    }
  };

  const fetchAdminData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      
      const token = await getIdToken();
      if (!token) {
        console.warn('No auth token available for admin fetch');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const [analyticsRes, usersRes, allUsersRes] = await Promise.all([
        axios.get('/api/donations/analytics/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/users/pending-approvals', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/users/all-users', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAnalytics(analyticsRes.data);
      console.log('Pending users fetched:', usersRes.data?.length);
      setPendingUsers(usersRes.data || []);
      setAllUsers(allUsersRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err.message, err.response?.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteUser = async (userId: string) => {
    if (!userId) {
      alert('Error: Invalid User ID');
      return;
    }
    
    console.log('Initiating delete for user ID:', userId);
    try {
      setDeletingUserId(userId);
      const token = await getIdToken();
      
      console.log('Sending DELETE request to /api/users/' + userId);
      const response = await axios.delete(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Delete response received:', response.data);
      
      // Update local state proactively
      setAllUsers((prev: any[]) => prev.filter((u: any) => u._id !== userId));
      setPendingUsers((prev: any[]) => prev.filter((u: any) => u._id !== userId));
      setConfirmDeleteId(null);
      
      alert('User account permanently deleted.');
    } catch (err: any) {
      console.error('Delete User Failed:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Deletion failed.';
      alert('Could not delete user: ' + errorMsg);
    } finally {
      setDeletingUserId(null);
    }
  };

  const wipeSystem = async () => {
    try {
      setIsWiping(true);
      const token = await getIdToken();
      const res = await axios.post('/api/users/system/wipe', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      // Since everyone was deleted, we force a reload which will redirect to login
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.error || 'System wipe failed');
    } finally {
      setIsWiping(false);
    }
  };

const approveUser = async (userId: string, action: 'Approved' | 'Rejected') => {
    let reason = '';
    if (action === 'Rejected') {
      reason = window.prompt('Please provide a reason for rejection (optional):') || 'Documents were unclear or invalid.';
    }

    try {
      setProcessingId(userId);
      const token = await getIdToken();
      await axios.post(`/api/users/approve/${userId}`, { status: action, reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(pendingUsers.filter((u: any) => u._id !== userId));
      // No alert here, the UI transition is confirmation enough
    } catch (err) {
      alert('Verification action failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const viewDoc = async (url: string) => {
    if (!url) return;
    try {
      // If it's already a full URL or an absolute path starting with /api
      if (url.startsWith('http') || url.startsWith('/api')) {
        const isExternal = url.startsWith('http') && !window.location.href.includes(new URL(url).host);
        
        if (isExternal) {
          window.open(url, '_blank');
          return;
        }

        // Licenses need token, products/profile images don't (but token doesn't hurt)
        const token = await getIdToken();
        const separator = url.includes('?') ? '&' : '?';
        window.open(`${url}${separator}token=${token}`, '_blank');
      } else {
        // Fallback for relative filenames (legacy or partial paths)
        const token = await getIdToken();
        // Try to guess if it's a license or a product/profile image
        const isLicense = url.startsWith('license-') || url.toLowerCase().includes('license');
        const basePath = isLicense ? '/api/users/documents/licenses/' : '/api/users/documents/products/';
        
        if (isLicense) {
          window.open(`${basePath}${url}?token=${token}`, '_blank');
        } else {
          window.open(`${basePath}${url}`, '_blank');
        }
      }
    } catch (err) {
      alert('Failed to get authorization for document.');
    }
  };

  if (loading) return <div className="p-12 text-center font-bold italic animate-pulse">Loading Admin Analytics Engine...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-12">
      <header className="flex flex-col md:flex-row items-start md:items-end justify-between border-b-4 border-slate-50 pb-10 gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 italic text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-4">Command Center</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">BridgeOfHope Admin Systems — Authorization Tier 1</p>
        </div>
        <div className="flex gap-4 items-center">
           <button 
             onClick={() => fetchAdminData(true)} 
             disabled={refreshing}
             className="bg-gray-100 p-4 rounded-2xl hover:bg-gray-200 transition-all disabled:opacity-50"
             title="Reload Data"
           >
             <TrendingUp className={`${refreshing ? 'animate-spin' : ''}`} size={20} />
           </button>
           <div className="bg-white border-2 border-gray-100 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-sm">
              <Users className="text-blue-600" />
              <div>
                <p className="text-xs font-black text-gray-400">PENDING VERIFICATIONS</p>
                <p className="text-2xl font-black">{pendingUsers.length}</p>
              </div>
           </div>
        </div>
      </header>

      {/* Analytics Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Resource Distribution */}
        <div className="bg-white border-2 border-gray-50 p-10 rounded-[3rem] shadow-xl shadow-gray-50">
           <h3 className="text-2xl font-black mb-8 tracking-tight flex items-center gap-3">
              <ShieldAlert className="text-blue-600" /> Resource Distribution
           </h3>
           <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.categoryDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(analytics?.categoryDistribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
           </div>
        </div>

        {/* Human Reach */}
        <div className="bg-white border-2 border-gray-50 p-10 rounded-[3rem] shadow-xl shadow-gray-50">
           <h3 className="text-2xl font-black mb-8 tracking-tight flex items-center gap-3">
              <TrendingUp className="text-green-600" /> Human Reach (Timeline)
           </h3>
           <div className="h-80 text-left">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.humanReach || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '20px' }} />
                <Line type="monotone" dataKey="helped" stroke="#10b981" strokeWidth={5} dot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
           </div>
        </div>

        {/* Utilization Rate */}
        <div className="bg-white border-2 border-gray-50 p-10 rounded-[3rem] shadow-xl shadow-gray-50 lg:col-span-2">
           <h3 className="text-2xl font-black mb-8 tracking-tight flex items-center gap-3">
              <Check size={28} className="text-purple-600" /> Utilization Rate (%)
           </h3>
           <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.categoryUtilization || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 'bold' }} domain={[0, 100]} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '20px' }} />
                <Bar dataKey="rate" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Strict Gatekeeping: Approvals */}
      <div className="bg-slate-50/50 rounded-[4rem] p-12 border-4 border-white shadow-2xl shadow-slate-200/20">
         <div className="flex items-center justify-between mb-10 px-4">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-8">Pending Verifications</h2>
            <div className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl shadow-sm text-sm font-black text-slate-500 flex items-center gap-2">
               <ShieldAlert size={18} className="text-blue-600" />
               {pendingUsers.length} Units Awaiting Review
            </div>
         </div>
         <div className="grid gap-8">
            <AnimatePresence mode="popLayout">
              {pendingUsers.length === 0 ? (
                <div className="text-center p-20">
                   <Check className="mx-auto text-gray-300 mb-4" size={48} />
                   <p className="text-gray-400 font-bold italic">Zero pending approvals. All systems clear.</p>
                </div>
              ) : (
                pendingUsers.map((user: any) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={user._id}
                    className="bg-white border border-gray-100 p-8 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-center gap-8"
                  >
                    <div className="flex-1 text-left">
                       <div className="flex flex-col md:flex-row gap-6 mb-6">
                          {/* Org/Shop Image */}
                          { (user.role === 'Donor' ? user.donorDetails?.shopImageUrl : user.ngoDetails?.profileImageUrl) ? (
                            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-gray-100 border-2 border-white shadow-lg shrink-0 group/img relative">
                               <img 
                                 src={user.role === 'Donor' ? user.donorDetails.shopImageUrl : user.ngoDetails.profileImageUrl} 
                                 alt={user.role === 'Donor' ? 'Shop' : 'NGO'} 
                                 className="w-full h-full object-cover" 
                                 referrerPolicy="no-referrer"
                                 onError={(e) => {
                                   const name = user.role === 'Donor' ? user.donorDetails?.shopName : user.ngoDetails?.officialName;
                                   (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&size=128`;
                                 }}
                               />
                               <div 
                                  onClick={() => viewDoc(user.role === 'Donor' ? user.donorDetails.shopImageUrl : user.ngoDetails.profileImageUrl)}
                                  className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                               >
                                  <ImageIcon size={24} className="text-white shadow-sm" />
                               </div>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-3xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0">
                               <ImageIcon size={32} className="text-gray-300" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-2xl font-black">
                                  {user.role === 'Donor' 
                                    ? (user.donorDetails?.shopName || user.displayName || 'Unnamed Shop')
                                    : (user.ngoDetails?.officialName || user.displayName || 'Unnamed NGO')
                                  }
                                </h4>
                                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest ${
                                  user.role === 'Donor' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                                  user.role === 'Admin' ? 'bg-red-500 text-white' : 
                                  'bg-blue-600 text-white'
                                }`}>
                                  {user.role === 'Donor' ? 'DONOR / BUSINESS' : user.role}
                                </span>
                            </div>
                            <p className="text-gray-500 font-bold mb-3">{user.email}</p>
                            
                             {/* Google Maps Integration */}
                            {((user.role === 'Donor' && user.donorDetails?.location) || (user.role !== 'Donor' && user.ngoDetails?.location)) && (
                              <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                                    <Search size={14} />
                                  </div>
                                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verified Location Map</h5>
                                </div>
                                <div className="w-full h-56 rounded-3xl overflow-hidden border-2 border-gray-100 shadow-inner bg-gray-50">
                                   <MapboxMap 
                                      address={user.role === 'Donor' 
                                        ? `${user.donorDetails?.location || ''}, ${user.donorDetails?.pincode || ''}`
                                        : `${user.ngoDetails?.location || ''}, ${user.ngoDetails?.city || ''}, ${user.ngoDetails?.pincode || ''}`
                                      } 
                                    />
                                </div>
                              </div>
                            )}

                            {/* Role based details */}
                            {user.role === 'Donor' && user.donorDetails && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="text-xs">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">Shop Location</span>
                                  <span className="font-bold text-gray-900">{user.donorDetails.location || 'N/A'}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">PIN Code</span>
                                  <span className="font-bold text-gray-900">{user.donorDetails.pincode || 'N/A'}</span>
                                </div>
                                <div className="text-xs sm:col-span-2">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">Contact Number</span>
                                  <span className="font-bold text-gray-900">{user.donorDetails.contactNumber || 'N/A'}</span>
                                </div>
                              </div>
                            )}

                            {user.role !== 'Donor' && user.ngoDetails && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="text-xs">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">Street Address</span>
                                  <span className="font-bold text-gray-900">{user.ngoDetails.location || 'N/A'}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">City</span>
                                  <span className="font-bold text-gray-900">{user.ngoDetails.city || 'N/A'}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">PIN Code</span>
                                  <span className="font-bold text-gray-900">{user.ngoDetails.pincode || 'N/A'}</span>
                                </div>
                                <div className="text-xs lg:col-span-3">
                                  <span className="text-gray-400 font-black uppercase tracking-tighter block mb-1">Contact Number</span>
                                  <span className="font-bold text-gray-900">{user.ngoDetails.contactNumber || 'N/A'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                       </div>

                       <div className="flex gap-4">
                          {Array.from(new Map((user.uploadedDocuments || []).map(doc => [doc.name, doc])).values()).map((doc: any, i: number) => (
                            <button 
                              key={i} 
                              onClick={() => viewDoc(doc.url)}
                              className="text-xs font-black text-blue-600 flex items-center gap-2 hover:underline bg-blue-50 px-5 py-3 rounded-xl cursor-pointer border border-blue-100 shadow-sm transition-all hover:bg-blue-100"
                            >
                              <FileText size={16} /> VIEW {doc.name.toUpperCase()}
                            </button>
                          ))}
                       </div>
                    </div>
                    <div className="flex gap-3">
                       <button 
                        onClick={() => approveUser(user._id, 'Approved')}
                        disabled={processingId === user._id}
                        className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {processingId === user._id ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                         APPROVE
                       </button>
                       <button 
                        onClick={() => approveUser(user._id, 'Rejected')}
                        disabled={processingId === user._id}
                        className="bg-white text-red-600 border-2 border-red-50 px-8 py-4 rounded-2xl font-black text-lg hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50"
                       >
                         <X size={20} /> REJECT
                       </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
         </div>
      </div>
      {/* All Registered Users */}
      <div className="bg-white border-2 border-gray-100 rounded-[3.5rem] p-12 shadow-sm">
         <h2 className="text-3xl font-black mb-8 tracking-tight">All Registered Entities</h2>
         <div className="grid gap-4">
            {allUsers.length === 0 ? (
              <p className="text-gray-400 font-bold italic text-center py-10">No users registered yet.</p>
            ) : (
              allUsers.map((user: any) => (
                <div key={user._id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex justify-between items-center group">
                   <div className="text-left">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-lg">{user.displayName}</h4>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          user.role === 'NGO' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {user.role}
                        </span>
                        {user.isVerified && <Check size={14} className="text-green-600" />}
                      </div>
                      <p className="text-gray-400 text-sm font-bold">{user.email}</p>
                   </div>
                   <div className="flex items-center gap-3">
                     {confirmDeleteId === user._id ? (
                       <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                         <button 
                           onClick={() => deleteUser(user._id)}
                           disabled={deletingUserId === user._id}
                           className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-800 transition-all flex items-center gap-2 shadow-lg shadow-red-200"
                         >
                           {deletingUserId === user._id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                           CONFIRM DELETE
                         </button>
                         <button 
                           onClick={() => setConfirmDeleteId(null)}
                           className="bg-gray-200 text-gray-600 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-300 transition-all"
                         >
                           CANCEL
                         </button>
                       </div>
                     ) : (
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           setConfirmDeleteId(user._id);
                         }}
                         className="p-4 text-red-400 hover:text-white hover:bg-red-600 rounded-2xl transition-all flex items-center justify-center border-2 border-red-50 shadow-sm active:scale-95 group/btn relative z-10"
                         title="Start Delete Process"
                       >
                         <div className="flex items-center gap-2">
                           <Trash2 size={24} className="group-hover/btn:scale-110 transition-transform" />
                           <span className="font-black text-xs uppercase tracking-wider">Delete Account</span>
                         </div>
                       </button>
                     )}
                   </div>
                </div>
              ))
            )}
         </div>
      </div>

      {/* NGO Requirement Management */}
      <div className="bg-white border-4 border-slate-50 rounded-[4rem] p-12 shadow-2xl shadow-slate-100/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 px-4">
          <h2 className="text-4xl font-black tracking-tight text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-8">Requirement Dataset Hub</h2>
          <button 
            onClick={() => setShowReqForm(!showReqForm)}
            className="w-full md:auto bg-[#0f172a] text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 group"
          >
            <FileText className="group-hover:rotate-12 transition-transform" />
            {showReqForm ? 'Close Document Panel' : '+ Link Official Requirement PDF'}
          </button>
        </div>

        {showReqForm && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-50 p-8 rounded-3xl mb-12 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Requirement Title</label>
              <input 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold"
                placeholder="e.g. Monthly Stationery Needs"
                onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Target NGO</label>
              <select 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold"
                onChange={(e) => setNewReq({ ...newReq, ngo: e.target.value })}
              >
                <option value="">Select a Verified NGO</option>
                {verifiedNGOs.map((ngo: any) => (
                  <option key={ngo._id} value={ngo._id}>{ngo.displayName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Requirement PDF URL</label>
              <input 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold"
                placeholder="https://drive.google.com/.../requirements.pdf"
                onChange={(e) => setNewReq({ ...newReq, documentUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase">Primary Category</label>
              <select 
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold"
                onChange={(e) => setNewReq({ ...newReq, categoriesNeeded: [e.target.value] })}
              >
                <option>Stationery</option>
                <option>Food</option>
                <option>Furniture</option>
                <option>Books</option>
                <option>Clothes</option>
                <option>Others</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button 
                onClick={createRequirement}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-50"
              >
                Submit to Hub
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid gap-4">
           {requirements.map((req: any) => (
             <div key={req._id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div className="text-left">
                   <h4 className="font-black text-lg">{req.title}</h4>
                   <p className="text-gray-400 text-sm font-bold">Linked to: {req.ngo?.displayName || 'Unknown NGO'}</p>
                </div>
<div className="flex gap-4">
   <button onClick={() => viewDoc(req.documentUrl)} className="bg-white border border-gray-100 p-3 rounded-xl text-blue-600 hover:bg-blue-50 transition-all cursor-pointer">
      <FileText size={20} />
   </button>
   <button 
    onClick={() => deleteRequirement(req._id)}
    className="bg-white border border-gray-100 p-3 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-2"
    title="Delete Requirement"
   >
      <Trash2 size={20} />
      <span className="font-black text-xs uppercase">Delete</span>
   </button>
</div>
             </div>
           ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-[3.5rem] p-12 border-2 border-red-100 shadow-xl shadow-red-50/50">
         <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-left">
               <h2 className="text-3xl font-black text-red-600 mb-2 tracking-tight flex items-center gap-3">
                  <ShieldAlert size={32} /> System Factory Reset
               </h2>
               <p className="text-red-400 font-bold max-w-xl">
                  WARNING: This will permanently delete all user accounts from Firebase and the database. 
                  All donations, NGO datasets, and profile records will be erased. Only use this for internal system maintenance.
               </p>
            </div>
            
            <div className="shrink-0">
               {!confirmWipe ? (
                 <button 
                  onClick={() => setConfirmWipe(true)}
                  className="bg-red-600 text-white px-10 py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-3 uppercase tracking-tighter"
                 >
                   <Trash2 size={24} /> Wipe System
                 </button>
               ) : (
                 <div className="flex flex-col gap-3">
                    <p className="text-center text-red-700 font-black text-xs uppercase animate-pulse mb-1">Are you absolutely sure?</p>
                    <div className="flex gap-3">
                       <button 
                        onClick={wipeSystem}
                        disabled={isWiping}
                        className="bg-red-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                       >
                         {isWiping ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                         YES, ERASE ALL
                       </button>
                       <button 
                        onClick={() => setConfirmWipe(false)}
                        className="bg-white text-red-900 px-8 py-4 rounded-2xl font-black border-2 border-red-100 hover:bg-red-100 transition-all"
                       >
                         CANCEL
                       </button>
                    </div>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

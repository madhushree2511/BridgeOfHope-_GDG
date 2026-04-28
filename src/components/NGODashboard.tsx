import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';
import { motion } from 'motion/react';
import { Package, ClipboardList, CheckSquare, TrendingUp, Star, Trash2, Upload, Clock, ShieldCheck, Image as ImageIcon, Sparkles, Brain } from 'lucide-react';
import MapboxMap from './MapboxMap.tsx';
import { runMatchmaking, MatchResult } from '../lib/gemini.ts';

export default function NGODashboard() {
  const { getIdToken, registeredUser, refreshProfile, setRegisteredUser, logout } = useAuth();
  const [availableDonations, setAvailableDonations] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [myRequirements, setMyRequirements] = useState([]);
  const [trustInfo, setTrustInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<any>(null);
  const [usageReport, setUsageReport] = useState({ peopleHelped: 0, impactDescription: '', evidenceImageUrl: '' });
  const [claiming, setClaiming] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [postingRequirement, setPostingRequirement] = useState(false);
  const [matchResults, setMatchResults] = useState<Record<string, MatchResult[]>>({});
  const [matchingStatus, setMatchingStatus] = useState<Record<string, boolean>>({});

  const [uploading, setUploading] = useState(false);
  const [uploadingUsage, setUploadingUsage] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [usageFile, setUsageFile] = useState<File | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [ngoForm, setNgoForm] = useState({
    officialName: '',
    location: '',
    city: '',
    pincode: '',
    contactNumber: ''
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reqForm, setReqForm] = useState({ title: '', description: '', urgency: 'High', categoriesNeeded: [] as string[], documentUrl: '' });

  const fetchNGOData = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleUnclaim = async (donationId: string) => {
    if (!confirm('Are you sure you want to unclaim this donation? It will be released for other NGOs.')) return;
    
    setLoading(true);
    try {
      const token = await getIdToken();
      await axios.patch(`/api/donations/${donationId}/unclaim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Donation released successfully.');
      fetchData();
    } catch (err: any) {
      console.error('Unclaim failed:', err);
      alert('Failed to release donation: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async (donationId: string) => {
    if (!confirm('Are you sure you don\'t want to claim this? It will be hidden from your list.')) return;
    
    // Optimistic Update: Remove from list immediately
    setAvailableDonations((prev: any) => prev.filter((d: any) => d._id !== donationId));
    
    try {
      const token = await getIdToken();
      await axios.post(`/api/donations/${donationId}/ignore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Silent refresh to ensure sync
      const donationsRes = await axios.get('/api/donations/available', { headers: { Authorization: `Bearer ${token}` } });
      setAvailableDonations(Array.from(new Map(donationsRes.data.map((d: any) => [d._id, d])).values()));
    } catch (err: any) {
      console.error('Ignore failed:', err);
      alert('Failed to ignore donation');
      fetchData(); // Rollback on error
    }
  };

  useEffect(() => {
    fetchData();
  }, [registeredUser]);

  const fetchData = async () => {
    if (!registeredUser) return;
    try {
      const token = await getIdToken();
      const [donationsRes, trustRes, myReqsRes, myClaimsRes] = await Promise.all([
        axios.get('/api/donations/available', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/ngo/trust-score/${registeredUser._id}`),
        axios.get('/api/ngo/requirements'),
        axios.get('/api/donations/my-claims', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAvailableDonations(Array.from(new Map(donationsRes.data.map((d: any) => [d._id, d])).values()));
      setTrustInfo(trustRes.data);
      setMyRequirements(myReqsRes.data.filter((r: any) => {
        const ngoId = r.ngo?._id || r.ngo;
        return ngoId?.toString() === registeredUser._id?.toString();
      }));
      setMyClaims(myClaimsRes.data);
    } catch (err) {
      console.error('Failed to fetch NGO data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfileImage(e.target.files[0]);
    }
  };

  const handleVerificationSubmit = async () => {
    if (!file || !ngoForm.officialName || !ngoForm.location || !ngoForm.city || !ngoForm.pincode || !ngoForm.contactNumber) {
      alert('Please fill all profile details and select your NGO license.');
      return;
    }
    
    setUploading(true);
    setSuccessMessage(null);
    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append('license', file);
      if (profileImage) {
        formData.append('profileImage', profileImage);
      }
      formData.append('officialName', ngoForm.officialName);
      formData.append('location', ngoForm.location);
      formData.append('city', ngoForm.city);
      formData.append('pincode', ngoForm.pincode);
      formData.append('contactNumber', ngoForm.contactNumber);

      const response = await axios.post('/api/users/submit-verification', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.status === 200 || response.status === 201) {
        setSuccessMessage(response.data.message || 'Verification request submitted!');
        setJustSubmitted(true);
        setFile(null);
        setProfileImage(null);
        setNgoForm({
          officialName: '',
          location: '',
          city: '',
          pincode: '',
          contactNumber: ''
        });
        if (response.data.user) {
          setRegisteredUser(response.data.user);
        }
        setTimeout(async () => {
          await refreshProfile();
          setJustSubmitted(false);
        }, 3000);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Submission failed';
      alert(`Error: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  const claimDonation = async (donationId: string) => {
    try {
      setClaiming(donationId);
      const token = await getIdToken();
      await axios.post(`/api/donations/${donationId}/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Donation claimed successfully! Please coordinate pickup with the donor.');
      fetchData(); // Refresh list
    } catch (err: any) {
      console.error('Claim failed:', err);
      alert(err.response?.data?.error || 'Failed to claim donation');
    } finally {
      setClaiming(null);
    }
  };

  const postRequirement = async () => {
    if (!reqForm.title.trim()) {
      alert('Please enter a title for your requirement.');
      return;
    }
    if (reqForm.categoriesNeeded.length === 0 || !reqForm.categoriesNeeded[0]) {
      alert('Please select a category.');
      return;
    }

    try {
      setPostingRequirement(true);
      const token = await getIdToken();
      const res = await axios.post('/api/ngo/requirements', reqForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowRequirementForm(false);
      setReqForm({ title: '', description: '', urgency: 'High', categoriesNeeded: [], documentUrl: '' });
      // Refresh
      fetchData();
      alert('Requirement posted successfully!');
      
      // Trigger Matchmaking
      if (res.data) {
        performMatchmaking(res.data);
      }
    } catch (err: any) {
      console.error('Post requirement failed:', err);
      alert(err.response?.data?.error || 'Failed to post requirement');
    } finally {
      setPostingRequirement(false);
    }
  };

  const performMatchmaking = async (req: any) => {
    const reqId = req._id;
    if (matchingStatus[reqId]) return;

    setMatchingStatus(prev => ({ ...prev, [reqId]: true }));
    try {
      const results = await runMatchmaking(req, availableDonations);
      if (results.length > 0) {
        setMatchResults(prev => ({ ...prev, [reqId]: results }));
      }
    } catch (err) {
      console.error('AI Matchmaking failed:', err);
    } finally {
      setMatchingStatus(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const deleteRequirement = async (id: string) => {
    console.log('Attempting to delete requirement:', id);
    try {
      setDeletingId(id);
      const token = await getIdToken();
      await axios.delete(`/api/ngo/my-requirements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Delete successful');
      fetchData();
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete requirement');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUsageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUsageFile(e.target.files[0]);
    }
  };

  const openUsageModal = (donation: any) => {
    setSelectedDonation(donation);
    setUsageReport({ peopleHelped: 0, impactDescription: '', evidenceImageUrl: '' });
    setUsageFile(null);
    setShowUsageModal(true);
  };

  const submitUsageReport = async () => {
    if (!selectedDonation) return;
    setUploadingUsage(true);
    try {
      const token = await getIdToken();
      let evidenceImageUrl = '';

      if (usageFile) {
        const formData = new FormData();
        formData.append('image', usageFile);
        const uploadRes = await axios.post('/api/users/upload-product-image', formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        evidenceImageUrl = uploadRes.data.url;
      }

      await axios.post(`/api/donations/${selectedDonation._id}/report`, {
        peopleHelped: usageReport.peopleHelped,
        usageDetails: usageReport.impactDescription,
        evidenceImageUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowUsageModal(false);
      setSelectedDonation(null);
      setUsageFile(null);
      alert('Impact report submitted! Thank you for closing the loop.');
      fetchData(); // Refresh to update status
    } catch (err) {
      alert('Failed to submit report.');
    } finally {
      setUploadingUsage(false);
    }
  };

  if (loading) return <div className="p-12 text-center font-bold italic">Loading NGO control center...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12">
       {/* Usage Report Modal */}
       {showUsageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
           <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-10 rounded-[3rem] max-w-md w-full shadow-2xl"
           >
              <h2 className="text-2xl font-black mb-2">Usage Report</h2>
              {selectedDonation && (
                <p className="text-blue-600 font-bold text-sm mb-4">
                  Reporting for Donation #{selectedDonation._id.slice(-6)}
                </p>
              )}
              <p className="text-gray-500 font-medium mb-8">How many people did this donation help?</p>
              <div className="space-y-6">
                 <div className="space-y-2 text-left">
                    <label className="text-xs font-black text-gray-400 uppercase">People Reached</label>
                    <input 
                      type="number" 
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none font-black text-xl"
                      value={usageReport.peopleHelped}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        setUsageReport({ ...usageReport, peopleHelped: isNaN(parsed) ? ('' as any) : parsed });
                      }}
                    />
                 </div>
                 <div className="space-y-2 text-left">
                    <label className="text-xs font-black text-gray-400 uppercase">Impact Story</label>
                    <textarea 
                      placeholder="Briefly describe how items were used..." 
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none min-h-32 font-medium"
                      value={usageReport.impactDescription}
                      onChange={(e) => setUsageReport({ ...usageReport, impactDescription: e.target.value })}
                    />
                 </div>
                 
                 <div className="space-y-2 text-left">
                    <label className="text-xs font-black text-gray-400 uppercase">Usage Evidence Image</label>
                    <div className="flex items-center gap-4">
                       <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                          {usageFile ? (
                            <img src={URL.createObjectURL(usageFile)} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <ImageIcon className="text-gray-300" size={32} />
                          )}
                       </div>
                       <input type="file" id="usage-image-upload" className="hidden" onChange={handleUsageFileChange} accept="image/*" />
                       <label htmlFor="usage-image-upload" className="bg-white border-2 border-gray-100 px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-gray-50 transition-all text-sm">
                         {usageFile ? 'Change Image' : 'Upload Image'}
                       </label>
                    </div>
                 </div>

                 <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        if (!registeredUser.isVerified) {
                          alert('NGO License is not verified yet.');
                          return;
                        }
                        submitUsageReport();
                      }} 
                      disabled={uploadingUsage}
                      className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploadingUsage ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Submit Impact'
                      )}
                    </button>
                    <button onClick={() => setShowUsageModal(false)} className="px-6 py-4 border border-gray-100 rounded-2xl font-black">Close</button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}
      <header className="flex flex-col md:flex-row items-start md:items-end justify-between border-b-4 border-slate-50 pb-10 gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 italic text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-4">NGO Hub</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">BridgeOfHope Partner Network — Ground Level Impact</p>
        </div>
        
        <div className="flex gap-4 items-center">
          {registeredUser.isVerified && (
            <div className="bg-white border-2 border-slate-100 px-6 py-4 rounded-[2rem] shadow-sm flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-xl text-green-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase">Verification</p>
                 <p className="text-sm font-black text-green-700">Verified NGO Partner</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          {trustInfo && registeredUser.isVerified && (
            <div className="bg-[#0f172a] text-white p-10 rounded-[3rem] shadow-2xl flex items-center gap-10">
              <div className="shrink-0 relative">
                 <div className="w-28 h-28 rounded-full border-8 border-blue-500/30 flex items-center justify-center">
                   <span className="text-4xl font-black">{trustInfo.trustScore}</span>
                 </div>
                 <div className="absolute -bottom-2 -right-2 bg-blue-600 p-2 rounded-lg shadow-lg">
                    <TrendingUp size={16} />
                 </div>
              </div>
              <div>
                <h3 className="text-2xl font-black mb-1">Trust Score</h3>
                <p className="text-gray-400 font-medium text-sm mb-4 leading-relaxed">
                  Based on {trustInfo.googleRating}★ Google Business & {trustInfo.internalRating}★ Partner Feedback
                </p>
                <div className="flex items-center gap-2">
                   <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(trustInfo.trustScore / 5) * 100}%` }}></div>
                   </div>
                   <span className="text-[10px] font-black text-blue-400">{(trustInfo.trustScore / 5) * 100}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {registeredUser.isVerified && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-green-50/50 border-4 border-white rounded-[3.5rem] p-10 shadow-2xl shadow-green-100/20 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
               <ShieldCheck size={120} />
            </div>
            <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="relative group/logo">
                  <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl shrink-0 bg-white flex items-center justify-center">
                    {registeredUser.ngoDetails?.profileImageUrl ? (
                      <img 
                        src={`${registeredUser.ngoDetails.profileImageUrl}?t=${Date.now()}`} 
                        alt="NGO Logo" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(registeredUser.ngoDetails?.officialName || 'N')}&background=random&size=128`;
                        }}
                      />
                    ) : (
                      <div className="text-green-600 font-black text-4xl">
                         {(registeredUser.ngoDetails?.officialName || 'N').charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-3xl font-black text-green-900 mb-2">{registeredUser.ngoDetails?.officialName}</h2>
                  <p className="text-green-800 text-lg font-medium leading-relaxed mb-4 opacity-80">
                    You are a verified institution. Your claims are prioritized for urgent relief.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="bg-white px-4 py-2 rounded-xl text-xs font-black text-green-600 shadow-sm border border-green-100">Verified Location</div>
                    <div className="bg-white px-4 py-2 rounded-xl text-xs font-black text-green-600 shadow-sm border border-green-100 uppercase tracking-widest">{registeredUser.ngoDetails?.city || 'Local'}</div>
                  </div>
                </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Verification Status Banner */}
      {!registeredUser.isVerified && (
        <div className="flex flex-col gap-6">
          {(!registeredUser.verificationStatus || registeredUser.verificationStatus === 'Rejected') && !justSubmitted ? (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-4 border-blue-50 rounded-[3rem] p-10 shadow-xl shadow-blue-50/50"
            >
              <div className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row gap-10 items-center">
                  <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 text-white">
                    <Upload size={48} />
                  </div>
                  <div className="flex-1 text-left">
                    <h2 className="text-3xl font-black text-gray-900 mb-2">NGO Verification Required</h2>
                    <p className="text-gray-500 font-medium text-lg max-w-xl">
                      To claim donations and post requirements, we need to verify your NGO status. Please fill out your profile and upload your official license.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <div className="space-y-6 text-left">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Official NGO Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Hope Foundation" 
                        className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                        value={ngoForm.officialName}
                        onChange={(e) => setNgoForm({...ngoForm, officialName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Street Address</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 123 Peace St" 
                        className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                        value={ngoForm.location}
                        onChange={(e) => setNgoForm({...ngoForm, location: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">City</label>
                        <input 
                          type="text" 
                          placeholder="Mumbai" 
                          className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                          value={ngoForm.city}
                          onChange={(e) => setNgoForm({...ngoForm, city: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">PIN Code</label>
                        <input 
                          type="text" 
                          placeholder="400001" 
                          className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                          value={ngoForm.pincode}
                          onChange={(e) => setNgoForm({...ngoForm, pincode: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Number</label>
                      <input 
                        type="tel" 
                        placeholder="+91 XXXXX XXXXX" 
                        className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold"
                        value={ngoForm.contactNumber}
                        onChange={(e) => setNgoForm({...ngoForm, contactNumber: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2 text-left">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Upload NGO Image</label>
                        <div className="flex items-center gap-4">
                           <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                              {profileImage ? (
                                <img src={URL.createObjectURL(profileImage)} className="w-full h-full object-cover" alt="Preview" />
                              ) : (
                                <ImageIcon className="text-gray-300" size={32} />
                              )}
                           </div>
                           <input type="file" id="profile-image-upload" className="hidden" onChange={handleProfileImageChange} accept="image/*" />
                           <label htmlFor="profile-image-upload" className="bg-white border-2 border-gray-100 px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-gray-50 transition-all text-sm">
                             Upload Image
                           </label>
                        </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Official NGO License</label>
                      <input 
                        type="file" 
                        id="license-upload"
                        className="hidden" 
                        onChange={handleFileChange}
                        accept=".pdf,image/*"
                      />
                      <label 
                        htmlFor="license-upload"
                        className="w-full flex items-center justify-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-900 px-8 py-5 rounded-2xl font-black text-center cursor-pointer transition-all border-2 border-dashed border-gray-300"
                      >
                        <Upload size={20} className="text-blue-500" />
                        {file ? file.name : 'Select NGO License (PDF/Image)'}
                      </label>
                    </div>

                    <button
                      onClick={handleVerificationSubmit}
                      disabled={uploading || !file || !ngoForm.officialName || !ngoForm.location || !ngoForm.city || !ngoForm.pincode || !ngoForm.contactNumber}
                      className="w-full bg-blue-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
                    >
                      {uploading ? (
                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck size={24} className="group-hover:scale-110 transition-transform" />
                          Submit for Verification
                        </>
                      )}
                    </button>
                    {successMessage && <p className="text-green-600 font-bold text-center animate-bounce">{successMessage}</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (registeredUser.verificationStatus === 'Pending' || justSubmitted) ? (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border-4 border-amber-100 rounded-[3rem] p-10 shadow-xl shadow-amber-50/50"
            >
              <div className="flex flex-col md:flex-row gap-10 items-center">
                <div className="flex flex-col gap-4 shrink-0">
                  <div className="bg-amber-500 p-8 rounded-[2.5rem] shadow-2xl shadow-amber-200 text-white flex items-center justify-center">
                    <Clock size={48} />
                  </div>
                  <div className="relative group/logo">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl bg-white flex items-center justify-center">
                      <img 
                        src={`${registeredUser.ngoDetails?.profileImageUrl}?t=${Date.now()}`} 
                        alt="NGO Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(registeredUser.ngoDetails?.officialName || 'N G O')}&background=random&size=128`;
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-3xl font-black text-amber-900 mb-2">Review in Progress: {registeredUser.ngoDetails?.officialName}</h2>
                  <p className="text-amber-800 font-medium text-lg max-w-xl">
                    Our team is currently verifying your NGO documents. This process usually takes 24 hours. We'll unlock full access once you're approved.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Available Donations */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3 underline decoration-blue-500 decoration-8 underline-offset-4">
               Available Contributions
            </h2>
            <div className="flex items-center gap-2">
              <Package className="text-blue-600 hidden sm:block" size={24} />
              <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black shadow-sm">{availableDonations.length} Active Lists</span>
            </div>
          </div>

          <div className="grid gap-6">
            {!registeredUser.isVerified ? (
              <div className="p-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 text-center flex flex-col items-center gap-4">
                <ShieldCheck size={64} className="text-gray-300" />
                <div>
                  <h3 className="text-2xl font-black text-gray-400">Claims Locked</h3>
                  <p className="text-gray-400 font-medium">Verify your NGO account to start claiming donations.</p>
                </div>
              </div>
            ) : availableDonations.length === 0 ? (
              <div className="p-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-center">
                 <p className="text-gray-400 font-medium italic">No pending donations at the moment. Check back soon!</p>
              </div>
            ) : (
              [...availableDonations, ...myClaims.filter((c: any) => c.status === 'Accepted')].map((donation: any) => {
                const isClaimedByMe = donation.ngo && (
                  (typeof donation.ngo === 'string' && donation.ngo === registeredUser?._id) || 
                  (donation.ngo._id && donation.ngo._id === registeredUser?._id)
                );

                return (
                  <motion.div 
                    key={donation._id}
                    whileHover={{ y: -4 }}
                    className={`border-2 rounded-[2.5rem] p-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 group transition-all ${isClaimedByMe ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-slate-50 shadow-slate-100/50 hover:border-blue-100'}`}
                  >
                    <div className="flex items-center gap-8 flex-1 text-left">
                      {donation.items.some((it: any) => it.imageUrl) ? (
                        <div className="w-28 h-28 rounded-[2rem] overflow-hidden bg-gray-50 border-2 border-white shrink-0 shadow-2xl">
                           <img 
                            src={`${donation.items.find((it: any) => it.imageUrl)?.imageUrl}?t=${Date.now()}`} 
                            alt="Donation Preview" 
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(donation.items[0]?.name || 'P')}&background=random&size=128`;
                            }}
                           />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-gray-50 border border-dashed border-gray-200 shrink-0 flex items-center justify-center text-gray-300">
                           <ImageIcon size={32} />
                        </div>
                      )}
                      <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {donation.items.map((it: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1 items-start">
                              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold border border-gray-200/50">
                                {it.name} ({it.quantity})
                              </span>
                              {(it.mrpPrice > 0 || it.wishingPrice > 0) && (
                                <div className="flex gap-2 text-[10px] font-black ml-1">
                                  {it.mrpPrice > 0 && <span className="text-gray-400 line-through">₹{it.mrpPrice}</span>}
                                  {it.wishingPrice > 0 && <span className="text-blue-600">Asking: ₹{it.wishingPrice}</span>}
                                  {it.wishingPrice === 0 && it.mrpPrice > 0 && <span className="text-green-600 uppercase">Free</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                          Donor: <span className="text-gray-900 font-bold">{donation.donor?.displayName || 'Unknown Donor'}</span> • 
                          Location: <span className="text-gray-900 font-bold">{donation.pickupAddress?.city || 'N/A'}</span>
                          {donation.contactNumber && (
                            <span className="ml-2 font-black text-gray-900">({donation.contactNumber})</span>
                          )}
                          {donation.pickupAddress?.street && (
                             <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${donation.pickupAddress.street}, ${donation.pickupAddress.city}, ${donation.pickupAddress.state}, ${donation.pickupAddress.zipCode}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:underline flex items-center gap-1 font-black text-xs"
                             >
                               View Map
                             </a>
                          )}
                        </p>
                        {isClaimedByMe && (
                           <p className="text-[10px] font-black text-blue-600 uppercase mt-2">Currently Claimed by You</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!isClaimedByMe ? (
                        <>
                          <button 
                            onClick={() => claimDonation(donation._id)}
                            disabled={claiming === donation._id}
                            className="whitespace-nowrap bg-blue-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                          >
                            {claiming === donation._id ? 'Claiming...' : 'Claim Donation'}
                          </button>
                          <button 
                            onClick={() => handleIgnore(donation._id)}
                            className="whitespace-nowrap bg-red-50 text-red-600 border border-red-100 px-8 py-3 rounded-2xl font-black hover:bg-red-100 transition-all text-xs uppercase tracking-widest"
                          >
                            Don't want to claim this
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleUnclaim(donation._id)}
                          className="whitespace-nowrap bg-red-50 text-red-600 border border-red-100 px-8 py-3 rounded-2xl font-black hover:bg-red-100 transition-all text-xs uppercase tracking-widest"
                        >
                          Don't want to claim this
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Claimed Donations Section */}
          <div className="space-y-6 pt-8">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <CheckSquare className="text-green-600" />
              My Claims & Logistics
            </h2>
            <div className="grid gap-4">
              {!registeredUser.isVerified ? (
                <div className="p-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 text-center flex flex-col items-center gap-4">
                   <ShieldCheck size={48} className="text-gray-300" />
                   <div>
                     <h3 className="text-xl font-black text-gray-400">Claims Log Locked</h3>
                     <p className="text-gray-400 font-medium leading-relaxed">Verification required to manage pickups and report logistics.</p>
                   </div>
                </div>
              ) : myClaims.length === 0 ? (
                <div className="p-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-center">
                   <p className="text-gray-400 font-medium italic">No claims yet. Available donations will appear above once you are verified.</p>
                </div>
              ) : (
                myClaims.map((claim: any) => (
                  <div key={claim._id} className="bg-green-50/50 border border-green-100 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6 flex-1 text-left">
                       <div className="relative group/img-fix">
                         {claim.items.some((it: any) => it.imageUrl) ? (
                           <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-green-100 shrink-0 shadow-sm">
                              <img 
                                src={`${claim.items.find((it: any) => it.imageUrl).imageUrl}?t=${Date.now()}`} 
                                alt="Claim Preview" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                   (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(claim.items[0]?.name || 'P')}&background=random&size=64`;
                                }}
                              />
                           </div>
                         ) : (
                           <div className="w-20 h-20 rounded-2xl bg-white border border-dashed border-green-200 shrink-0 flex items-center justify-center text-green-300">
                              <ImageIcon size={24} />
                           </div>
                         )}
                       </div>
                       <div>
                         <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${claim.status === 'Distributed' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                              {claim.status}
                            </span>
                            <span className="text-sm font-black text-gray-400">#{claim._id.slice(-6)}</span>
                         </div>
                         <div className="flex flex-wrap gap-2 mb-3">
                            {claim.items.map((it: any, i: number) => (
                              <div key={i} className="flex flex-col gap-1 items-start">
                                <span className="bg-white text-gray-700 px-3 py-1 rounded-lg text-xs font-bold border border-green-100">
                                  {it.name} ({it.quantity})
                                </span>
                                {(it.mrpPrice > 0 || it.wishingPrice > 0) && (
                                  <div className="flex gap-2 text-[10px] font-black ml-1 text-green-700">
                                    {it.mrpPrice > 0 && <span className="opacity-40 line-through">₹{it.mrpPrice}</span>}
                                    {it.wishingPrice > 0 && <span>₹{it.wishingPrice}</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                         </div>
                         <p className="text-sm font-medium text-gray-500 mb-2">
                            Pickup: <span className="text-gray-900 font-bold">{claim.donor.displayName}</span> ({claim.donor.email})
                         </p>
                         
                         <div className="flex flex-wrap gap-4 mt-2">
                           {claim.contactNumber && (
                             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm">
                               <span className="text-[10px] font-black text-blue-600 uppercase">Contact</span>
                               <a href={`tel:${claim.contactNumber}`} className="text-sm font-black text-gray-900 hover:text-blue-600 transition-colors">
                                 {claim.contactNumber}
                               </a>
                             </div>
                           )}
                           
                           {claim.pickupAddress?.street && (
                             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-green-100 shadow-sm">
                                <span className="text-[10px] font-black text-green-600 uppercase">Address</span>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${claim.pickupAddress.street}, ${claim.pickupAddress.city}, ${claim.pickupAddress.state}, ${claim.pickupAddress.zipCode}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-black text-gray-900 hover:text-green-600 transition-colors flex items-center gap-1"
                                >
                                  Open in Maps
                                </a>
                             </div>
                           )}
                         </div>
                       </div>
                    </div>
                    {claim.status !== 'Distributed' && (
                      <button 
                        onClick={() => openUsageModal(claim)}
                        className="whitespace-nowrap bg-gray-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-all"
                      >
                        Submit Usage Report
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        {/* Requirements Hub */}
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-4">
              Requirement Hub
            </h2>
            {myRequirements.length > 0 && (
              <span className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-xs font-black shadow-sm">{myRequirements.length} Posted</span>
            )}
          </div>

          <div className="bg-white border-2 border-slate-50 rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50">
            {!registeredUser.isVerified ? (
              <div className="text-center py-6">
                <div className="bg-gray-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <ShieldCheck className="text-gray-300" />
                </div>
                <h3 className="text-lg font-black text-gray-400 mb-2">Requirements Locked</h3>
                <p className="text-gray-400 text-sm font-medium leading-relaxed">Verification is required to post official needs.</p>
              </div>
            ) : !showRequirementForm ? (
              <div className="space-y-6">
                 <button 
                  onClick={() => setShowRequirementForm(true)}
                  className="w-full bg-[#0f172a] text-white px-8 py-5 rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 group"
                 >
                   <span className="group-hover:scale-110 transition-transform">+ Link New Requirement</span>
                 </button>
              </div>
            ) : (
              <div className="space-y-4">
                  <input 
                  placeholder="Need Title (e.g. Winter Clothes)" 
                  className="w-full bg-gray-50 p-4 rounded-xl outline-none border border-gray-100 font-bold"
                  value={reqForm.title}
                  onChange={(e) => setReqForm({...reqForm, title: e.target.value})}
                 />
                 <textarea 
                  placeholder="Describe your requirement..." 
                  className="w-full bg-gray-50 p-4 rounded-xl outline-none border border-gray-100 min-h-32"
                  value={reqForm.description}
                  onChange={(e) => setReqForm({...reqForm, description: e.target.value})}
                 />
                 <input 
                  placeholder="Official Requirement PDF Link" 
                  className="w-full bg-gray-50 p-4 rounded-xl outline-none border border-gray-100 font-medium"
                  value={reqForm.documentUrl}
                  onChange={(e) => setReqForm({...reqForm, documentUrl: e.target.value})}
                 />
                 <select 
                  className="w-full bg-gray-50 p-4 rounded-xl outline-none border border-gray-100 font-bold"
                  value={reqForm.categoriesNeeded[0] || ''}
                  onChange={(e) => setReqForm({...reqForm, categoriesNeeded: [e.target.value]})}
                 >
                    <option value="">Select Category</option>
                    <option>Stationery</option>
                    <option>Food</option>
                    <option>Furniture</option>
                    <option>Books</option>
                    <option>Clothes</option>
                    <option value="Other">Others</option>
                 </select>
                 <select 
                  className="w-full bg-gray-50 p-4 rounded-xl outline-none border border-gray-100 font-bold"
                  value={reqForm.urgency}
                  onChange={(e) => setReqForm({...reqForm, urgency: e.target.value})}
                 >
                    <option value="High">High (Immediate Need)</option>
                    <option value="Medium">Medium (Regular Supply)</option>
                    <option value="Low">Low (Future Requirement)</option>
                 </select>
                 <div className="flex gap-2">
                    <button 
                      onClick={postRequirement} 
                      disabled={postingRequirement}
                      className="flex-1 bg-gray-900 text-white py-4 rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {postingRequirement ? 'Processing...' : 'Submit'}
                    </button>
                    <button onClick={() => setShowRequirementForm(false)} className="px-6 py-4 border border-gray-200 rounded-xl font-bold">Back</button>
                 </div>
              </div>
            )}
          </div>

          {/* List of active needs posted by this NGO */}
          {myRequirements.length > 0 && (
            <div className="bg-white border-2 border-gray-50 rounded-[2.5rem] p-8 shadow-sm">
               <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                 Your Active Requirements
               </h3>
               <div className="space-y-4">
                  {myRequirements.map((req: any) => (
                    <div key={req._id} className="p-4 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-gray-800">{req.title}</span>
                        <div className="flex items-center gap-2">
                           <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${req.urgency === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{req.urgency}</span>
                        </div>
                      </div>

                      {/* AI Matches Section */}
                      {(matchResults[req._id] || matchingStatus[req._id]) && (
                        <div className="pt-4 border-t border-blue-50">
                          <div className="flex items-center gap-2 mb-3">
                             <Sparkles size={14} className="text-blue-600 animate-pulse" />
                             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">AI Suggested Matches</span>
                          </div>
                          
                          {matchingStatus[req._id] ? (
                            <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 animate-pulse">
                               <Brain size={16} className="text-blue-400" />
                               <span className="text-xs font-medium text-blue-600 italic">Finding matches in BridgeOfHope...</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                               {matchResults[req._id].map((match, idx) => {
                                 const donation = availableDonations.find(d => d._id === match.donationId);
                                 if (!donation) return null;
                                 return (
                                   <div key={idx} className="flex items-center justify-between p-3 bg-white border border-blue-50 rounded-2xl group/match hover:border-blue-200 transition-all shadow-sm">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                                            {Math.round(match.matchScore * 100)}%
                                         </div>
                                         <div className="text-left">
                                            <p className="text-xs font-black text-gray-800">Donation #{donation._id.slice(-6)}</p>
                                            <p className="text-[10px] text-gray-500 font-medium">{match.reason}</p>
                                         </div>
                                      </div>
                                      <button 
                                        onClick={() => claimDonation(donation._id)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-blue-100 opacity-0 group-hover/match:opacity-100 transition-all transform translate-x-2 group-hover/match:translate-x-0"
                                      >
                                        Quick Claim
                                      </button>
                                   </div>
                                 );
                               })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button 
                          onClick={() => performMatchmaking(req)}
                          disabled={matchingStatus[req._id]}
                          className="flex-1 bg-white border-2 border-blue-50 text-blue-600 py-3 rounded-2xl text-[10px] font-black hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group/ai"
                        >
                          <Sparkles size={14} className="group-hover/ai:rotate-12 transition-transform" />
                          {matchingStatus[req._id] ? 'Matching...' : 'Run AI Matchmaker'}
                        </button>
                        <button 
                          onClick={() => deleteRequirement(req._id)}
                          disabled={deletingId === req._id}
                          className="p-3 border-2 border-red-50 text-red-500 rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center"
                        >
                          {deletingId === req._id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* Impact Analysis Teaser */}
          <div className="bg-blue-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                <CheckSquare size={100} />
             </div>
             <h3 className="text-xl font-black mb-2">Submit Impact Reports</h3>
             <p className="text-blue-200 text-sm mb-6 font-medium leading-relaxed">Close the loop by reporting how donations were used. Boosts your trust score.</p>
             <button 
              onClick={() => {
                if (!registeredUser.isVerified) {
                  alert('Verification Pending: You can submit impact reports once your NGO license is verified.');
                  return;
                }
                setShowUsageModal(true);
              }}
              className={`px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 ${
                registeredUser.isVerified 
                  ? 'bg-white text-blue-900 hover:bg-blue-50' 
                  : 'bg-blue-800 text-blue-300 cursor-not-allowed'
              }`}
             >
               {!registeredUser.isVerified && <Clock size={16} />}
               {registeredUser.isVerified ? 'Pending Reports' : 'Verification Pending'}
             </button>
          </div>
        </div>
      </div>
    </div>

      {/* Danger Zone */}
      <div className="pt-12 border-t border-gray-100">
         <div className="bg-red-50/30 border border-red-100 rounded-[2.5rem] p-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-left">
               <h3 className="text-2xl font-black text-red-600 mb-2">Danger Zone</h3>
               <p className="text-gray-500 font-medium">Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
            <button 
              onClick={async () => {
                if (window.confirm('WARNING: Are you sure you want to PERMANENTLY delete your NGO account? All requirements and trust data will be lost.')) {
                  try {
                    const token = await getIdToken();
                    await axios.delete(`/api/users/${registeredUser._id}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    alert('Account deleted successfully.');
                    logout().then(() => {
                      window.location.href = '/';
                    });
                  } catch (err) {
                    alert('Failed to delete account.');
                  }
                }
              }}
              className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-red-100 hover:bg-red-700 transition-all whitespace-nowrap"
            >
              Delete NGO Account
            </button>
         </div>
      </div>
    </div>
  );
}

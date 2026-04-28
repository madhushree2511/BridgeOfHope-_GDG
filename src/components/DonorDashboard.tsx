import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.tsx';
import { motion } from 'motion/react';
import { Upload, Clock, CheckCircle, ShieldCheck, AlertTriangle, Camera, Trash2, Image as ImageIcon } from 'lucide-react';
import MapboxMap from './MapboxMap.tsx';

export default function DonorDashboard() {
  const { getIdToken, registeredUser, setRegisteredUser, refreshProfile, loading, user, error, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [itemUploading, setItemUploading] = useState<{ [key: number]: boolean }>({});
  const [verificationForm, setVerificationForm] = useState({
    shopName: '',
    location: '',
    pincode: '',
    contactNumber: '',
  });
  const [shopImage, setShopImage] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleVerificationSubmit = async () => {
    if (!licenseFile) {
      alert('Business License is required for verification.');
      return;
    }
    if (!verificationForm.shopName || !verificationForm.location || !verificationForm.pincode || !verificationForm.contactNumber) {
      alert('Please fill in all shop details.');
      return;
    }

    setUploading(true);
    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append('license', licenseFile);
      if (shopImage) formData.append('profileImage', shopImage);
      
      formData.append('shopName', verificationForm.shopName);
      formData.append('location', verificationForm.location);
      formData.append('pincode', verificationForm.pincode);
      formData.append('contactNumber', verificationForm.contactNumber);

      const response = await axios.post('/api/users/submit-verification', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.status === 200 || response.status === 201) {
        setSuccessMessage('Verification profile submitted! Admin review pending.');
        setJustSubmitted(true);
        if (response.data.user) {
          setRegisteredUser(response.data.user);
        }
        // Force refresh profile after a short delay to ensure state sync
        setTimeout(() => {
          refreshProfile();
          setJustSubmitted(false); // Reset to allow standard Pending card to show from DB
        }, 5000);
      }
    } catch (err: any) {
      alert('Verification submission failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  if (loading || (user && !registeredUser && !error)) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="p-12 text-center text-gray-500 font-medium italic">Synchronizing your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <div className="bg-red-50 border-2 border-red-100 p-12 rounded-[2.5rem] shadow-xl shadow-red-50">
          <div className="bg-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
             <ShieldCheck className="text-red-600" size={40} />
          </div>
          <h2 className="text-3xl font-black text-red-900 mb-4 tracking-tight">Database Offline</h2>
          <p className="text-red-700 mb-8 font-medium text-lg leading-relaxed max-w-md mx-auto">{error}</p>
          <button 
            onClick={() => refreshProfile()}
            className="bg-red-600 text-white px-12 py-4 rounded-2xl font-black hover:bg-red-700 transition-all font-sans text-lg shadow-xl shadow-red-200 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!registeredUser) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <h2 className="text-3xl font-black mb-4 font-sans tracking-tight">Profile Not Found</h2>
        <p className="text-gray-600 mb-8 font-sans text-lg">We couldn't retrieve your volunteer profile. This usually happens on the first sign-in or after a session timeout.</p>
        <button 
          onClick={() => {
            console.log('User manually retrying profile fetch');
            refreshProfile();
          }}
          className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all font-sans text-lg shadow-xl shadow-blue-200 cursor-pointer"
        >
          Initialize Profile
        </button>
      </div>
    );
  }

  const userData = registeredUser;
  const [donationForm, setDonationForm] = useState({
    items: [{ name: '', quantity: 1, category: 'Food', condition: 'Good', expiryDate: '', mrpPrice: 0, wishingPrice: 0, imageUrl: '' }],
    pickupAddress: { street: '', city: '', state: '', zipCode: '' },
    contactNumber: userData?.contactNumber || userData?.ngoDetails?.contactNumber || ''
  });
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [submittingDonation, setSubmittingDonation] = useState(false);
  const [myDonations, setMyDonations] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMyDonations = async () => {
    try {
      setLoadingHistory(true);
      const token = await getIdToken();
      const response = await axios.get('/api/donations/my-donations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyDonations(response.data);
    } catch (err) {
      console.error('Failed to fetch donation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => {
    if (registeredUser?.isVerified) {
      fetchMyDonations();
    }
  }, [registeredUser?.isVerified]);

  const handleAddItem = () => {
    setDonationForm({
      ...donationForm,
      items: [...donationForm.items, { name: '', quantity: 1, category: 'Food', condition: 'Good', expiryDate: '', mrpPrice: 0, wishingPrice: 0, imageUrl: '' }]
    });
  };

  const handleItemImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      console.log(`[ProductImage] Attempting upload for item ${index}: ${imageFile.name} (${imageFile.size} bytes)`);
      setItemUploading(prev => ({ ...prev, [index]: true }));
      try {
        const token = await getIdToken();
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await axios.post('/api/users/upload-product-image', formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data?.url) {
          console.log(`[ProductImage] Upload success for item ${index}:`, response.data.url);
          const newItems = [...donationForm.items];
          newItems[index].imageUrl = response.data.url;
          setDonationForm({ ...donationForm, items: newItems });
        } else {
          throw new Error('Server returned success but no URL found in response');
        }
      } catch (err: any) {
        console.error(`[ProductImage] Upload CRITICAL FAIL for item ${index}:`, err);
        const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message;
        alert(`Photo Upload Failed:\n\n${errorMsg}\n\nTip: Ensure Cloudinary credentials are set in Settings.`);
      } finally {
        setItemUploading(prev => ({ ...prev, [index]: false }));
      }
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems: any = [...donationForm.items];
    
    // Fix NaN for quantity and price: default to 0 if user clears input
    if (['quantity', 'mrpPrice', 'wishingPrice'].includes(field)) {
      const parsed = parseFloat(value);
      newItems[index][field] = isNaN(parsed) ? 0 : parsed;
    } else {
      newItems[index][field] = value;
    }
    
    setDonationForm({ ...donationForm, items: newItems });
  };

  const submitDonation = async () => {
    if (submittingDonation) return;
    try {
      // Validate food items for expiry date (must be > 48 hours)
      const now = new Date();
      const minimumExpiry = new Date(now.getTime() + (48 * 60 * 60 * 1000));
      
      for (const item of donationForm.items) {
        if (!item.imageUrl) {
          alert(`Please upload a photo for the item: ${item.name || 'unnamed item'}. Photos are required to ensure item quality.`);
          return;
        }

        if (item.category === 'Food') {
          if (!item.expiryDate) {
            alert(`Please provide an expiry date for ${item.name || 'food item'}.`);
            return;
          }
          const expiry = new Date(item.expiryDate);
          if (expiry <= minimumExpiry) {
            alert(`Donation Rejected: The food item "${item.name}" must have an expiry date at least 48 hours from now to ensure safe distribution.`);
            return;
          }
        }
        
        if (!item.name.trim()) {
          alert('Please provide a name for all items.');
          return;
        }

        if (item.quantity <= 0 || item.quantity === '') {
          alert('Quantity must be at least 1.');
          return;
        }
      }

      setSubmittingDonation(true);
      const token = await getIdToken();
      await axios.post('/api/donations', donationForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMyDonations();
      setSuccessMessage('Donation Listed Successfully! NGO partners will contact you soon.');
      setShowDonationForm(false);
      setDonationForm({
        items: [{ name: '', quantity: 1, category: 'Food', condition: 'Good', expiryDate: '', mrpPrice: 0, wishingPrice: 0, imageUrl: '' }],
        pickupAddress: { street: '', city: '', state: '', zipCode: '' },
        contactNumber: userData?.contactNumber || userData?.ngoDetails?.contactNumber || ''
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit donation');
    } finally {
      setSubmittingDonation(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12">
      <header className="flex flex-col md:flex-row items-start md:items-end justify-between border-b-4 border-slate-50 pb-10 gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 italic text-slate-900 underline decoration-blue-500 decoration-8 underline-offset-4">Donor Hub</h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">BridgeOfHope Volunteer Network — Global Impact</p>
        </div>
        
        <div className="flex gap-4 items-center">
          {userData.isVerified && (
            <div className="bg-white border-2 border-slate-100 px-6 py-4 rounded-[2rem] shadow-sm flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-xl text-green-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase">Verification</p>
                 <p className="text-sm font-black text-green-700">Level 1 Partner</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-100 border border-green-200 text-green-700 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3 shadow-sm font-bold"
        >
          <CheckCircle size={24} />
          {successMessage}
        </motion.div>
      )}

      <div className="grid gap-8">
        {/* Verification Logic */}
        {(!userData.verificationStatus || userData.verificationStatus === 'Rejected') && !justSubmitted ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border-2 border-blue-50 rounded-3xl p-8 shadow-sm"
          >
            <div className="flex flex-col gap-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                   <div className="bg-blue-600 p-2 rounded-xl text-white">
                      <ShieldCheck size={24} />
                   </div>
                   <h2 className="text-2xl font-black tracking-tight">Business Verification Hub</h2>
                </div>
                <p className="text-gray-500 font-medium">To maintain a secure network, all donors must verify their location and registration status.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase">Shop / Business Name</label>
                    <input 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-bold"
                      placeholder="Enter legal business name"
                      value={verificationForm.shopName}
                      onChange={(e) => setVerificationForm({...verificationForm, shopName: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase">Contact Number</label>
                    <input 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-bold"
                      placeholder="Business phone number"
                      value={verificationForm.contactNumber}
                      onChange={(e) => setVerificationForm({...verificationForm, contactNumber: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase">Exact Location / Address</label>
                    <input 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-bold"
                      placeholder="Address"
                      value={verificationForm.location}
                      onChange={(e) => setVerificationForm({...verificationForm, location: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase">PIN Code</label>
                    <input 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-bold"
                      placeholder="6-digit postal code"
                      value={verificationForm.pincode}
                      onChange={(e) => setVerificationForm({...verificationForm, pincode: e.target.value})}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                       <ImageIcon className="text-blue-600" size={20} />
                       <h4 className="text-sm font-black uppercase">Shop Image</h4>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setShopImage(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-black cursor-pointer"
                    />
                    {shopImage && <p className="mt-2 text-xs font-bold text-green-600">✓ {shopImage.name}</p>}
                 </div>

                 <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                       <Upload className="text-blue-600" size={20} />
                       <h4 className="text-sm font-black uppercase">Shop License <span className="text-red-500">*</span></h4>
                    </div>
                    <input 
                      type="file" 
                      accept=".pdf,image/*"
                      onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-black cursor-pointer"
                    />
                    {licenseFile && <p className="mt-2 text-xs font-bold text-green-600">✓ {licenseFile.name}</p>}
                 </div>
              </div>

              <button
                onClick={handleVerificationSubmit}
                disabled={uploading || !licenseFile}
                className="w-full sm:w-auto self-center flex items-center justify-center gap-3 bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black text-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-blue-100"
              >
                {uploading ? <Clock className="animate-spin" /> : <ShieldCheck />}
                {uploading ? 'Verifying Details...' : 'Submit Profile for Approval'}
              </button>
            </div>
          </motion.div>
        ) : (userData.verificationStatus === 'Pending' || justSubmitted) ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-8"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex flex-col gap-4 shrink-0">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-center">
                  <Clock className="text-amber-600" size={32} />
                </div>
                <div className="relative group">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center">
                    {userData.donorDetails?.shopImageUrl ? (
                      <img 
                        src={userData.donorDetails.shopImageUrl} 
                        alt="Shop Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                           (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.donorDetails?.shopName || 'S')}&background=random&size=128`;
                        }}
                      />
                    ) : (
                      <div className="text-gray-300 font-black text-4xl">
                        {(userData.donorDetails?.shopName || 'S').charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-bold text-amber-900 mb-2">Verification Under Review</h2>
                <p className="text-amber-800 text-lg leading-relaxed">
                  Our administrators are carefully reviewing your submitted documents for <b>{userData.donorDetails?.shopName}</b>. This process usually takes 24-48 hours. We'll update your dashboard as soon as the process is complete.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border-2 border-green-100 rounded-3xl p-8"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex flex-col gap-4 shrink-0">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-100 flex items-center justify-center">
                  <ShieldCheck className="text-green-600" size={32} />
                </div>
                <div className="relative group">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center">
                    {userData.donorDetails?.shopImageUrl ? (
                      <img 
                        src={`${userData.donorDetails.shopImageUrl}?t=${Date.now()}`} 
                        alt="Shop Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                           (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.donorDetails?.shopName || 'Shop')}&background=random&size=128`;
                        }}
                      />
                    ) : (
                      <div className="text-gray-300 font-black text-4xl">
                        {(userData.donorDetails?.shopName || 'S').charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-2xl font-bold text-green-900 mb-2">Verified Partner: {userData.donorDetails?.shopName}</h2>
                <p className="text-green-800 text-lg leading-relaxed mb-6">
                  Your account is fully verified! You are now an active member of the BridgeOfHope network.
                </p>
                
                {userData.donorDetails?.location && (
                  <div className="bg-white overflow-hidden rounded-[2.5rem] border-4 border-white shadow-2xl aspect-video">
                     <MapboxMap address={`${userData.donorDetails.location}, ${userData.donorDetails.pincode}`} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Global Action Section */}
        {userData.isVerified && (
          <div className="bg-white border-2 border-gray-100 rounded-3xl p-10 shadow-sm relative overflow-hidden">
            {!showDonationForm ? (
              <>
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Upload size={120} />
                </div>
                <h3 className="text-2xl font-black mb-2 tracking-tight text-gray-900 text-left">Help Someone Today</h3>
                <p className="text-gray-500 mb-8 max-w-md text-left font-medium">As a verified member, you can list items for donation. Our safety algorithm will validate expiry dates and conditions.</p>
                <button
                  onClick={() => setShowDonationForm(true)}
                  className="flex items-center justify-center gap-3 px-12 py-5 rounded-2xl font-black text-xl bg-gray-900 hover:bg-black text-white shadow-2xl shadow-gray-200 cursor-pointer transition-all active:scale-95"
                >
                  Create New Donation
                </button>
              </>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black tracking-tight">New Donation List</h3>
                  <button onClick={() => setShowDonationForm(false)} className="text-red-500 font-black hover:bg-red-50 px-4 py-2 rounded-xl transition-all">Cancel</button>
                </div>

                <div className="space-y-6">
                  {donationForm.items.map((item, index) => (
                    <React.Fragment key={index}>
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase">Item Name</label>
                          <input 
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                            placeholder="e.g., Rice, Sofa..."
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase">Category</label>
                          <select 
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium"
                            value={item.category}
                            onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                          >
                            <option>Food</option>
                            <option>Furniture</option>
                            <option>Books</option>
                            <option>Clothes</option>
                            <option>Others</option>
                          </select>
                        </div>
                        
                        {item.category === 'Food' ? (
                          <div className="space-y-2">
                            <label className="text-xs font-black text-red-500 uppercase">Expiry Date</label>
                            <input 
                              type="date"
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium"
                              value={item.expiryDate}
                              onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase">Condition</label>
                            <select 
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium"
                              value={item.condition}
                              onChange={(e) => handleItemChange(index, 'condition', e.target.value)}
                            >
                              <option>New</option>
                              <option>Good</option>
                              <option>Fair</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase">Quantity</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium"
                            value={item.quantity}
                            placeholder="0"
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-tighter">MRP Price (₹)</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none font-medium text-xs"
                            value={item.mrpPrice}
                            placeholder="0"
                            onChange={(e) => handleItemChange(index, 'mrpPrice', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-blue-500 uppercase tracking-tighter">Wishing Price (₹)</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 outline-none font-medium text-xs"
                            value={item.wishingPrice}
                            placeholder="0"
                            onChange={(e) => handleItemChange(index, 'wishingPrice', e.target.value)}
                          />
                        </div>

                        {/* Image Upload Area */}
                        <div className="md:col-span-2 lg:col-span-4 mt-4">
                           <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-blue-100">
                              <div className="relative w-full md:w-32 h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center overflow-hidden shrink-0 group">
                                 {item.imageUrl ? (
                                   <>
                                     <img src={`${item.imageUrl}?t=${Date.now()}`} alt="Preview" className="w-full h-full object-cover" />
                                     <button 
                                      onClick={() => handleItemChange(index, 'imageUrl', '')}
                                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                                     >
                                        <Trash2 size={24} />
                                     </button>
                                   </>
                                 ) : itemUploading[index] ? (
                                   <div className="animate-pulse flex flex-col items-center gap-2">
                                      <div className="w-8 h-8 rounded-full border-b-2 border-blue-600 animate-spin"></div>
                                      <span className="text-[10px] font-bold text-blue-600">Uploading</span>
                                   </div>
                                 ) : (
                                   <Camera size={28} className="text-gray-300" />
                                 )}
                              </div>
                              <div className="flex-1 text-center md:text-left">
                                 <h4 className="text-sm font-black text-gray-900 mb-1">Product Photo <span className="text-red-500">*Required</span></h4>
                                 <p className="text-xs text-gray-400 font-medium mb-3">Upload a clear photo to help NGOs identify the item faster.</p>
                                 <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                    <input 
                                      type="file" 
                                      id={`item-img-${index}`} 
                                      className="hidden" 
                                      onChange={(e) => handleItemImageUpload(index, e)}
                                      accept="image/*"
                                    />
                                    <label 
                                      htmlFor={`item-img-${index}`}
                                      className="bg-blue-600 text-white px-5 py-2 rounded-lg text-xs font-black cursor-pointer shadow-lg shadow-blue-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                       <Upload size={14} />
                                       {item.imageUrl ? 'Change Photo' : 'Choose Photo'}
                                    </label>
                                    {item.imageUrl && (
                                       <span className="bg-green-50 text-green-600 px-3 py-2 rounded-lg text-[10px] font-black border border-green-100 flex items-center gap-1">
                                          <ShieldCheck size={12} /> Image Ready
                                       </span>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>

                      {item.category === 'Food' && (
                         <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start animate-pulse">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-1" />
                            <div className="text-left">
                               <p className="text-xs font-black text-amber-900 mb-1">Food Safety Protocol (48h Rule)</p>
                               <p className="text-[11px] text-amber-800 leading-relaxed font-medium"> To ensure safe consumption, all food donations must have an expiry date at least 48 hours from the time of submission. This allows our NGO partners enough time for logistics and distribution.</p>
                            </div>
                         </div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  <button 
                    onClick={handleAddItem}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:bg-gray-50 hover:border-blue-300 hover:text-blue-500 transition-all"
                  >
                    + Add Another Item
                  </button>

                  <div className="pt-6 border-t border-gray-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                      <h4 className="text-lg font-black tracking-tight">Pickup & Contact Info</h4>
                      <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                        Required for Coordination
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase">Contact Number</label>
                        <input 
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-bold text-gray-700"
                          placeholder="Donor Phone Number"
                          value={donationForm.contactNumber}
                          onChange={(e) => setDonationForm({ ...donationForm, contactNumber: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase">Street Address</label>
                        <input 
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-medium"
                          placeholder="Street Address"
                          value={donationForm.pickupAddress.street}
                          onChange={(e) => setDonationForm({ ...donationForm, pickupAddress: { ...donationForm.pickupAddress, street: e.target.value }})}
                        />
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-gray-400 uppercase">City</label>
                           <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-medium"
                            placeholder="City"
                            value={donationForm.pickupAddress.city}
                            onChange={(e) => setDonationForm({ ...donationForm, pickupAddress: { ...donationForm.pickupAddress, city: e.target.value }})}
                          />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-gray-400 uppercase">State</label>
                           <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none font-medium"
                            placeholder="State"
                            value={donationForm.pickupAddress.state}
                            onChange={(e) => setDonationForm({ ...donationForm, pickupAddress: { ...donationForm.pickupAddress, state: e.target.value }})}
                          />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-gray-400 uppercase">ZIP Code</label>
                           <input 
                            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 outline-none w-full font-medium"
                            placeholder="ZIP"
                            value={donationForm.pickupAddress.zipCode}
                            onChange={(e) => setDonationForm({ ...donationForm, pickupAddress: { ...donationForm.pickupAddress, zipCode: e.target.value }})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={submitDonation}
                    disabled={submittingDonation}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {submittingDonation ? 'Submitting...' : 'Submit Donation for Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!userData.isVerified && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center text-center opacity-70">
            <ShieldCheck className="text-gray-300 mb-4" size={60} />
            <h3 className="text-xl font-bold text-gray-400">Unlock Donation Postings</h3>
            <p className="text-gray-400 max-w-xs mt-2">Finish your verification profile above to start contributing to our network.</p>
          </div>
        )}
      </div>

        {/* My Past Donations Section */}
        {userData.isVerified && !showDonationForm && (
          <div className="mt-12 space-y-8">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-4xl font-black tracking-tight text-gray-900 underline decoration-blue-500 decoration-8 underline-offset-8">Your Impact History</h3>
              <button 
                onClick={fetchMyDonations}
                className="bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-2xl text-blue-600 font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
              >
                <Clock size={16} /> Sync Data
              </button>
            </div>
            
            {loadingHistory ? (
              <div className="py-20 text-center bg-white border-2 border-gray-100 rounded-3xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500 font-medium">Loading history...</p>
              </div>
            ) : myDonations.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2.5rem] p-12 text-center">
                <p className="text-gray-400 font-medium text-lg">No past donations yet. Your contributions will appear here once you list them.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myDonations.map((donation) => (
                  <motion.div 
                    key={donation._id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border-2 border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${
                          donation.status === 'Distributed' ? 'bg-green-100 text-green-600' : 
                          donation.status === 'Claimed' || donation.status === 'PickedUp' ? 'bg-blue-100 text-blue-600' :
                          donation.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {donation.status === 'Distributed' ? <CheckCircle size={24} /> : 
                           donation.status === 'Rejected' ? <AlertTriangle size={24} /> : 
                           <Clock size={24} />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-4 mb-3">
                            {donation.items.map((it: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 bg-gray-50 pr-4 rounded-xl border border-gray-100 group/item-fix overflow-hidden">
                                <div className="relative">
                                  {it.imageUrl ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                                      <img 
                                        src={`${it.imageUrl}?t=${Date.now()}`} 
                                        alt={it.name} 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(it.name || 'P')}&background=random&size=48`;
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                       <ImageIcon className="text-gray-400" size={16} />
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-black text-gray-800">
                                  {it.name} ({it.quantity})
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                            {new Date(donation.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter border-2 ${
                         donation.status === 'Distributed' ? 'bg-green-50 border-green-100 text-green-600' : 
                         donation.status === 'Claimed' || donation.status === 'PickedUp' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                         donation.status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-600' :
                         'bg-amber-50 border-amber-100 text-amber-600'
                      }`}>
                        {donation.status}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Danger Zone */}
      <div className="pt-12 border-t border-gray-100 mt-12">
         <div className="bg-red-50/30 border border-red-100 rounded-[2.5rem] p-10 flex flex-col md:flex-row justify-between items-center gap-8 text-left">
            <div>
               <h3 className="text-2xl font-black text-red-600 mb-2">Danger Zone</h3>
               <p className="text-gray-500 font-medium">Permanently delete your account and all associated donation data. This action cannot be undone.</p>
            </div>
            <button 
              onClick={async () => {
                if (window.confirm('WARNING: Are you sure you want to PERMANENTLY delete your account? This action is irreversible.')) {
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
              Delete Account
            </button>
         </div>
      </div>
    </div>
  );
}

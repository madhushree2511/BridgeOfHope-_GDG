import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Search, ExternalLink, AlertTriangle, X, Trash2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext.tsx';
import MapboxMap from './MapboxMap.tsx';

export default function RequirementHub() {
  const { getIdToken, registeredUser } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showMapFor, setShowMapFor] = useState<string | null>(null);

  useEffect(() => {
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    try {
      const res = await axios.get('/api/ngo/requirements');
      setRequirements(res.data);
    } catch (err) {
      console.error('Failed to fetch requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this requirement?')) return;
    try {
      setDeletingId(id);
      const token = await getIdToken();
      await axios.delete(`/api/ngo/my-requirements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequirements();
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = requirements.filter((req: any) => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          req.ngo?.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || req.categoriesNeeded.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'Food', 'Furniture', 'Books', 'Stationery', 'Clothes', 'Others'];

  const handleOpenPdf = async (url: string) => {
    try {
      let finalUrl = url;
      
      // Transform Google Drive links to embeddable format
      if (url.includes('drive.google.com')) {
        if (url.includes('/view')) {
          finalUrl = url.replace('/view', '/preview');
        } else if (!url.endsWith('/preview')) {
          const match = url.match(/\/file\/d\/([^/]+)/);
          if (match && match[1]) {
            finalUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
          }
        }
      } 
      // For other external PDFs, use Google Docs Viewer as a proxy to bypass X-Frame-Options
      else if (!url.startsWith('/api') && !url.startsWith('blob:') && url.toLowerCase().endsWith('.pdf')) {
        finalUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
      }

      if (finalUrl.startsWith('/api')) {
        const token = await getIdToken();
        const fullUrl = finalUrl.includes('?') ? `${finalUrl}&token=${token}` : `${finalUrl}?token=${token}`;
        setViewingPdf(fullUrl);
      } else {
        setViewingPdf(finalUrl);
      }
    } catch (err) {
      setViewingPdf(url);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black tracking-tight mb-4">NGO Requirement Hub</h1>
        <p className="text-gray-500 font-bold text-xl">Browse official documents and real-time needs of our partner organizations.</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-12">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Search by NGO name or requirement..."
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-4 rounded-2xl font-black transition-all whitespace-nowrap ${
                selectedCategory === cat 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white border-2 border-gray-50 text-gray-400 hover:border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((req: any) => (
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={req._id}
            className="bg-white border-2 border-gray-50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${
                req.urgency === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                <FileText size={24} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                  req.urgency === 'High' ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-500'
                }`}>
                  {req.urgency} Priority
                </span>
                {registeredUser && (req.ngo?._id === registeredUser._id || req.ngo === registeredUser._id) && (
                  <button 
                    onClick={() => handleDelete(req._id)}
                    disabled={deletingId === req._id}
                    className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-xl transition-all disabled:opacity-50"
                  >
                    {deletingId === req._id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="text-2xl font-black mb-2 line-clamp-1">{req.title}</h3>
            <p className="text-gray-400 font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {req.ngo?.displayName}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {req.categoriesNeeded.map((cat: string) => (
                <span key={cat} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">
                  #{cat}
                </span>
              ))}
            </div>

            <AnimatePresence>
              {showMapFor === req._id && req.ngo?.ngoDetails?.location && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 180, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-6 rounded-2xl overflow-hidden border-2 border-blue-50"
                >
                  <MapboxMap 
                    address={`${req.ngo.ngoDetails.location}, ${req.ngo.ngoDetails.city}, ${req.ngo.ngoDetails.pincode}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button 
                onClick={() => handleOpenPdf(req.documentUrl)}
                className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-black transition-all"
              >
                View PDF
              </button>
              {req.ngo?.ngoDetails?.location && (
                <button 
                  onClick={() => setShowMapFor(showMapFor === req._id ? null : req._id)}
                  className={`p-4 rounded-2xl transition-all ${
                    showMapFor === req._id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="View NGO Location"
                >
                  <MapPin size={20} />
                </button>
              )}
              <a 
                href={req.documentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all"
              >
                <ExternalLink size={20} />
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
           <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
           <p className="text-gray-400 font-black text-xl">No requirements found matching your filters.</p>
        </div>
      )}

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {viewingPdf && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full h-full max-w-6xl rounded-[3rem] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b flex justify-between items-center bg-white">
                <div className="flex items-center gap-4 text-blue-600">
                  <FileText size={24} />
                  <span className="font-black text-xl">Document Viewer</span>
                </div>
                <button 
                  onClick={() => setViewingPdf(null)}
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 bg-gray-100 overflow-hidden">
                <iframe 
                  src={viewingPdf} 
                  className="w-full h-full border-none"
                  title="PDF Document"
                />
              </div>
              <div className="p-6 bg-gray-50 flex flex-col items-center gap-4">
                <p className="text-gray-400 font-bold text-xs flex items-center gap-2">
                   <AlertTriangle size={14} />
                   Note: External PDF preview depends on the provider's embed permissions.
                </p>
                <a 
                  href={viewingPdf.includes('docs.google.com/viewer') ? decodeURIComponent(viewingPdf.split('url=')[1].split('&')[0]) : viewingPdf}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-100 text-blue-600 px-6 py-2 rounded-xl text-xs font-black hover:bg-blue-200 transition-all flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  Open Original Document
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

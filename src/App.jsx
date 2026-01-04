import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  Star, 
  MapPin, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Save, 
  Loader2 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy 
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAU8KiDVf10Vc8TC_BMrfAuDKtCTKtH56g",
  authDomain: "denver-coffee-rater.firebaseapp.com",
  projectId: "denver-coffee-rater",
  storageBucket: "denver-coffee-rater.firebasestorage.app",
  messagingSenderId: "600755448882",
  appId: "1:600755448882:web:32afd9e59ffe6f5872202b",
  measurementId: "G-VCB5KZ4CPY"
}
;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState(null); // For editing
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    rating: 0,
    notes: '',
    tags: '' // stored as simple string in form, array in db
  });

  // 1. Authentication Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Firestore)
  useEffect(() => {
    if (!user) return;

    // Path: artifacts/{appId}/users/{userId}/coffee_shops
    const shopsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');
    
    // Note: Simple query without orderBy to comply with "No Complex Queries" rule initially,
    // sorting will be done in memory if needed or simple queries.
    // However, basic orderBy on a single field usually works without index if the collection is small 
    // or sometimes requires index. To be safe per strict rules, we fetch and sort in JS.
    const q = query(shopsRef); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shopsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in memory by createdAt descending (newest first)
      shopsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setShops(shopsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching shops:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Handlers ---

  const handleOpenModal = (shop = null) => {
    if (shop) {
      setCurrentShop(shop);
      setFormData({
        name: shop.name,
        location: shop.location,
        rating: shop.rating,
        notes: shop.notes,
        tags: shop.tags ? shop.tags.join(', ') : ''
      });
    } else {
      setCurrentShop(null);
      setFormData({
        name: '',
        location: '',
        rating: 0,
        notes: '',
        tags: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentShop(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.name.trim()) return;

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
    
    const shopData = {
      name: formData.name,
      location: formData.location,
      rating: formData.rating,
      notes: formData.notes,
      tags: tagsArray,
      updatedAt: serverTimestamp()
    };

    try {
      if (currentShop) {
        // Update
        const shopRef = doc(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops', currentShop.id);
        await updateDoc(shopRef, shopData);
      } else {
        // Create
        const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');
        await addDoc(collectionRef, {
          ...shopData,
          createdAt: serverTimestamp()
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving shop:", error);
    }
  };

  const handleDelete = async (shopId) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this coffee shop?')) {
      try {
        const shopRef = doc(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops', shopId);
        await deleteDoc(shopRef);
      } catch (error) {
        console.error("Error deleting shop:", error);
      }
    }
  };

  // Filter shops
  const filteredShops = shops.filter(shop => 
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (shop.tags && shop.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-700 rounded-lg text-white">
              <Coffee size={24} />
            </div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">Bean Rater</h1>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-full font-medium transition-colors text-sm"
          >
            <Plus size={18} />
            <span>Add Shop</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, location, or tags..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-amber-600" size={32} />
          </div>
        )}

        {/* Empty State */}
        {!loading && shops.length === 0 && (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
            <div className="bg-stone-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
              <Coffee size={32} />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">No coffee shops yet</h3>
            <p className="text-stone-500 max-w-sm mx-auto mb-6">
              Start tracking your caffeine journey! Add your first local coffee spot to get started.
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="text-amber-700 font-semibold hover:text-amber-800 transition-colors"
            >
              Add your first shop &rarr;
            </button>
          </div>
        )}

        {/* Shops List */}
        <div className="space-y-4">
          {filteredShops.map(shop => (
            <div key={shop.id} className="bg-white rounded-xl p-5 border border-stone-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">{shop.name}</h2>
                  {shop.location && (
                    <div className="flex items-center gap-1 text-stone-500 text-sm mt-1">
                      <MapPin size={14} />
                      <span>{shop.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-amber-50 px-2 py-1 rounded-lg">
                    <Star size={16} className={`mr-1 ${shop.rating >= 1 ? "fill-amber-400 text-amber-400" : "text-stone-300"}`} />
                    <span className="font-bold text-amber-900">{shop.rating}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(shop)}
                      className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(shop.id)}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {shop.notes && (
                <p className="text-stone-600 text-sm leading-relaxed mb-3">
                  {shop.notes}
                </p>
              )}

              {shop.tags && shop.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-stone-50">
                  {shop.tags.map((tag, i) => (
                    <span key={i} className="text-xs font-medium px-2 py-1 bg-stone-100 text-stone-600 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="font-bold text-lg text-stone-900">
                {currentShop ? 'Edit Coffee Shop' : 'Add New Shop'}
              </h3>
              <button onClick={handleCloseModal} className="text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. The Daily Grind"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Downtown, or 123 Main St"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({...formData, rating: star})}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star 
                        size={32} 
                        className={`${formData.rating >= star ? 'fill-amber-400 text-amber-400' : 'text-stone-200'} transition-colors`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">My Notes</label>
                <textarea
                  rows="3"
                  placeholder="Great latte art, wifi is spotty..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none"
                ></textarea>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="cozy, expensive, good-wifi"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-stone-900 text-white py-3 rounded-xl font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-lg shadow-stone-900/10"
                >
                  <Save size={18} />
                  <span>Save Shop</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
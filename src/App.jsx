import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  ExternalLink,
  DollarSign,
  Globe,
  Lock,
  LogOut,
  Snowflake,
  StarHalf,
  AlertCircle,
  Copy
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
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
  query
} from 'firebase/firestore';

// --- Configuration & Initialization ---
// RULE: This environment provides the config via __firebase_config. 
// If it's empty, the app cannot communicate with Firestore.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
    apiKey: "AIzaSyAU8KiDVf10Vc8TC_BMrfAuDKtCTKtH56g",
  authDomain: "denver-coffee-rater.firebaseapp.com",
  projectId: "denver-coffee-rater",
  storageBucket: "denver-coffee-rater.firebasestorage.app",
  messagingSenderId: "600755448882",
  appId: "1:600755448882:web:32afd9e59ffe6f5872202b",
  measurementId: "G-VCB5KZ4CPY"
    };

// 1. PASTE YOUR GOOGLE MAPS API KEY HERE
const GOOGLE_MAPS_API_KEY = "AIzaSyDDhQzKVKGRZcJ6T_phKAZ25mW4kq-VTfM";

// 2. COPY YOUR UID FROM THE FOOTER AND PASTE IT HERE TO EDIT THE PUBLIC LIST
const ADMIN_UID = "C7NSjFGXnPQoOpBZecA4ahOp1rp1";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'denver-coffee-rater';

// Helper to render stars
const RatingStars = ({ rating, size = 14, interactive = false, onRate = null }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = rating >= star;
        const isHalf = rating >= star - 0.5 && rating < star;
        return (
          <div key={star} className="relative cursor-pointer group" onClick={() => interactive && onRate && onRate(star)}>
            {interactive && (
              <div 
                className="absolute inset-y-0 left-0 w-1/2 z-10" 
                onClick={(e) => { e.stopPropagation(); onRate(star - 0.5); }}
              />
            )}
            {isFull ? (
              <Star size={size} className="fill-amber-400 text-amber-400" />
            ) : isHalf ? (
              <div className="relative">
                <Star size={size} className="text-stone-200" />
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <Star size={size} className="fill-amber-400 text-amber-400" />
                </div>
              </div>
            ) : (
              <Star size={size} className="text-stone-200" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('private'); 
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const autoCompleteRef = useRef(null);
  const inputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    placeId: '',
    rating: 0,
    price: 1,
    notes: '',
    hasColdBrew: false
  });

  // Load Google Maps API
  useEffect(() => {
    if (window.google) {
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Autocomplete
  useEffect(() => {
    if (isModalOpen && mapsLoaded && inputRef.current) {
      autoCompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        fields: ['name', 'formatted_address', 'place_id']
      });

      autoCompleteRef.current.addListener('place_changed', () => {
        const place = autoCompleteRef.current.getPlace();
        if (place.name) {
          setFormData(prev => ({
            ...prev,
            name: place.name,
            location: place.formatted_address || '',
            placeId: place.place_id || ''
          }));
        }
      });
    }
  }, [isModalOpen, mapsLoaded]);

  // Auth Effect (CRITICAL RULE 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Initialization Error:", err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.uid === ADMIN_UID) setView('public');
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching Effect (CRITICAL RULE 1 & 2)
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const collectionRef = view === 'public' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'coffee_shops')
      : collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');

    const unsubscribe = onSnapshot(query(collectionRef), (snapshot) => {
      const shopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to follow Rule 2
      shopsData.sort((a, b) => (view === 'public' ? (b.rating - a.rating) : (b.updatedAt?.seconds - a.updatedAt?.seconds)));
      setShops(shopsData);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Fetch Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, view]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!user || isSaving) return;

    if (!formData.name) {
      setSaveError("Please select a coffee shop from the search results.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Logic Check
      if (view === 'public' && user.uid !== ADMIN_UID) {
        throw new Error("Only the administrator can update the Public leaderboard. Please switch to the 'Private' tab to save your own shops!");
      }

      const shopData = {
        ...formData,
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        userName: user.displayName || 'Anonymous'
      };

      if (currentShop) {
        const docRef = view === 'public'
          ? doc(db, 'artifacts', appId, 'public', 'data', 'coffee_shops', currentShop.id)
          : doc(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops', currentShop.id);
        await updateDoc(docRef, shopData);
      } else {
        const collectionRef = view === 'public'
          ? collection(db, 'artifacts', appId, 'public', 'data', 'coffee_shops')
          : collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');
        await addDoc(collectionRef, { ...shopData, createdAt: serverTimestamp() });
      }
      
      setIsModalOpen(false);
      setCurrentShop(null);
      setFormData({ name: '', location: '', placeId: '', rating: 0, price: 1, notes: '', hasColdBrew: false });
    } catch (err) {
      console.error("Save Error:", err);
      setSaveError(err.message || "Permission Denied. Ensure you have valid credentials and are saving to your Private list.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (shopId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      const docRef = view === 'public'
        ? doc(db, 'artifacts', appId, 'public', 'data', 'coffee_shops', shopId)
        : doc(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops', shopId);
      await deleteDoc(docRef);
    } catch (err) {
      alert("Delete failed: Permission denied.");
    }
  };

  if (authLoading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-amber-800" size={40} /></div>;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-20">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-amber-700 p-2 rounded-xl text-white"><Coffee size={24} /></div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">Denver Brews</h1>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">The Ultimate Rater</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(view === 'private' || user?.uid === ADMIN_UID) && (
              <button onClick={() => { setSaveError(null); setCurrentShop(null); setFormData({name:'', location:'', placeId:'', rating:0, price:1, notes:'', hasColdBrew: false}); setIsModalOpen(true); }}
                      className="bg-stone-900 text-white p-2 rounded-full hover:scale-105 transition-transform"><Plus size={24} /></button>
            )}
            <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-600"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="bg-stone-200 p-1 rounded-xl flex gap-1">
          <button onClick={() => setView('public')} className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${view === 'public' ? 'bg-white shadow-sm text-amber-800' : 'text-stone-500'}`}><Globe size={16} /> Public</button>
          <button onClick={() => setView('private')} className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${view === 'private' ? 'bg-white shadow-sm text-amber-800' : 'text-stone-500'}`}><Lock size={16} /> Private</button>
        </div>
        {view === 'public' && user?.uid !== ADMIN_UID && (
          <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2 text-amber-800 text-[10px] font-bold uppercase tracking-tight">
            <Lock size={12}/> Global Leaderboard (Read-Only)
          </div>
        )}
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input type="text" placeholder={`Search...`} className="w-full bg-white border border-stone-200 py-3 pl-12 pr-4 rounded-2xl shadow-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-700" /></div> : (
          <div className="space-y-4">
            {shops.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-3xl text-stone-400 font-bold uppercase tracking-widest text-xs">
                No shops here yet.
              </div>
            )}
            {shops.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((shop, idx) => (
              <div key={shop.id} className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm relative overflow-hidden group">
                {view === 'public' && <div className="absolute top-0 left-0 w-10 h-10 bg-amber-700 text-white flex items-center justify-center font-black text-xs italic rounded-br-xl">#{idx + 1}</div>}
                <div className={`${view === 'public' ? 'pl-8' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-stone-900 leading-tight">{shop.name}</h2>
                        {shop.hasColdBrew && <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"><Snowflake size={10} /> Cold Brew</span>}
                      </div>
                      <div className="mt-1 text-amber-700 text-xs font-bold flex items-center gap-1">
                        <MapPin size={12} /> {shop.location?.split(',')[0]}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RatingStars rating={shop.rating} />
                      <div className="flex gap-0.5">
                        {[1,2,3,4].map(i => <DollarSign key={i} size={14} className={i <= shop.price ? 'text-green-600' : 'text-stone-200'} />)}
                      </div>
                    </div>
                  </div>
                  {shop.notes && <p className="text-stone-500 text-sm mt-3 italic">"{shop.notes}"</p>}
                  {(view === 'private' || user?.uid === ADMIN_UID) && (
                    <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-stone-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setSaveError(null); setCurrentShop(shop); setFormData(shop); setIsModalOpen(true); }} className="text-stone-400 hover:text-stone-900 flex items-center gap-1 text-xs font-bold"><Edit2 size={14}/> Edit</button>
                      <button onClick={() => handleDelete(shop.id)} className="text-stone-400 hover:text-red-600 flex items-center gap-1 text-xs font-bold"><Trash2 size={14}/> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">{currentShop ? 'Update' : 'Add New'} Shop</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-stone-100 p-2 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {saveError && <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-[11px] font-bold"><AlertCircle size={14} className="shrink-0" />{saveError}</div>}
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-1 ml-1">Search (Google Maps)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={18}/>
                  <input ref={inputRef} type="text" placeholder="Start typing coffee shop name..." className="w-full bg-stone-50 border border-stone-200 py-3 pl-10 pr-4 rounded-xl outline-none" />
                </div>
                {formData.name && <p className="mt-2 text-xs font-bold text-amber-700">Ready to save: {formData.name}</p>}
              </div>
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div className="text-xs font-black uppercase text-stone-900">Cold Brew?</div>
                <button type="button" onClick={() => setFormData({...formData, hasColdBrew: !formData.hasColdBrew})} className={`w-12 h-6 rounded-full relative transition-colors ${formData.hasColdBrew ? 'bg-blue-600' : 'bg-stone-200'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.hasColdBrew ? 'left-7' : 'left-1'}`} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 ml-1">Rating</label>
                  <RatingStars interactive={true} rating={formData.rating} size={28} onRate={(r) => setFormData({...formData, rating: r})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 ml-1">Price</label>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(n => <button key={n} type="button" onClick={() => setFormData({...formData, price: n})} className="p-1"><DollarSign size={20} className={formData.price >= n ? 'text-green-600' : 'text-stone-200'}/></button>)}
                  </div>
                </div>
              </div>
              <textarea rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-4 rounded-xl outline-none resize-none" placeholder="Notes..."></textarea>
              <button type="submit" disabled={isSaving} className={`w-full flex items-center justify-center gap-2 text-white py-4 rounded-2xl font-black uppercase tracking-widest ${isSaving ? 'bg-stone-400' : 'bg-amber-700 hover:bg-amber-800 shadow-lg shadow-amber-700/20'}`}>{isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} {currentShop ? 'Save Changes' : 'Confirm Rank'}</button>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-12 py-8 bg-stone-100 flex flex-col items-center">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-stone-200 shadow-sm mb-2">
          <code className="text-[10px] text-stone-500">{user?.uid || 'Not Authenticated'}</code>
          <button onClick={() => { navigator.clipboard.writeText(user?.uid || ''); alert('UID Copied!'); }} className="text-stone-400 hover:text-amber-700"><Copy size={12}/></button>
        </div>
        <p className="text-[9px] text-stone-400 font-bold uppercase">UID for Admin Access</p>
        {!firebaseConfig.apiKey && (
          <p className="mt-4 text-[10px] text-red-500 font-black animate-pulse">
            ⚠️ WARNING: No Firebase API Key detected in environment.
          </p>
        )}
      </footer>
    </div>
  );
}
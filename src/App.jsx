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
  StarHalf
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
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
  query
} from 'firebase/firestore';

// --- Configuration ---
const firebaseConfig = {

  apiKey: "AIzaSyAU8KiDVf10Vc8TC_BMrfAuDKtCTKtH56g",

  authDomain: "denver-coffee-rater.firebaseapp.com",

  projectId: "denver-coffee-rater",

  storageBucket: "denver-coffee-rater.firebasestorage.app",

  messagingSenderId: "600755448882",

  appId: "1:600755448882:web:32afd9e59ffe6f5872202b",

  measurementId: "G-VCB5KZ4CPY"

};


const GOOGLE_MAPS_API_KEY = "AIzaSyDDhQzKVKGRZcJ6T_phKAZ25mW4kq-VTfM";
const ADMIN_UID = "C7NSjFGXnPQoOpBZecA4ahOp1rp1";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const appId = 'denver-coffee-rater';

// Helper to render half stars
const RatingStars = ({ rating, size = 14, interactive = false, onRate = null }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = rating >= star;
        const isHalf = rating >= star - 0.5 && rating < star;
        
        return (
          <div key={star} className="relative cursor-pointer group" onClick={() => interactive && onRate && onRate(star)}>
            {/* Click left side for half star */}
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
  const [authError, setAuthError] = useState(null);

  const [view, setView] = useState('public'); 
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      
      const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.preventDefault();
      };
      const inputEl = inputRef.current;
      inputEl.addEventListener('keydown', handleKeyDown);
      return () => inputEl.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen, mapsLoaded]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const collectionRef = view === 'public' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'coffee_shops')
      : collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');

    const unsubscribe = onSnapshot(query(collectionRef), (snapshot) => {
      const shopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      shopsData.sort((a, b) => (view === 'public' ? (b.rating - a.rating) : (b.createdAt?.seconds - a.createdAt?.seconds)));
      setShops(shopsData);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, view]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!user || isSaving) return;

    if (!formData.name) {
      alert("Please select a shop from the Google Maps search results.");
      return;
    }

    setIsSaving(true);

    const shopData = {
      ...formData,
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      userName: user.displayName || 'Anonymous'
    };

    try {
      if (view === 'public' && user.uid !== ADMIN_UID) {
        alert("Only the admin can edit the public leaderboard!");
        setIsSaving(false);
        return;
      }

      const collectionPath = view === 'public' 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'coffee_shops')
        : collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');

      if (currentShop) {
        const docRef = doc(db, collectionPath.path, currentShop.id);
        await updateDoc(docRef, shopData);
      } else {
        await addDoc(collectionPath, { ...shopData, createdAt: serverTimestamp() });
      }
      
      setIsModalOpen(false);
      setCurrentShop(null);
      setFormData({ name: '', location: '', placeId: '', rating: 0, price: 1, notes: '', hasColdBrew: false });
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = user?.uid === ADMIN_UID;

  if (authLoading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-amber-800" size={40} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone-100 text-center">
          <div className="inline-flex bg-amber-700 p-4 rounded-2xl text-white mb-6 shadow-lg shadow-amber-700/20"><Coffee size={40} /></div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-stone-900 mb-2">Denver Brews</h1>
          <p className="text-stone-500 font-medium mb-8">Sign in with Google to start ranking.</p>
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 text-stone-700 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-colors shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          {authError && <p className="text-red-500 text-xs font-bold mt-4">{authError}</p>}
        </div>
      </div>
    );
  }

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
            {(view === 'private' || isAdmin) && (
              <button onClick={() => { setCurrentShop(null); setFormData({name:'', location:'', placeId:'', rating:0, price:1, notes:'', hasColdBrew: false}); setIsModalOpen(true); }}
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
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input type="text" placeholder={`Search...`} className="w-full bg-white border border-stone-200 py-3 pl-12 pr-4 rounded-2xl shadow-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-700" /></div> : (
          <div className="space-y-4">
            {shops.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((shop, idx) => (
              <div key={shop.id} className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm relative overflow-hidden group">
                {view === 'public' && <div className="absolute top-0 left-0 w-10 h-10 bg-amber-700 text-white flex items-center justify-center font-black text-xs italic rounded-br-xl">#{idx + 1}</div>}
                <div className={`${view === 'public' ? 'pl-8' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-stone-900 leading-tight">{shop.name}</h2>
                        {shop.hasColdBrew && (
                          <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                            <Snowflake size={10} className="fill-blue-600" /> Cold Brew
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-1 mt-1">
                        {shop.location && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.location)}&query_place_id=${shop.placeId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-amber-700 text-xs font-bold hover:underline">
                            <MapPin size={12} /> {shop.location.split(',')[0]}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RatingStars rating={shop.rating} />
                      <div className="flex gap-0.5">
                        {[...Array(4)].map((_, i) => <DollarSign key={i} size={14} className={i < shop.price ? 'text-green-600 font-bold' : 'text-stone-200'} />)}
                      </div>
                    </div>
                  </div>
                  {shop.notes && <p className="text-stone-500 text-sm mt-3 italic">"{shop.notes}"</p>}
                  
                  {(view === 'private' || isAdmin) && (
                    <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-stone-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setCurrentShop(shop); setFormData(shop); setIsModalOpen(true); }} className="text-stone-400 hover:text-stone-900 flex items-center gap-1 text-xs font-bold"><Edit2 size={14}/> Edit</button>
                      <button onClick={async () => { if(window.confirm('Delete?')) await deleteDoc(doc(db, view === 'public' ? `artifacts/${appId}/public/data/coffee_shops` : `artifacts/${appId}/users/${user.uid}/coffee_shops`, shop.id)); }} className="text-stone-400 hover:text-red-600 flex items-center gap-1 text-xs font-bold"><Trash2 size={14}/> Delete</button>
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
              <h3 className="text-xl font-black uppercase tracking-tight">{currentShop ? 'Update' : 'Rank New'} Shop</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-stone-100 p-2 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-1 ml-1">Search</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={18}/>
                  <input ref={inputRef} type="text" placeholder="Find on Google Maps..." className="w-full bg-stone-50 border border-stone-200 py-3 pl-10 pr-4 rounded-xl outline-none" />
                </div>
                {formData.name && <p className="mt-2 text-xs font-bold text-amber-700">Selected: {formData.name}</p>}
              </div>

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div>
                  <h4 className="text-xs font-black uppercase text-stone-900">Cold Brew?</h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase">Does this shop serve cold brew?</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, hasColdBrew: !formData.hasColdBrew})}
                  className={`w-12 h-6 rounded-full relative transition-colors ${formData.hasColdBrew ? 'bg-blue-600' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.hasColdBrew ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 ml-1">Rating (inc. 0.5)</label>
                  <RatingStars interactive={true} rating={formData.rating} size={28} onRate={(r) => setFormData({...formData, rating: r})} />
                  <p className="text-[10px] font-black text-amber-700 mt-1 uppercase">Score: {formData.rating}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 ml-1">Price</label>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(n => <button key={n} type="button" onClick={() => setFormData({...formData, price: n})} className="p-1"><DollarSign size={20} className={formData.price >= n ? 'text-green-600' : 'text-stone-200'}/></button>)}
                  </div>
                </div>
              </div>

              <textarea rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-4 rounded-xl outline-none resize-none" placeholder="Notes..."></textarea>

              <button type="submit" disabled={isSaving} className={`w-full flex items-center justify-center gap-2 text-white py-4 rounded-2xl font-black uppercase tracking-widest ${isSaving ? 'bg-stone-400' : 'bg-amber-700'}`}>
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Confirm
              </button>
            </form>
          </div>
        </div>
      )}
      <footer className="py-8 text-center text-[10px] text-stone-400 font-bold uppercase tracking-tighter">UID: {user?.uid}</footer>
    </div>
  );
}
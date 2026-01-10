import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  DollarSign,
  Globe,
  Lock,
  LogOut,
  Snowflake,
  AlertCircle,
  Copy,
  LogIn,
  Droplets,
  Map as MapIcon,
  List,
  ArrowUpDown,
  Tag
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

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {   apiKey: "AIzaSyAU8KiDVf10Vc8TC_BMrfAuDKtCTKtH56g",

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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'denver-coffee-rater';

const DENVER_NEIGHBORHOODS = [
  "LoDo", "RiNo", "Capitol Hill", "Highlands", "Sloan's Lake", 
  "Cherry Creek", "Baker", "Wash Park", "Five Points", "Uptown", "Other"
];

const RatingStars = ({ rating, size = 14, interactive = false, onRate = null }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => {
      const isFull = rating >= star;
      const isHalf = rating >= star - 0.5 && rating < star;
      return (
        <div key={star} className={`relative group ${interactive ? 'cursor-pointer' : ''}`} onClick={() => interactive && onRate && onRate(star)}>
          {interactive && <div className="absolute inset-y-0 left-0 w-1/2 z-10" onClick={(e) => { e.stopPropagation(); onRate(star - 0.5); }} />}
          {isFull ? <Star size={size} className="fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" /> : 
           isHalf ? <div className="relative group-hover:scale-110 transition-transform"><Star size={size} className="text-stone-200" /><div className="absolute inset-0 overflow-hidden w-1/2"><Star size={size} className="fill-amber-400 text-amber-400" /></div></div> : 
           <Star size={size} className="text-stone-200 group-hover:scale-110 transition-transform" />}
        </div>
      );
    })}
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('private'); 
  const [displayMode, setDisplayMode] = useState('list');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShop, setCurrentShop] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('All');
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const autoCompleteRef = useRef(null);
  const inputRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    placeId: '',
    rating: 5,
    price: 1,
    neighborhood: 'Other',
    notes: '',
    hasColdBrew: false,
    lat: null,
    lng: null
  });

  useEffect(() => {
    if (window.google) { setMapsLoaded(true); return; }
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
        fields: ['name', 'formatted_address', 'place_id', 'geometry']
      });
      autoCompleteRef.current.addListener('place_changed', () => {
        const place = autoCompleteRef.current.getPlace();
        if (place.name) {
          setFormData(prev => ({
            ...prev,
            name: place.name,
            location: place.formatted_address || '',
            placeId: place.place_id || '',
            lat: place.geometry?.location.lat(),
            lng: place.geometry?.location.lng()
          }));
        }
      });
    }
  }, [isModalOpen, mapsLoaded]);

  useEffect(() => {
    let isSubscribed = true;
    const initAuth = async () => {
      try {
        if (auth.currentUser) {
          if (isSubscribed) setUser(auth.currentUser);
        } else {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        }
      } catch (err) { console.error("Auth init error:", err); }
      finally { if (isSubscribed) setAuthLoading(false); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (isSubscribed) { setUser(u); setAuthLoading(false); }
    });
    return () => { isSubscribed = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const collectionRef = view === 'public' 
      ? collection(db, 'artifacts', appId, 'public', 'data', 'coffee_shops')
      : collection(db, 'artifacts', appId, 'users', user.uid, 'coffee_shops');
    const unsubscribe = onSnapshot(query(collectionRef), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsubscribe();
  }, [user, view]);

  const filteredAndSortedShops = useMemo(() => {
    let result = shops.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (neighborhoodFilter !== 'All') {
      result = result.filter(s => s.neighborhood === neighborhoodFilter);
    }
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'rating') { valA = a.rating; valB = b.rating; }
      else if (sortBy === 'price') { valA = a.price; valB = b.price; }
      else { valA = a.createdAt?.seconds || 0; valB = b.createdAt?.seconds || 0; }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
    return result;
  }, [shops, searchTerm, neighborhoodFilter, sortBy, sortOrder]);

  // Restored Map Marker Logic
  useEffect(() => {
    if (displayMode === 'map' && mapsLoaded && mapContainerRef.current) {
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 39.7392, lng: -104.9903 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
          ]
        });
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      filteredAndSortedShops.forEach(shop => {
        if (shop.lat && shop.lng) {
          hasPoints = true;
          const pos = { lat: Number(shop.lat), lng: Number(shop.lng) };
          const marker = new window.google.maps.Marker({
            position: pos,
            map: mapRef.current,
            title: shop.name,
            icon: {
              path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
              fillColor: "#b45309",
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: "#ffffff",
              scale: 1.5,
              anchor: new window.google.maps.Point(12, 24),
            }
          });
          
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 5px"><strong>${shop.name}</strong><br/>${shop.rating} Stars</div>`
          });
          marker.addListener('click', () => infoWindow.open(mapRef.current, marker));
          markersRef.current.push(marker);
          bounds.extend(pos);
        }
      });

      if (hasPoints) {
        mapRef.current.fitBounds(bounds);
        if (filteredAndSortedShops.length === 1) mapRef.current.setZoom(15);
      }
    }
  }, [displayMode, mapsLoaded, filteredAndSortedShops]);

  const handleQuickUpdate = async (shop, field, value) => {
    if (!user) return;
    const isPublic = view === 'public';
    if (isPublic && user.uid !== ADMIN_UID && shop.createdBy !== user.uid) return;
    try {
      const docRef = doc(db, 'artifacts', appId, isPublic ? 'public' : 'users', isPublic ? 'data' : user.uid, 'coffee_shops', shop.id);
      await updateDoc(docRef, { [field]: value, updatedAt: serverTimestamp() });
    } catch (err) { console.error(err); }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!user || isSaving || !formData.name) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const shopData = { ...formData, updatedAt: serverTimestamp(), createdBy: user.uid, userName: user.displayName || 'Anonymous' };
      const isPublic = view === 'public';
      const pathParts = isPublic ? ['public', 'data'] : ['users', user.uid];
      if (currentShop) {
        await updateDoc(doc(db, 'artifacts', appId, ...pathParts, 'coffee_shops', currentShop.id), shopData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, ...pathParts, 'coffee_shops'), { ...shopData, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
      setFormData({ name: '', location: '', placeId: '', rating: 5, price: 1, neighborhood: 'Other', notes: '', hasColdBrew: false, lat: null, lng: null });
    } catch (err) { setSaveError(err.message); } finally { setIsSaving(false); }
  };

  const handleGoogleLogin = async () => { try { setAuthLoading(true); await signInWithPopup(auth, googleProvider); } catch (err) { console.error(err); } finally { setAuthLoading(false); } };
  const handleLogout = async () => { try { setAuthLoading(true); await signOut(auth); await signInAnonymously(auth); } catch (err) { console.error(err); } finally { setAuthLoading(false); } };

  const getGoogleMapsUrl = (shop) => {
    if (shop.placeId) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.name)}&destination_place_id=${shop.placeId}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.location || shop.name)}`;
  };

  if (authLoading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-amber-800" size={40} /></div>;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-10">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-amber-700 p-2 rounded-xl text-white shadow-lg"><Coffee size={24} /></div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Denver Brews</h1>
              <p className="text-[10px] font-bold text-stone-400 uppercase mt-1">Coffee Rater v2.2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-stone-100 p-1 rounded-xl flex">
              <button onClick={() => setDisplayMode('list')} className={`p-2 rounded-lg ${displayMode === 'list' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-400'}`}><List size={20}/></button>
              <button onClick={() => setDisplayMode('map')} className={`p-2 rounded-lg ${displayMode === 'map' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-400'}`}><MapIcon size={20}/></button>
            </div>
            <button onClick={() => { setIsModalOpen(true); setCurrentShop(null); }} className="bg-amber-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-800 shadow-md">
              <Plus size={18}/> <span className="hidden sm:inline">Add Shop</span>
            </button>
            {user?.isAnonymous ? (
              <button onClick={handleGoogleLogin} className="bg-stone-100 px-3 py-2 rounded-xl text-stone-600 hover:bg-stone-200"><LogIn size={18}/></button>
            ) : (
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-600 bg-stone-100 rounded-xl"><LogOut size={18}/></button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex gap-2 mb-6 bg-stone-200 p-1 rounded-2xl w-fit">
          <button onClick={() => setView('public')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 ${view === 'public' ? 'bg-white shadow-sm text-amber-800' : 'text-stone-500'}`}><Globe size={14} /> Public</button>
          <button onClick={() => setView('private')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 ${view === 'private' ? 'bg-white shadow-sm text-amber-800' : 'text-stone-500'}`}><Lock size={14} /> Private</button>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-sm space-y-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input type="text" placeholder="Search by name..." className="w-full bg-stone-50 border border-stone-100 py-3 pl-12 pr-4 rounded-2xl outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <div className="bg-stone-50 border border-stone-100 p-1 rounded-2xl flex items-center">
                <select className="bg-transparent text-xs font-bold uppercase px-3 py-2 outline-none appearance-none pr-8 cursor-pointer" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="rating">Rating</option>
                  <option value="price">Price</option>
                  <option value="date">Date</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="p-2 text-amber-800"><ArrowUpDown size={16} /></button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center border-t border-stone-50 pt-4">
            <Tag size={14} className="text-stone-400 mr-2" />
            {['All', ...DENVER_NEIGHBORHOODS].map(n => (
              <button 
                key={n} 
                onClick={() => setNeighborhoodFilter(n)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${neighborhoodFilter === n ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-stone-100 text-stone-500 border-transparent'} border`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {displayMode === 'list' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-amber-700" size={32} /></div> : 
             filteredAndSortedShops.length === 0 ? <div className="col-span-full text-center py-20 border-2 border-dashed border-stone-200 rounded-3xl text-stone-400 font-bold uppercase text-xs">No shops found</div> : 
             filteredAndSortedShops.map(shop => (
              <div key={shop.id} className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm relative flex flex-col group">
                <div className="flex justify-between items-start mb-2">
                  <div className="max-w-[65%]">
                    <h3 className="text-lg font-black text-stone-900 truncate">{shop.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[9px] font-black uppercase">{shop.neighborhood || 'Other'}</span>
                      <a href={getGoogleMapsUrl(shop)} target="_blank" rel="noopener noreferrer" className="text-stone-400 text-[10px] font-bold hover:underline truncate">@ {shop.location?.split(',')[0]}</a>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <RatingStars rating={shop.rating} interactive={true} onRate={(val) => handleQuickUpdate(shop, 'rating', val)} />
                    <div className="flex">
                      {[1,2,3,4].map(i => <DollarSign key={i} size={12} className={i <= shop.price ? 'text-green-600' : 'text-stone-200'} />)}
                    </div>
                  </div>
                </div>
                {shop.notes && <p className="text-stone-500 text-xs italic mb-4 line-clamp-2">"{shop.notes}"</p>}
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-stone-50">
                  <div className="flex gap-2">
                    {shop.hasColdBrew ? <span className="text-blue-600 text-[9px] font-black uppercase flex items-center gap-1"><Snowflake size={10} /> Cold Brew</span> : <span className="text-stone-300 text-[9px] font-black uppercase flex items-center gap-1"><Droplets size={10} /> No Cold Brew</span>}
                  </div>
                  {(view === 'private' || user?.uid === ADMIN_UID || shop.createdBy === user?.uid) && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setCurrentShop(shop); setFormData(shop); setIsModalOpen(true); }} className="p-2 text-stone-400 hover:text-stone-900"><Edit2 size={14}/></button>
                      <button onClick={async () => { if(confirm('Delete?')) await deleteDoc(doc(db, 'artifacts', appId, view === 'public' ? 'public' : 'users', view === 'public' ? 'data' : user.uid, 'coffee_shops', shop.id))}} className="p-2 text-stone-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-[60vh] bg-stone-200 rounded-3xl overflow-hidden border border-stone-300 shadow-inner" ref={mapContainerRef} />
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase text-stone-800">{currentShop ? 'Update' : 'Add'} Coffee Shop</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-stone-50 p-2 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Search Location</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={18}/>
                  <input ref={inputRef} type="text" placeholder="Shop Name..." className="w-full bg-stone-50 border border-stone-200 py-3 pl-10 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-700/10" defaultValue={currentShop?.name} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Neighborhood</label>
                <select 
                  className="w-full bg-stone-50 border border-stone-200 py-3 px-4 rounded-xl outline-none font-bold text-sm"
                  value={formData.neighborhood}
                  onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                >
                  {DENVER_NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Rating</label>
                  <RatingStars interactive={true} rating={formData.rating} size={24} onRate={(r) => setFormData({...formData, rating: r})} />
                </div>
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Price Level</label>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(n => <button key={n} type="button" onClick={() => setFormData({...formData, price: n})} className="p-0.5"><DollarSign size={18} className={formData.price >= n ? 'text-green-600' : 'text-stone-300'}/></button>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="text-xs font-black uppercase text-stone-800 flex items-center gap-2"><Snowflake size={16} className="text-blue-500"/> Cold Brew Available?</div>
                <button type="button" onClick={() => setFormData({...formData, hasColdBrew: !formData.hasColdBrew})} className={`w-12 h-6 rounded-full relative transition-colors ${formData.hasColdBrew ? 'bg-blue-600' : 'bg-stone-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.hasColdBrew ? 'left-7' : 'left-1'}`} /></button>
              </div>
              <textarea rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-stone-50 border border-stone-200 p-4 rounded-xl outline-none resize-none text-sm" placeholder="Tell us about the vibes..."></textarea>
              <button type="submit" disabled={isSaving || !formData.name} className="w-full flex items-center justify-center gap-2 text-white py-4 rounded-2xl font-black uppercase tracking-widest bg-amber-700 hover:bg-amber-800 shadow-xl disabled:bg-stone-300">
                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} {currentShop ? 'Update' : 'Save Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-20 py-10 border-t border-stone-200 flex flex-col items-center">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-stone-200 shadow-sm mb-2">
          <code className="text-[10px] text-stone-500">{user?.uid || '...'}</code>
          <button onClick={() => { navigator.clipboard.writeText(user?.uid || ''); }} className="text-stone-400 hover:text-amber-700"><Copy size={12}/></button>
        </div>
        <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Coffee ID</p>
      </footer>
    </div>
  );
}
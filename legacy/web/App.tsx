
import React, { useState, useEffect, useRef } from 'react';
import Navigation from './components/Navigation';
import FeedView from './components/FeedView';
import PlacesExplorer from './components/PlacesExplorer';
import AIAgentView from './components/AIAgentView';
import ProfileView from './components/ProfileView';
import { AppView, Coordinates, UserProfile, FeedItem } from './types';
import { MapPin, Loader2, X, Globe, Camera, User, AlignLeft, Phone, Lock, Settings, Database, Trash2, HardDrive, RefreshCw, ChevronRight, ChevronLeft, Languages, Info } from 'lucide-react';
import { getCoordinatesFromAddress, identifyLocation } from './services/geminiService';
import { cacheGet, cacheSet, cacheClearByPrefix, clearEverything, getCacheStats, CACHE_KEYS } from './services/cacheService';

const DEFAULT_COORDS: Coordinates = { latitude: -18.8792, longitude: 47.5079 };

const MADAGASCAR_BOUNDS = {
  minLat: -26.0, 
  maxLat: -11.0, 
  minLng: 43.0,  
  maxLng: 51.0   
};

const COUNTRIES = [
  { name: 'Madagascar', flag: '🇲🇬' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'États-Unis', flag: '🇺🇸' },
  { name: 'Italie', flag: '🇮🇹' },
  { name: 'Royaume-Uni', flag: '🇬🇧' },
  { name: 'Allemagne', flag: '🇩🇪' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Suisse', flag: '🇨🇭' },
  { name: 'Afrique du Sud', flag: '🇿🇦' }
];

const isInsideMadagascar = (lat: number, lng: number) => {
  return lat >= MADAGASCAR_BOUNDS.minLat && 
         lat <= MADAGASCAR_BOUNDS.maxLat && 
         lng >= MADAGASCAR_BOUNDS.minLng && 
         lng <= MADAGASCAR_BOUNDS.maxLng;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.FEED);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const hideNavTimeoutRef = useRef<any>(null);
  
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    return cacheGet<UserProfile>(CACHE_KEYS.USER_PROFILE) || {
      name: "Alex Voyageur",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
      banner: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
      location: "Antananarivo",
      phone: "+261 34 00 000 00",
      password: "password123",
      language: 'FR',
      country: 'Madagascar',
      countryFlag: '🇲🇬',
      description: "Amoureux de la nature et des paysages malgaches. En quête de nouvelles aventures !",
      profileViews: 1240
    };
  });

  const [userLocation, setUserLocation] = useState<Coordinates | null>(() => {
    return cacheGet<Coordinates>(CACHE_KEYS.LAST_LOCATION) || null;
  });

  const [userLocationName, setUserLocationName] = useState<string>(() => {
    return cacheGet<string>(CACHE_KEYS.LAST_LOCATION_NAME) || "Ma position";
  });
  
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocModalOpen, setIsManualLocModalOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // New states for location detection
  const [detectedLocation, setDetectedLocation] = useState<{ city: string, country: string, flag: string } | null>(null);
  const [isIdentifyingLoc, setIsIdentifyingLoc] = useState(false);

  const [isOutsideMadaPopupOpen, setIsOutsideMadaPopupOpen] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (currentView !== AppView.FEED) {
        setIsNavVisible(true);
        return;
      }
      setIsNavVisible(true);
      if (hideNavTimeoutRef.current) clearTimeout(hideNavTimeoutRef.current);
      hideNavTimeoutRef.current = setTimeout(() => setIsNavVisible(false), 3000);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    setIsNavVisible(true);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideNavTimeoutRef.current) clearTimeout(hideNavTimeoutRef.current);
    };
  }, [currentView]);

  useEffect(() => {
    cacheSet(CACHE_KEYS.USER_PROFILE, currentUser, 60 * 24 * 30);
  }, [currentUser]);

  // Effect to debounce identifying location
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (manualAddress.length > 2) {
        setIsIdentifyingLoc(true);
        const info = await identifyLocation(manualAddress);
        setDetectedLocation(info);
        setIsIdentifyingLoc(false);
      } else {
        setDetectedLocation(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [manualAddress]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coords = { latitude, longitude };
          if (isInsideMadagascar(latitude, longitude)) {
             setUserLocation(coords);
             setUserLocationName("Ma position");
             cacheSet(CACHE_KEYS.LAST_LOCATION, coords, 60 * 24); 
             cacheSet(CACHE_KEYS.LAST_LOCATION_NAME, "Ma position", 60 * 24);
             setLocationError(null);
             watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                    setUserLocation(newCoords);
                    cacheSet(CACHE_KEYS.LAST_LOCATION, newCoords, 60 * 24);
                },
                (err) => console.warn("Watch position error", err),
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
             );
          } else {
             // User is outside Madagascar (or preferred zone)
             // We still set location but maybe warn them
             if (!userLocation) setUserLocation(coords);
             setIsOutsideMadaPopupOpen(true);
             setLocationError(null); 
          }
        },
        (error) => {
          console.warn("Geolocation error:", error);
          if (!userLocation) {
            setUserLocation(DEFAULT_COORDS);
            setLocationError("Localisation indisponible.");
            setIsManualLocModalOpen(true);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      if (!userLocation) {
        setUserLocation(DEFAULT_COORDS);
        setIsManualLocModalOpen(true);
      }
    }
    return () => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleManualLocationSubmit = async () => {
    if (!manualAddress.trim()) return;

    // Fermer le clavier sur mobile
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsGeocoding(true);
    const coords = await getCoordinatesFromAddress(manualAddress);
    setIsGeocoding(false);
    if (coords) {
        setUserLocation(coords);
        const name = detectedLocation ? detectedLocation.city : manualAddress;
        setUserLocationName(name);
        cacheSet(CACHE_KEYS.LAST_LOCATION, coords, 60 * 24 * 7);
        cacheSet(CACHE_KEYS.LAST_LOCATION_NAME, name, 60 * 24 * 7);
        setLocationError(null); 
        setIsManualLocModalOpen(false);
    } else {
        alert("Impossible de trouver cette adresse. Essayez avec le nom d'une grande ville.");
    }
  };

  const navigateToProfile = (user: UserProfile) => {
    const updatedUser = { ...user, profileViews: (user.profileViews || 0) + 1 };
    if (user.name === currentUser.name) setCurrentUser(updatedUser);
    setSelectedProfileUser(updatedUser);
    setCurrentView(AppView.PROFILE);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser(prev => {
        const newUser = { ...prev, ...updates };
        if (selectedProfileUser?.name === prev.name) setSelectedProfileUser(newUser);
        return newUser;
    });
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.FEED: return <FeedView currentUser={currentUser} onNavigateToProfile={navigateToProfile} onNavigateToView={setCurrentView} />;
      case AppView.RESTAURANTS: return <PlacesExplorer category="restaurant" title="Restaurants" userLocation={userLocation} userLocationName={userLocationName} />;
      case AppView.HOTELS: return <PlacesExplorer category="hotel" title="Hôtels & Logements" userLocation={userLocation} userLocationName={userLocationName} />;
      case AppView.CHAT: return <AIAgentView userLocation={userLocation} />;
      case AppView.PROFILE: 
        const posts = cacheGet<FeedItem[]>(CACHE_KEYS.FEED) || [];
        return selectedProfileUser ? (
          <ProfileView 
            user={selectedProfileUser} 
            isOwnProfile={selectedProfileUser.name === currentUser.name}
            onBack={() => setCurrentView(AppView.FEED)} 
            onOpenSettings={() => setIsSettingsOpen(true)}
            posts={posts} 
          />
        ) : <FeedView currentUser={currentUser} onNavigateToProfile={navigateToProfile} onNavigateToView={setCurrentView} />;
      default: return <FeedView currentUser={currentUser} onNavigateToProfile={navigateToProfile} onNavigateToView={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-teal-200">
      <main className="min-h-screen">{renderView()}</main>
      
      {locationError && (
        <div className="fixed top-4 left-4 right-4 z-[60] animate-in slide-in-from-top-4 duration-300">
            <div className="bg-white/95 backdrop-blur-md border border-red-100 p-4 rounded-3xl shadow-2xl flex items-center justify-between">
                <div className="flex items-center">
                    <MapPin className="text-red-500 mr-3" size={20} />
                    <p className="font-bold text-sm">{locationError}</p>
                </div>
                <button onClick={() => setIsManualLocModalOpen(true)} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform">Choisir ville</button>
            </div>
        </div>
      )}

      {isOutsideMadaPopupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-200">
                <Globe size={64} className="text-teal-600 mx-auto mb-6" />
                <h3 className="text-2xl font-black mb-3">Mode Exploration</h3>
                <p className="text-gray-500 mb-8 font-medium">Vous pouvez explorer l'île. La géolocalisation automatique s’activera dès votre arrivée à Madagascar.</p>
                <button onClick={() => setIsOutsideMadaPopupOpen(false)} className="w-full py-4 bg-teal-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg">Compris</button>
            </div>
        </div>
      )}

      {isManualLocModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isGeocoding && setIsManualLocModalOpen(false)}></div>
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative z-10 p-8 animate-in zoom-in-95">
                  {!isGeocoding && <button onClick={() => setIsManualLocModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                  <h3 className="text-lg font-black text-center mb-6 uppercase tracking-widest">Où êtes-vous ?</h3>
                  
                  <div className="relative mb-6">
                      <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                            type="text" 
                            placeholder="Ex: Paris, Nosy Be..." 
                            value={manualAddress} 
                            onChange={(e) => setManualAddress(e.target.value)} 
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20" 
                            autoFocus 
                            onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                          />
                      </div>

                      <div className="absolute top-full left-0 right-0 mt-2 flex justify-center z-20">
                          {(detectedLocation || isIdentifyingLoc) && manualAddress.length > 2 && (
                              <div 
                                onClick={() => !isIdentifyingLoc && detectedLocation && handleManualLocationSubmit()}
                                className={`bg-white px-4 py-2 rounded-xl shadow-xl border border-gray-100 flex items-center space-x-3 animate-in slide-in-from-top-2 ${!isIdentifyingLoc && detectedLocation ? 'cursor-pointer hover:bg-gray-50 active:scale-95 transition-all' : ''}`}
                              >
                                   {isIdentifyingLoc ? (
                                       <>
                                          <Loader2 size={14} className="animate-spin text-teal-600" />
                                          <span className="text-xs font-bold text-gray-400">Recherche...</span>
                                       </>
                                   ) : detectedLocation ? (
                                       <>
                                          <span className="text-lg">{detectedLocation.flag}</span>
                                          <div className="text-left">
                                              <p className="text-xs font-black text-gray-900 leading-none">{detectedLocation.city}</p>
                                              <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest leading-none mt-0.5">{detectedLocation.country}</p>
                                          </div>
                                       </>
                                   ) : null}
                              </div>
                          )}
                      </div>
                  </div>

                  <button onClick={handleManualLocationSubmit} disabled={isGeocoding || !manualAddress.trim()} className="w-full py-4 bg-teal-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg disabled:opacity-70 flex items-center justify-center relative z-10">
                    {isGeocoding ? <Loader2 size={18} className="animate-spin" /> : "Valider la localisation"}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-4">Nous utiliserons cette ville pour vous suggérer des lieux à proximité.</p>
              </div>
          </div>
      )}

      {isSettingsOpen && (
          <SettingsModal 
            user={currentUser} 
            onClose={() => setIsSettingsOpen(false)} 
            onUpdate={handleUpdateProfile} 
          />
      )}

      {currentView !== AppView.PROFILE && (
        <Navigation 
          currentView={currentView} 
          setView={setCurrentView} 
          isVisible={isNavVisible}
        />
      )}
    </div>
  );
};

interface SettingsModalProps {
    user: UserProfile;
    onClose: () => void;
    onUpdate: (updates: Partial<UserProfile>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onUpdate }) => {
    const [pseudo, setPseudo] = useState(user.name);
    const [phone, setPhone] = useState(user.phone);
    const [password, setPassword] = useState(user.password || "");
    const [lang, setLang] = useState(user.language);
    const [country, setCountry] = useState(user.country);
    const [city, setCity] = useState(user.location);
    const [description, setDescription] = useState(user.description || "");
    const [isStorageOpen, setIsStorageOpen] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        const flag = COUNTRIES.find(c => c.name === country)?.flag || '🌍';
        onUpdate({ 
            name: pseudo, 
            phone, 
            password, 
            language: lang, 
            country, 
            location: city,
            countryFlag: flag,
            description 
        });
        onClose();
    };

    if (isStorageOpen) {
        return <StorageManager onBack={() => setIsStorageOpen(false)} />;
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-5 duration-300">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-black text-xl uppercase tracking-tighter text-gray-900">Paramètres Profil</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 bg-white rounded-full shadow-sm transition-transform active:scale-90"><X size={20} /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-8 no-scrollbar flex-1">
                    {/* Photos Section */}
                    <div className="space-y-4">
                        <div className="relative h-28 w-full rounded-2xl bg-gray-100 overflow-hidden group cursor-pointer border border-gray-100" onClick={() => bannerInputRef.current?.click()}>
                           <img src={user.banner || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80"} className="w-full h-full object-cover opacity-60 transition-opacity group-hover:opacity-40" />
                           <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] text-gray-900 group-hover:scale-110 transition-transform">Changer bannière</div>
                        </div>
                        <input type="file" ref={bannerInputRef} onChange={(e) => {
                            if (e.target.files?.[0]) {
                                const reader = new FileReader();
                                reader.onloadend = () => onUpdate({ banner: reader.result as string });
                                reader.readAsDataURL(e.target.files[0]);
                            }
                        }} className="hidden" accept="image/*" />

                        <div className="flex flex-col items-center -mt-12 relative z-10">
                            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                                <img src={user.avatar} className="w-24 h-24 rounded-[2rem] object-cover border-4 border-white shadow-xl group-hover:opacity-80 transition-opacity" />
                                <div className="absolute bottom-0 right-0 bg-teal-600 text-white p-2 rounded-xl border-2 border-white shadow-lg"><Camera size={14} /></div>
                            </div>
                            <input type="file" ref={avatarInputRef} onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => onUpdate({ avatar: reader.result as string });
                                    reader.readAsDataURL(e.target.files[0]);
                                }
                            }} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    {/* Identity Section */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] px-1">Identité & Contact</h3>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom d'affichage</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <input value={pseudo} onChange={e => setPseudo(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-bold" placeholder="Votre pseudo" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-bold" placeholder="+261 34 00 000 00" />
                            </div>
                        </div>
                    </div>

                    {/* Localisation & Langue */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] px-1">Localisation & Préférences</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ville</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                    <input value={city} onChange={e => setCity(e.target.value)} className="w-full pl-10 pr-3 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-xs font-bold" placeholder="Antananarivo" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pays</label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                    <select value={country} onChange={e => setCountry(e.target.value)} className="w-full pl-10 pr-3 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-xs font-bold appearance-none">
                                        {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Langue préférée</label>
                            <div className="relative">
                                <Languages className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <select value={lang} onChange={e => setLang(e.target.value as 'FR' | 'EN')} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-sm font-bold appearance-none">
                                    <option value="FR">Français (FR)</option>
                                    <option value="EN">English (EN)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Bio Section */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] px-1">À propos de vous</h3>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Biographie</label>
                            <div className="relative">
                                <AlignLeft className="absolute left-4 top-4 text-gray-300" size={16} />
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-sm font-medium italic min-h-[100px] resize-none" 
                                    placeholder="Racontez-nous vos aventures..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] px-1">Sécurité</h3>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-bold" placeholder="••••••••" />
                            </div>
                        </div>
                    </div>

                    {/* Advanced Section */}
                    <div className="pt-4 border-t border-gray-100">
                         <button 
                            onClick={() => setIsStorageOpen(true)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-teal-50 transition-colors group"
                         >
                            <div className="flex items-center space-x-3">
                                <div className="bg-white p-2 rounded-xl shadow-sm"><Database className="text-teal-600" size={18} /></div>
                                <div className="text-left">
                                    <p className="text-sm font-black text-gray-900">Stockage & Cache</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Optimiser l'espace</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-teal-500 transition-transform translate-x-0 group-hover:translate-x-1" />
                         </button>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={handleSave} className="w-full py-4 bg-teal-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-teal-600/30 active:scale-95 transition-transform">Enregistrer les modifications</button>
                </div>
            </div>
        </div>
    );
};

const StorageManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [stats, setStats] = useState(() => getCacheStats());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setStats(getCacheStats());
            setIsRefreshing(false);
        }, 600);
    };

    const handleClearPrefix = (prefix: string) => {
        cacheClearByPrefix(prefix);
        refresh();
    };

    const handleFullClear = () => {
        if (window.confirm("Voulez-vous vraiment vider tout le cache ? Vos paramètres de profil seront conservés.")) {
            clearEverything();
            refresh();
        }
    };

    const totalCap = 5 * 1024 * 1024;
    const usagePercent = Math.min((stats.totalBytes / totalCap) * 100, 100);
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onBack}></div>
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-right-5 duration-300">
                <div className="p-6 border-b border-gray-100 flex items-center space-x-4 bg-gray-50/50">
                    <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-teal-600 transition-colors"><ChevronLeft size={20} /></button>
                    <h2 className="font-black text-xl uppercase tracking-tighter text-gray-900">Stockage</h2>
                </div>

                <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900">{formatSize(stats.totalBytes)}</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisés sur 5.0 Mo</p>
                            </div>
                            <HardDrive size={32} className="text-teal-100" />
                        </div>
                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.4)]'}`} 
                                style={{ width: `${Math.max(usagePercent, 2)}%` }}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Détails par catégorie</h4>
                            <button onClick={refresh} className={`text-teal-600 p-1 hover:bg-teal-50 rounded-full transition-all ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={14} /></button>
                        </div>
                        
                        {stats.stats.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">{cat.label}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{cat.count} éléments • {formatSize(cat.size)}</p>
                                </div>
                                {cat.count > 0 && cat.label !== 'Système' && (
                                    <button 
                                        onClick={() => handleClearPrefix(cat.prefix)}
                                        className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                        <div className="flex items-start space-x-3 mb-4">
                            <Database className="text-rose-500 mt-0.5" size={18} />
                            <div>
                                <p className="text-xs font-black text-rose-900 uppercase tracking-tight">Zone Critique</p>
                                <p className="text-[10px] text-rose-700 font-medium">Nettoyer tout le cache accélérera l'application mais rechargera les données du réseau.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleFullClear}
                            className="w-full py-3 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-rose-200 active:scale-95 transition-transform"
                        >
                            Vider tout le cache
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;

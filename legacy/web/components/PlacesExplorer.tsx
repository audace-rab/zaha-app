
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Place, Coordinates, Review } from '../types';
import { searchNearbyPlaces } from '../services/geminiService';
import { MapPin, Star, Loader2, Search, X, Calendar, Clock, Users, Phone, MessageSquare, Send, ChevronLeft, MessageCircle } from 'lucide-react';
import MediaLightbox from './MediaLightbox';

interface PlacesExplorerProps {
  category: 'restaurant' | 'hotel';
  title: string;
  userLocation: Coordinates | null;
  userLocationName?: string;
}

const TIME_SLOTS = [
  '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const PlacesExplorer: React.FC<PlacesExplorerProps> = ({ category, title, userLocation, userLocationName = "Ma position" }) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const bannerImages = useMemo(() => {
    if (category === 'restaurant') {
      return [
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
      ];
    }
    return [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80"
    ];
  }, [category]);

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % bannerImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [bannerImages.length]);

  const [lightboxData, setLightboxData] = useState<{ media: {type: 'image' | 'video', url: string}[], index: number } | null>(null);

  const [reviewsMap, setReviewsMap] = useState<Record<string, Review[]>>({});
  const [newReviewContent, setNewReviewContent] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingEndDate, setBookingEndDate] = useState(''); 
  const [bookingTime, setBookingTime] = useState('12:00');
  const [bookingGuests, setBookingGuests] = useState(2);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const photoScrollRef = useRef<HTMLDivElement>(null);
  const bookingScrollRef = useRef<HTMLDivElement>(null);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    const scrollTop = detailScrollRef.current?.scrollTop || 0;
    
    if (deltaY > 0 && (scrollTop <= 0 || dragY > 0)) {
      setDragY(deltaY);
      if (e.cancelable) e.preventDefault();
    } else if (deltaY < 0 && dragY > 0) {
      setDragY(Math.max(0, deltaY + dragY));
    }
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 150) {
      setSelectedPlace(null);
    }
    setDragY(0);
  };

  const [bookingDragY, setBookingDragY] = useState(0);
  const [isBookingDragging, setIsBookingDragging] = useState(false);
  const bookingTouchStartY = useRef(0);

  const onBookingTouchStart = (e: React.TouchEvent) => {
    bookingTouchStartY.current = e.touches[0].clientY;
    setIsBookingDragging(true);
  };

  const onBookingTouchMove = (e: React.TouchEvent) => {
    if (!isBookingDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - bookingTouchStartY.current;
    
    if (deltaY > 0) {
      setBookingDragY(deltaY);
      if (e.cancelable) e.preventDefault();
    } else if (deltaY < 0 && bookingDragY > 0) {
      setBookingDragY(Math.max(0, deltaY + bookingDragY));
    }
  };

  const onBookingTouchEnd = () => {
    setIsBookingDragging(false);
    if (bookingDragY > 150) {
      setIsBookingModalOpen(false);
    }
    setBookingDragY(0);
  };

  const fetchPlaces = async () => {
    if (!userLocation) return;
    setLoading(true);
    setPlaces([]);
    setSelectedPlace(null);
    
    let filterString = undefined;

    const result = await searchNearbyPlaces(category, userLocation, filterString, searchQuery, userLocationName);
    
    const sortedPlaces = result.places.map(p => ({
        ...p,
        photos: [
            p.photoUrl || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80`,
            `https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80`,
            `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80`,
            `https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80`,
            `https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80`
        ]
    })).sort((a, b) => {
        if (a.isPro && !b.isPro) return -1;
        if (!a.isPro && b.isPro) return 1;
        return (b.rating || 0) - (a.rating || 0);
    });

    setPlaces(sortedPlaces);
    setLoading(false);
  };

  const handlePhotoScroll = () => {
    if (photoScrollRef.current) {
      const scrollLeft = photoScrollRef.current.scrollLeft;
      const width = photoScrollRef.current.offsetWidth;
      setCurrentPhotoIndex(Math.round(scrollLeft / width));
    }
  };

  useEffect(() => {
    if (userLocation) {
      fetchPlaces();
    }
  }, [userLocation, category, userLocationName]);

  useEffect(() => {
    setSearchQuery('');
  }, [category]);

  const handleAddReview = () => {
    if (!selectedPlace || !newReviewContent.trim()) return;
    const newReview: Review = {
        id: Date.now().toString(),
        author: 'Voyageur Zaha',
        rating: newReviewRating,
        content: newReviewContent,
        date: "À l'instant",
        helpfulCount: 0,
        timestamp: Date.now()
    };
    setReviewsMap(prev => ({
        ...prev,
        [selectedPlace.id]: [newReview, ...(prev[selectedPlace.id] || [])]
    }));
    setNewReviewContent('');
    setNewReviewRating(5);
  };

  const submitBooking = () => {
      if (!selectedPlace) return;
      const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length !== 3) return dateStr;
          const [y, m, d] = parts;
          return `${d}/${m}/${y}`;
      };
      const date = formatDate(bookingDate);
      let message = "";
      if (category === 'hotel') {
          const endDate = formatDate(bookingEndDate);
          message = `Bonjour,\n\nJe vous contacte via l’application Zaha App pour une réservation chez "${selectedPlace.name}".\n\nDates souhaitées : du ${date} au ${endDate}\nNombre de personnes : ${bookingGuests}\n\nMerci 🙂`;
      } else if (category === 'restaurant') {
          message = `Bonjour,\n\nJe vous contacte via l’application Zaha App pour réserver une table chez "${selectedPlace.name}".\n\nDate souhaitée : ${date}\nHeure : ${bookingTime}\nNombre de couverts : ${bookingGuests}\n\nMerci 🙂`;
      } else {
          message = `Bonjour,\n\nJe vous contacte via l’application Zaha App pour "${selectedPlace.name}".\n\nDate souhaitée : ${date}\nNombre de personnes : ${bookingGuests}\n\nMerci 🙂`;
      }
      const phoneNumber = selectedPlace.phoneNumber || "261388543090";
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      setIsBookingModalOpen(false);
  };

  if (!userLocation) return null;

  const getPlaceReviews = (placeId: string) => {
    const customReviews = reviewsMap[placeId] || [];
    if (customReviews.length === 0) {
        return [
            { id: 'm1', author: 'Julie L.', rating: 5, content: 'Une expérience inoubliable ! Le service est impeccable.', date: 'Il y a 2 jours', helpfulCount: 4, timestamp: Date.now() - 172800000 },
            { id: 'm2', author: 'Marc D.', rating: 4, content: 'Très recommandable pour un séjour authentique.', date: 'La semaine dernière', helpfulCount: 1, timestamp: Date.now() - 604800000 }
        ];
    }
    return customReviews;
  };

  return (
    <div className="flex flex-col h-screen pb-16 bg-gray-50">
      <div className="relative w-full h-48 shrink-0 overflow-hidden bg-gray-200">
          {bannerImages.map((img, idx) => (
              <img 
                  key={idx}
                  src={img}
                  alt="Banner"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentBannerIndex ? 'opacity-100' : 'opacity-0'}`}
              />
          ))}
      </div>
      
      <div className="bg-white px-6 pb-6 pt-5 rounded-b-3xl shadow-sm z-10 shrink-0">
          <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
              <p className="text-teal-600 text-sm flex items-center mt-1 font-medium">
                  <MapPin size={16} className="mr-1.5" /> 
                  {userLocationName && userLocationName !== 'Ma position' ? `À ${userLocationName}` : 'À proximité'}
              </p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); fetchPlaces(); }} className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={18} className="text-gray-400" /></div>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Rechercher des ${title.toLowerCase()}...`} className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-800 text-sm font-medium border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all shadow-sm" />
          </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40"><Loader2 className="animate-spin text-teal-600 mb-2" size={32} /></div>
        ) : (
          places.map((place) => (
            <div key={place.id} onClick={() => setSelectedPlace(place)} className={`bg-white p-4 rounded-xl shadow-sm border flex gap-4 hover:shadow-md transition-shadow cursor-pointer ${selectedPlace?.id === place.id ? 'border-teal-400 ring-1 ring-teal-400 bg-teal-50' : 'border-gray-100'}`}>
              <img src={place.photoUrl} alt={place.name} className="w-24 h-24 rounded-lg object-cover bg-gray-200 shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                   <h3 className="font-bold text-gray-900">{place.name}</h3>
                   {place.isPro && (
                       <span className="bg-yellow-100 text-yellow-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-yellow-200 uppercase">PRO</span>
                   )}
                </div>
                <div className="flex items-center text-yellow-400 text-xs mt-1">
                    <Star size={10} fill="currentColor" className="mr-1" />
                    <span className="text-gray-600 font-bold">{place.rating || 4.5}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 italic">"{place.snippet}"</p>
                <div className="mt-2 flex items-center text-[9px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded w-fit">
                    <Clock size={10} className="mr-1" /> {place.openingHours}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {lightboxData && (
        <MediaLightbox 
          media={lightboxData.media} 
          initialIndex={lightboxData.index} 
          onClose={() => setLightboxData(null)} 
        />
      )}

      {selectedPlace && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setSelectedPlace(null)}></div>
          <div 
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ transform: `translateY(${dragY}px)` }}
            className={`bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl p-6 pointer-events-auto relative shadow-2xl flex flex-col max-h-[90vh] ${isDragging ? '' : 'transition-transform duration-300'}`}
          >
            <div className="w-full h-8 -mt-6 mb-2 flex items-center justify-center shrink-0">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            <div 
              ref={detailScrollRef}
              className="flex-1 overflow-y-auto no-scrollbar pb-10"
            >
              <div className="relative mb-6 rounded-3xl overflow-hidden h-64 shadow-xl group/carousel">
                   {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
                      <>
                          <div 
                              ref={photoScrollRef}
                              onScroll={handlePhotoScroll}
                              className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth cursor-pointer"
                          >
                              {selectedPlace.photos.map((photo, idx) => (
                                  <div 
                                    key={idx} 
                                    className="w-full h-full flex-shrink-0 snap-center relative"
                                    onClick={() => setLightboxData({ media: selectedPlace.photos!.map(url => ({type: 'image', url})), index: idx })}
                                  >
                                      <img src={photo} alt={`${selectedPlace.name} ${idx + 1}`} className="w-full h-full object-cover" draggable="false" />
                                      <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md p-2 rounded-xl text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                                          <Maximize2 size={16} />
                                      </div>
                                  </div>
                              ))}
                          </div>
                          
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2 pointer-events-none">
                              {selectedPlace.photos.map((_, i) => (
                                  <div key={i} className={`transition-all duration-300 rounded-full h-1.5 ${i === currentPhotoIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
                              ))}
                          </div>
                      </>
                   ) : (
                      <img src={selectedPlace.photoUrl} alt={selectedPlace.name} className="w-full h-full object-cover" />
                   )}
                   <button onClick={() => setSelectedPlace(null)} className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white p-2.5 rounded-full active:scale-90 transition-transform shadow-lg">
                      <X size={20} />
                   </button>
              </div>

              <div className="px-1">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 leading-tight uppercase italic tracking-tighter">{selectedPlace.name}</h2>
                        <div className="flex items-center mt-1.5 text-teal-600 font-bold text-xs">
                            <MapPin size={12} className="mr-1.5" />
                            {selectedPlace.address}
                        </div>
                      </div>
                      {selectedPlace.isPro && (
                          <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-3 py-1.5 rounded-full border border-yellow-200 uppercase tracking-widest shadow-sm">Partenaire</span>
                      )}
                  </div>

                  <div className="mb-8 grid grid-cols-1 gap-3">
                      <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100/50 flex items-start space-x-3 shadow-sm">
                          <div className="bg-teal-600 p-2.5 rounded-xl text-white shadow-md shadow-teal-600/20">
                            <Clock size={20} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Horaires</h4>
                            <p className="text-sm font-black text-gray-800 leading-tight">{selectedPlace.openingHours}</p>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-4 mb-10">
                      {selectedPlace.isPro && (category === 'restaurant' || category === 'hotel') && (
                           <button onClick={() => setIsBookingModalOpen(true)} className="flex-1 flex items-center justify-center py-4 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-xs shadow-xl shadow-teal-600/30 active:scale-95 transition-transform">
                                <Calendar className="mr-2.5" size={18} />Réserver
                           </button>
                      )}
                      {selectedPlace.googleMapsUri && (
                          <a href={selectedPlace.googleMapsUri} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-xs shadow-xl active:scale-95 transition-transform">
                                <MapPin className="mr-2.5" size={18} />Itinéraire
                          </a>
                      )}
                  </div>

                  <div className="border-t border-gray-100 pt-10 space-y-8">
                      <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter flex items-center">
                                <MessageSquare size={20} className="mr-3 text-teal-600" />
                                Avis & Notes
                            </h3>
                            <div className="flex items-center bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-200 shadow-sm">
                                <Star size={14} className="text-yellow-500 fill-yellow-500 mr-1.5" />
                                <span className="text-sm font-black text-yellow-700">{selectedPlace.rating || 4.5}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {getPlaceReviews(selectedPlace.id).map(review => (
                                <div key={review.id} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm transition-shadow hover:shadow-md">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-6 h-6 bg-teal-50 rounded-lg flex items-center justify-center text-[10px] font-black text-teal-600 uppercase">{review.author[0]}</div>
                                            <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">{review.author}</span>
                                        </div>
                                        <div className="flex text-yellow-400">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} size={10} fill={i < review.rating ? "#FBBF24" : "none"} className={i < review.rating ? "text-yellow-400" : "text-gray-200"} />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium italic">"{review.content}"</p>
                                    <div className="flex justify-end mt-4">
                                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{review.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gray-50/80 backdrop-blur-sm p-6 rounded-[2.5rem] border border-gray-100 shadow-inner">
                            <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-4 text-center">Partagez votre avis</h4>
                            <div className="flex justify-center space-x-3 mb-6">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button 
                                        key={star} 
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setNewReviewRating(star)}
                                        className="focus:outline-none transform hover:scale-125 transition-all duration-200"
                                    >
                                        <Star 
                                            size={32} 
                                            fill={(hoverRating || newReviewRating) >= star ? "#FBBF24" : "none"} 
                                            className={(hoverRating || newReviewRating) >= star ? "text-yellow-400 drop-shadow-md" : "text-gray-200"} 
                                        />
                                    </button>
                                ))}
                            </div>
                            <textarea 
                                value={newReviewContent}
                                onChange={(e) => setNewReviewContent(e.target.value)}
                                placeholder="Comment s'est passée votre visite ?"
                                className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-semibold outline-none focus:ring-4 focus:ring-teal-50/10 min-h-[100px] shadow-sm transition-all italic"
                            />
                            <button 
                                onClick={handleAddReview}
                                disabled={!newReviewContent.trim()}
                                className="w-full mt-4 py-4 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                <Send size={16} className="inline mr-2.5" /> Envoyer mon avis
                            </button>
                      </div>
                  </div>

                  <button onClick={() => setSelectedPlace(null)} className="w-full py-6 text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] mt-6 transition-colors hover:text-gray-600">Fermer la fiche</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBookingModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-auto" onClick={() => setIsBookingModalOpen(false)}></div>
              <div 
                onTouchStart={onBookingTouchStart}
                onTouchMove={onBookingTouchMove}
                onTouchEnd={onBookingTouchEnd}
                style={{ transform: `translateY(${bookingDragY}px)` }}
                className={`bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pointer-events-auto relative shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500 ${isBookingDragging ? '' : 'transition-transform duration-300'}`}
              >
                  <div className="w-full h-8 -mt-8 mb-4 flex items-center justify-center shrink-0">
                      <div className="w-14 h-1.5 bg-gray-200 rounded-full"></div>
                  </div>

                  <div ref={bookingScrollRef} className="overflow-y-auto no-scrollbar pb-6">
                    <h3 className="font-black text-xl mb-10 text-gray-900 uppercase tracking-tighter italic">Contact & Réservation</h3>
                    
                    <div className="space-y-8 mb-12">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Date {category === 'hotel' ? 'd\'arrivée' : ''}</label>
                            <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm" />
                        </div>

                        {category === 'hotel' && (
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date de départ</label>
                              <input type="date" value={bookingEndDate} onChange={(e) => setBookingEndDate(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm" />
                          </div>
                        )}

                        {category === 'restaurant' && (
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                  <Clock size={12} className="text-teal-600" /> Heure souhaitée
                              </label>
                              <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-2">
                                  {TIME_SLOTS.map(slot => (
                                      <button
                                          key={slot}
                                          onClick={() => setBookingTime(slot)}
                                          className={`shrink-0 px-6 py-4 rounded-2xl text-[11px] font-black transition-all border shadow-sm ${
                                              bookingTime === slot 
                                              ? 'bg-teal-600 text-white border-teal-600 shadow-xl shadow-teal-600/30 scale-105' 
                                              : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50 hover:text-gray-600'
                                          }`}
                                      >
                                          {slot}
                                      </button>
                                  ))}
                              </div>
                          </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre de voyageurs</label>
                            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden px-4 shadow-sm">
                               <Users size={20} className="text-teal-600 ml-2" />
                               <input type="number" min="1" value={bookingGuests} onChange={(e) => setBookingGuests(parseInt(e.target.value))} className="w-full px-5 py-5 bg-transparent text-sm font-black outline-none" placeholder="Ex: 2" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={submitBooking} className="flex-1 py-5 bg-teal-600 text-white font-black uppercase tracking-[0.1em] text-[10px] sm:text-xs rounded-2xl flex items-center justify-center shadow-2xl shadow-teal-600/40 active:scale-95 transition-all">
                            <MessageCircle size={18} className="mr-2" /> WhatsApp
                        </button>
                        <a href={`tel:${selectedPlace?.phoneNumber || "261388543090"}`} className="flex-1 py-5 bg-gray-900 text-white font-black uppercase tracking-[0.1em] text-[10px] sm:text-xs rounded-2xl flex items-center justify-center shadow-2xl active:scale-95 transition-all decoration-none">
                            <Phone size={18} className="mr-2" /> Appeler
                        </a>
                    </div>
                    
                    <button onClick={() => setIsBookingModalOpen(false)} className="w-full mt-6 py-2 text-gray-300 font-black uppercase text-[10px] tracking-[0.3em] hover:text-gray-500 transition-colors">Annuler la demande</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlacesExplorer;

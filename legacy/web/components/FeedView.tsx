
import React, { useState, useEffect, useRef } from 'react';
import { FeedItem, MediaItem, UserProfile, AppView, Comment } from '../types';
import { translateToEnglish } from '../services/geminiService';
import { cacheGet, cacheSet, CACHE_KEYS } from '../services/cacheService';
import { Heart, MessageCircle, Share2, Loader2, Plus, X, Film, Languages, MoreHorizontal, Sparkles, AlertTriangle, Edit3, Scissors, AlertCircle, BadgeCheck, Maximize2, Send, Calendar, Phone, Clock, Users } from 'lucide-react';
import MediaLightbox from './MediaLightbox';

interface FeedViewProps {
  onNavigateToProfile: (user: UserProfile) => void;
  onNavigateToView?: (view: AppView) => void;
  currentUser: UserProfile;
}

interface ExtendedMediaItem extends MediaItem {
  duration?: number;
  isTrimmed?: boolean;
}

const MOCK_POOL: FeedItem[] = [
  {
    id: '1',
    author: 'Sophie Martin',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    authorCountryFlag: '🇫🇷',
    media: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80' },
        { type: 'image', url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80' }
    ],
    content: "Une semaine magique à Nosy Be ! Les couchers de soleil sont irréels. 🌅",
    likes: 342,
    commentsList: [
      { id: 'c1', author: 'Jean Dupont', authorAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop', text: "C'est magnifique ! Tu as logé où ?", timestamp: Date.now() - 3600000, mentions: [] }
    ],
    isBusiness: false,
    location: 'Nosy Be, Madagascar',
    timestamp: 'Il y a 2h'
  },
  {
    id: '2',
    author: 'Villa Anjary',
    authorAvatar: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&h=100&fit=crop',
    authorCountryFlag: '🇲🇬',
    media: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80' }
    ],
    content: "Profitez de nos offres de saison sur la côte Est. Bienvenue chez nous ! 🏨✨",
    likes: 890,
    commentsList: [],
    isBusiness: true,
    location: 'Sainte Marie, Madagascar',
    timestamp: 'Sponsorisé'
  }
];

const FeedView: React.FC<FeedViewProps> = ({ onNavigateToProfile, currentUser }) => {
  const [items, setItems] = useState<FeedItem[]>(() => {
    return cacheGet<FeedItem[]>(CACHE_KEYS.FEED) || MOCK_POOL;
  });

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedItem | null>(null);
  
  const [lightboxData, setLightboxData] = useState<{ media: MediaItem[], index: number } | null>(null);

  const [newPostContent, setNewPostContent] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<ExtendedMediaItem[]>([]);
  
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const postMediaInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

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
    const scrollTop = modalContentRef.current?.scrollTop || 0;
    
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
      setIsPostModalOpen(false);
      setNewPostMedia([]);
      setNewPostContent("");
    }
    setDragY(0);
  };

  useEffect(() => {
    cacheSet(CACHE_KEYS.FEED, items, 60 * 24);
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [items, isLoadingMore]);

  const loadMoreItems = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      const moreItems = MOCK_POOL.map(item => ({
        ...item,
        id: `${item.id}-${Date.now()}-${Math.random()}`,
        timestamp: 'Il y a quelques heures'
      }));
      setItems(prev => [...prev, ...moreItems]);
      setIsLoadingMore(false);
    }, 1500);
  };

  const handleAddComment = (postId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: currentUser.name,
      authorAvatar: currentUser.avatar,
      text: text.trim(),
      timestamp: Date.now(),
      mentions: []
    };
    setItems(prev => prev.map(item => item.id === postId 
      ? { ...item, commentsList: [...item.commentsList, newComment] } 
      : item
    ));
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleMediaSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const newMedia: ExtendedMediaItem[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        let duration: number | undefined;
        if (isVideo) duration = await getVideoDuration(file);
        const reader = new FileReader();
        const mediaPromise = new Promise<ExtendedMediaItem>((resolve) => {
          reader.onloadend = () => {
            resolve({
              type: isVideo ? 'video' : 'image',
              url: reader.result as string,
              duration,
              isTrimmed: false
            });
          };
          reader.readAsDataURL(file);
        });
        newMedia.push(await mediaPromise);
      }
      setNewPostMedia(prev => [...prev, ...newMedia].slice(0, 10));
    }
  };

  const handleTrimVideo = (index: number) => {
    setNewPostMedia(prev => prev.map((media, i) => {
      if (i === index && media.type === 'video') {
        return {
          ...media,
          isTrimmed: true,
          url: media.url.includes('#t=') ? media.url : `${media.url}#t=0,30`
        };
      }
      return media;
    }));
  };

  const handlePublishOrEdit = () => {
    if (newPostMedia.some(m => m.type === 'video' && (m.duration || 0) > 30 && !m.isTrimmed)) {
      alert("Veuillez couper vos vidéos à 30 secondes avant de publier.");
      return;
    }
    if (!newPostContent.trim() && newPostMedia.length === 0) return;
    if (editingPost) {
      setItems(prev => prev.map(item => item.id === editingPost.id ? { ...item, content: newPostContent, media: newPostMedia } : item));
      setEditingPost(null);
    } else {
      const newPost: FeedItem = {
        id: Date.now().toString(),
        author: currentUser.name,
        authorAvatar: currentUser.avatar,
        authorCountryFlag: currentUser.countryFlag,
        media: newPostMedia, 
        content: newPostContent,
        likes: 0,
        commentsList: [],
        isBusiness: false,
        location: currentUser.location,
        timestamp: "À l'instant"
      };
      setItems(prev => [newPost, ...prev]);
    }
    setNewPostContent("");
    setNewPostMedia([]);
    setIsPostModalOpen(false);
  };

  const handleTranslateToggle = async (itemId: string, content: string) => {
    if (showTranslation[itemId]) { setShowTranslation(prev => ({ ...prev, [itemId]: false })); return; }
    if (translations[itemId]) { setShowTranslation(prev => ({ ...prev, [itemId]: true })); return; }
    setIsTranslating(prev => ({ ...prev, [itemId]: true }));
    try {
        const translatedText = await translateToEnglish(content);
        setTranslations(prev => ({ ...prev, [itemId]: translatedText }));
        setShowTranslation(prev => ({ ...prev, [itemId]: true }));
    } catch (e) { console.error(e); } finally { setIsTranslating(prev => ({ ...prev, [itemId]: false })); }
  };

  const openUserDetail = (author: string, avatar: string, flag?: string) => {
    const isMe = author === currentUser.name;
    const count = items.filter(item => item.author === author).length;
    if (isMe) { onNavigateToProfile(currentUser); return; }
    onNavigateToProfile({ 
        name: author, avatar, countryFlag: flag || '🌍', postCount: count,
        description: "Explorateur passionné partageant ses découvertes sur Zaha App.",
        location: '', phone: 'Non renseigné', language: 'FR', country: ''
    });
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-2xl mx-auto space-y-6 sm:px-6">
      <div className="flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-lg z-30 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-gray-100">
        <div className="flex items-center space-x-2">
            <Sparkles size={24} className="text-teal-600 fill-teal-600" />
            <h1 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">Flux Social</h1>
        </div>
        <div onClick={() => onNavigateToProfile(currentUser)} className="flex items-center space-x-2 bg-gray-50 p-1 pr-4 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all active:scale-95 shadow-sm">
          <img src={currentUser.avatar} alt="Profile" className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" />
          <span className="text-sm font-bold text-gray-800">{currentUser.name.split(' ')[0]}</span>
        </div>
      </div>

      <div className="space-y-10">
        {items.map((item) => (
          <FeedCard 
              key={item.id}
              item={item} 
              isOwnPost={item.author === currentUser.name}
              onProfileClick={() => openUserDetail(item.author, item.authorAvatar, item.authorCountryFlag)}
              onEditPost={() => { setEditingPost(item); setNewPostContent(item.content); setNewPostMedia(item.media as ExtendedMediaItem[]); setIsPostModalOpen(true); setDragY(0); }}
              onLikeToggle={() => setItems(prev => prev.map(p => p.id === item.id ? { ...p, hasLiked: !p.hasLiked, likes: p.hasLiked ? p.likes - 1 : p.likes + 1 } : p))}
              onAddComment={(text) => handleAddComment(item.id, text)}
              showTranslation={showTranslation[item.id]}
              translation={translations[item.id]}
              isTranslating={isTranslating[item.id]}
              onTranslateToggle={() => handleTranslateToggle(item.id, item.content)}
              onMediaClick={(idx) => setLightboxData({ media: item.media, index: idx })}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {isLoadingMore ? <Loader2 className="animate-spin text-teal-600" size={32} /> : <div className="h-4"></div>}
      </div>

      <button onClick={() => { setEditingPost(null); setNewPostContent(""); setNewPostMedia([]); setIsPostModalOpen(true); setDragY(0); }} className="fixed bottom-24 right-6 bg-teal-600 text-white p-4 rounded-3xl shadow-2xl z-40 hover:bg-teal-700 active:scale-90 transition-all">
        <Plus size={28} />
      </button>

      {lightboxData && (
        <MediaLightbox 
          media={lightboxData.media} 
          initialIndex={lightboxData.index} 
          onClose={() => setLightboxData(null)} 
        />
      )}

      {isPostModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsPostModalOpen(false)}></div>
          <div 
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ transform: `translateY(${dragY}px)` }}
            className={`bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 ${isDragging ? '' : 'transition-transform duration-300'}`}
          >
            <div className="w-full h-8 flex items-center justify-center shrink-0 mt-2">
                <div className="w-12 h-1.5 bg-gray-100 rounded-full"></div>
            </div>

            <div className="px-6 py-2 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h2 className="font-black text-gray-900 uppercase tracking-tighter">{editingPost ? "Modifier" : "Partager"}</h2>
                <button onClick={() => setIsPostModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2"><X size={24} /></button>
            </div>
            
            <div ref={modalContentRef} className="p-6 overflow-y-auto no-scrollbar flex-1">
              <textarea 
                className="w-full h-32 p-4 rounded-2xl bg-gray-50 border border-gray-100 resize-none outline-none text-gray-800 text-lg placeholder-gray-400 mb-6 focus:ring-2 focus:ring-teal-500/20" 
                placeholder="Dites quelque chose..." 
                value={newPostContent} 
                onChange={(e) => setNewPostContent(e.target.value)} 
              />
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {newPostMedia.map((media, idx) => (
                    <div key={idx} className="relative aspect-[4/5] rounded-xl overflow-hidden border border-gray-100 bg-gray-900 group">
                        {media.type === 'video' ? (
                          <div className="w-full h-full relative">
                            <video className="w-full h-full object-cover opacity-60"><source src={media.url} /></video>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Film size={20} className="text-white mb-1" />
                            </div>
                            {(media.duration || 0) > 30 && !media.isTrimmed && (
                              <button onClick={() => handleTrimVideo(idx)} className="absolute inset-0 bg-teal-600/80 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Scissors size={18} className="text-white mb-1" />
                                <span className="text-[8px] font-black text-white uppercase px-2 text-center">Couper</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <img src={media.url} className="w-full h-full object-cover" />
                        )}
                        <button onClick={() => setNewPostMedia(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/40 text-white p-1 rounded-full"><X size={10} /></button>
                    </div>
                ))}
                {newPostMedia.length < 10 && (
                    <button onClick={() => postMediaInputRef.current?.click()} className="aspect-[4/5] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-teal-500 hover:text-teal-500 transition-all">
                      <Plus size={16} />
                    </button>
                )}
              </div>
              
              <input type="file" ref={postMediaInputRef} onChange={handleMediaSelection} accept="image/*,video/*" multiple className="hidden" />
              <button onClick={handlePublishOrEdit} className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform">{editingPost ? "Mettre à jour" : "Publier"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FeedCardProps {
  item: FeedItem;
  isOwnPost: boolean;
  onProfileClick: () => void;
  onEditPost: () => void;
  onLikeToggle: () => void;
  onAddComment: (text: string) => void;
  showTranslation: boolean;
  translation: string;
  isTranslating: boolean;
  onTranslateToggle: () => void;
  onMediaClick: (index: number) => void;
}

const FeedCard: React.FC<FeedCardProps> = ({ item, isOwnPost, onProfileClick, onEditPost, onLikeToggle, onAddComment, showTranslation, translation, isTranslating, onTranslateToggle, onMediaClick }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('19:00');
  const [bookingGuests, setBookingGuests] = useState(2);
  const TIME_SLOTS = ["12:00", "12:30", "13:00", "13:30", "19:00", "19:30", "20:00", "20:30"];
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollRef.current) {
        const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
        if (index !== currentSlide) setCurrentSlide(index);
    }
  };

  const submitComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(commentInput);
    setCommentInput('');
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-gray-100/60 hover:shadow-md transition-all">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative cursor-pointer" onClick={onProfileClick}>
            <img src={item.authorAvatar} alt={item.author} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm" />
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 text-[10px]">{item.authorCountryFlag}</div>
          </div>
          <div className="cursor-pointer" onClick={onProfileClick}>
            <h3 className="font-black text-gray-900 text-sm flex items-center">
              {item.author}
              {item.isBusiness && <BadgeCheck size={14} className="text-teal-600 ml-2" fill="currentColor" />}
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{item.location} • {item.timestamp}</p>
          </div>
        </div>
        <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-300 p-2"><MoreHorizontal size={20}/></button>
            {isMenuOpen && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 py-2">
                    {isOwnPost && <button onClick={() => { onEditPost(); setIsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm font-bold flex items-center space-x-2"><Edit3 size={16} /> <span>Modifier</span></button>}
                    <button onClick={() => { alert("Signalé"); setIsMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm font-bold text-rose-600 flex items-center space-x-2"><AlertTriangle size={16} /> <span>Signaler</span></button>
                </div>
            )}
        </div>
      </div>
      
      <div className="relative w-full aspect-[4/5] bg-gray-50 group/carousel">
          <div 
            ref={scrollRef} 
            onScroll={handleScroll} 
            className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth cursor-pointer"
          >
              {item.media.map((media, index) => (
                  <div 
                    key={index} 
                    className="w-full h-full flex-shrink-0 snap-center relative"
                    onClick={() => onMediaClick(index)}
                  >
                        {media.type === 'video' ? (
                           <div className="w-full h-full relative pointer-events-none">
                              <video className="w-full h-full object-cover"><source src={media.url} type="video/mp4" /></video>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                 <Film size={48} className="text-white opacity-80" />
                              </div>
                           </div>
                        ) : (
                           <img src={media.url} className="w-full h-full object-cover" draggable="false" />
                        )}
                        <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md p-2 rounded-xl text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                            <Maximize2 size={16} />
                        </div>
                  </div>
              ))}
          </div>
          
          {item.media.length > 1 && (
            <>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                    {item.media.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'bg-white w-6' : 'bg-white/40 w-1.5'}`}></div>
                    ))}
                </div>
            </>
          )}
      </div>
      
      <div className="p-6">
        <div className="flex items-center space-x-6 mb-4">
            <button onClick={onLikeToggle} className={`flex items-center space-x-2 transform active:scale-125 transition-all ${item.hasLiked ? 'text-rose-500 font-black' : 'text-gray-700'}`}>
                <Heart size={28} fill={item.hasLiked ? "currentColor" : "none"} />
            </button>
            <button onClick={() => setShowComments(!showComments)} className={`flex items-center space-x-2 transition-colors ${showComments ? 'text-teal-600' : 'text-gray-700'}`}>
                <MessageCircle size={28} />
                {item.commentsList.length > 0 && <span className="text-xs font-black">{item.commentsList.length}</span>}
            </button>
            {item.isBusiness && (
                <button onClick={() => setIsBookingModalOpen(true)} className="flex items-center space-x-2 text-teal-600 transition-colors">
                    <Calendar size={28} />
                </button>
            )}
            <div className="flex-1"></div>
            <button className="text-gray-700"><Share2 size={24}/></button>
        </div>
        
        <p className="text-gray-800 text-sm leading-relaxed"><span className="font-black mr-2">{item.author}</span>{showTranslation ? translation : item.content}</p>
        <button onClick={onTranslateToggle} disabled={isTranslating} className="text-[10px] text-teal-600 font-black uppercase mt-2">{isTranslating ? "Traduction..." : (showTranslation ? "Original" : "Traduire")}</button>

        {/* Comments Section */}
        <div className={`mt-6 space-y-4 overflow-hidden transition-all duration-500 ease-in-out ${showComments ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-4 border-t border-gray-100 space-y-4">
                {item.commentsList.map(comment => (
                    <div key={comment.id} className="flex space-x-3 items-start">
                        <img src={comment.authorAvatar} alt={comment.author} className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-sm" />
                        <div className="bg-gray-50 rounded-2xl p-3 flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{comment.author}</span>
                                <span className="text-[8px] font-bold text-gray-400 uppercase">{new Date(comment.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-snug">{comment.text}</p>
                        </div>
                    </div>
                ))}
                
                {item.commentsList.length === 0 && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center py-4 italic">Soyez le premier à commenter</p>
                )}
            </div>
        </div>

        {/* Comment Input */}
        <div className="mt-6">
            <form onSubmit={submitComment} className="relative flex items-center bg-gray-50 rounded-2xl border border-gray-100 p-1.5 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:bg-white transition-all">
                <input 
                    type="text" 
                    value={commentInput} 
                    onChange={(e) => setCommentInput(e.target.value)} 
                    placeholder="Ajouter un commentaire..." 
                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-xs text-gray-800 placeholder-gray-400"
                />
                <button 
                    type="submit" 
                    disabled={!commentInput.trim()} 
                    className={`p-2 rounded-xl transition-all ${commentInput.trim() ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                    <Send size={14} />
                </button>
            </form>
        </div>
      </div>

      {isBookingModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-auto" onClick={() => setIsBookingModalOpen(false)}></div>
              <div 
                className="bg-white w-full max-w-sm rounded-t-[3rem] sm:rounded-[3rem] p-8 pointer-events-auto relative shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500"
              >
                  <div className="overflow-y-auto no-scrollbar pb-6 max-h-[80vh]">
                    <h3 className="font-black text-xl mb-10 text-gray-900 uppercase tracking-tighter italic">Contact & Réservation</h3>
                    
                    <div className="space-y-8 mb-12">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Date</label>
                            <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm" />
                        </div>

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

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre de voyageurs</label>
                            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden px-4 shadow-sm">
                               <Users size={20} className="text-teal-600 ml-2" />
                               <input type="number" min="1" value={bookingGuests} onChange={(e) => setBookingGuests(parseInt(e.target.value))} className="w-full px-5 py-5 bg-transparent text-sm font-black outline-none" placeholder="Ex: 2" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <a href={`https://wa.me/261388543090?text=${encodeURIComponent(`Bonjour ${item.author}, je souhaite réserver pour ${bookingGuests} personnes le ${bookingDate} à ${bookingTime}.`)}`} target="_blank" rel="noopener noreferrer" onClick={() => setIsBookingModalOpen(false)} className="flex-1 py-5 bg-teal-600 text-white font-black uppercase tracking-[0.1em] text-[10px] sm:text-xs rounded-2xl flex items-center justify-center shadow-2xl shadow-teal-600/40 active:scale-95 transition-all decoration-none">
                            <MessageCircle size={18} className="mr-2" /> WhatsApp
                        </a>
                        <a href={`tel:261388543090`} onClick={() => setIsBookingModalOpen(false)} className="flex-1 py-5 bg-gray-900 text-white font-black uppercase tracking-[0.1em] text-[10px] sm:text-xs rounded-2xl flex items-center justify-center shadow-2xl active:scale-95 transition-all decoration-none">
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

export default FeedView;

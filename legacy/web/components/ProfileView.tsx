
import React, { useState } from 'react';
import { UserProfile, FeedItem } from '../types';
import { ChevronLeft, Sparkles, MapPin, Grid, Settings, Edit2, Eye } from 'lucide-react';
import MediaLightbox from './MediaLightbox';

interface ProfileViewProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  posts: FeedItem[];
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, isOwnProfile, onBack, onOpenSettings, posts }) => {
  const userPosts = posts.filter(p => p.author === user.name);
  const postCount = user.postCount ?? userPosts.length;
  const [lightboxData, setLightboxData] = useState<{ media: {type: 'image' | 'video', url: string}[], index: number } | null>(null);
  
  const bannerUrl = user.banner || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80";

  const locationDisplay = [user.location, user.country]
    .filter(val => val && val !== 'Inconnu' && val !== 'Inconnue')
    .join(', ');

  const formatViews = (views: number = 0) => {
    if (views >= 1000) return (views / 1000).toFixed(1) + 'k';
    return views.toString();
  };

  const galleryMedia = userPosts.map(p => p.media[0]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-30 px-4 py-3 flex items-center justify-between border-b border-gray-100 sm:px-6">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <span className="font-bold text-gray-900 truncate max-w-[150px] sm:max-w-xs">{user.name}</span>
        </div>

        {isOwnProfile && (
          <button 
            onClick={onOpenSettings}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors active:rotate-45 duration-300"
          >
            <Settings size={22} className="text-gray-700" />
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="relative h-40 sm:h-56 w-full overflow-hidden bg-gray-200">
          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent"></div>
        </div>

        <div className="px-5 -mt-12 relative z-10 pb-4">
          <div className="flex justify-between items-end mb-4">
            <div className="relative">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] border-4 border-white shadow-xl object-cover bg-white" 
              />
              <div className="absolute bottom-0 right-0 bg-white p-1 rounded-xl shadow-lg border border-gray-100 text-lg">
                {user.countryFlag}
              </div>
            </div>
            
            {isOwnProfile && (
                <button 
                    onClick={onOpenSettings}
                    className="mb-1 px-5 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 transition-all active:scale-95"
                >
                    Modifier
                </button>
            )}
          </div>

          <div className="space-y-0.5">
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-1.5">
              {user.name}
              <Sparkles size={16} className="text-teal-600 fill-teal-600" />
            </h1>
            <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
               <span className="flex items-center gap-1">
                 <MapPin size={10} className="text-teal-600" /> 
                 {locationDisplay || "Globe-trotteur"}
               </span>
            </div>
          </div>

          <div className="mt-5 flex gap-10 border-t border-gray-50 pt-4">
            <div className="flex flex-col">
              <span className="text-lg font-black text-gray-900 leading-none">{postCount}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Publications</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Eye size={16} className="text-gray-400" />
                <span className="text-lg font-black text-gray-900 leading-none">{formatViews(user.profileViews)}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Vues de profil</span>
            </div>
          </div>

          <div className="mt-6 relative group">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black uppercase text-teal-600 tracking-widest">Bio Voyageur</h3>
                {isOwnProfile && (
                    <button 
                        onClick={onOpenSettings}
                        className="p-1.5 bg-gray-50 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                    >
                        <Edit2 size={12} />
                    </button>
                )}
            </div>
            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 relative overflow-hidden">
                <p className="text-gray-700 text-sm leading-relaxed font-medium italic">
                    "{user.description || "Aucune bio rédigée pour le moment."}"
                </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center space-x-2">
            <Grid size={16} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Galerie Photos</span>
        </div>

        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5">
          {userPosts.length > 0 ? (
            userPosts.map((post, idx) => (
              <div 
                key={post.id} 
                className="aspect-[4/5] bg-gray-100 overflow-hidden relative group cursor-zoom-in active:scale-95 transition-transform"
                onClick={() => setLightboxData({ media: galleryMedia, index: idx })}
              >
                <img src={post.media[0].url} className="w-full h-full object-cover" alt="User content" />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
          ) : (
            <div className="col-span-3 py-16 text-center">
               <p className="text-gray-300 font-bold uppercase tracking-widest text-[10px] italic">Aucune photo partagée</p>
            </div>
          )}
        </div>
      </div>

      {/* Media Lightbox */}
      {lightboxData && (
        <MediaLightbox 
          media={lightboxData.media} 
          initialIndex={lightboxData.index} 
          onClose={() => setLightboxData(null)} 
        />
      )}
    </div>
  );
};

export default ProfileView;

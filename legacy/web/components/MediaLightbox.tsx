
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Maximize2 } from 'lucide-react';

interface MediaLightboxProps {
  media: { type: 'image' | 'video'; url: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ media, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [lastPinchDist, setLastPinchDist] = useState(0);
  
  // Track swipe horizontal
  const touchStartX = useRef(0);
  const touchStartYRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < media.length - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, media.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setLastPinchDist(dist);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      touchStartX.current = e.touches[0].pageX;
      touchStartYRef.current = e.touches[0].pageY;
      setStartPos({ x: e.touches[0].pageX - position.x, y: e.touches[0].pageY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (lastPinchDist > 0) {
        const delta = dist / lastPinchDist;
        setScale(prev => Math.min(Math.max(1, prev * delta), 4));
      }
      setLastPinchDist(dist);
    } else if (e.touches.length === 1 && isDragging) {
      const newX = e.touches[0].pageX - startPos.x;
      const newY = e.touches[0].pageY - startPos.y;
      
      // Swipe down to close if scale is 1
      if (scale === 1 && newY > 150) {
        onClose();
        return;
      }

      // Limit panning if zoomed
      if (scale > 1) {
        setPosition({ x: newX, y: newY });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isDragging && scale === 1) {
      const deltaX = e.changedTouches[0].pageX - touchStartX.current;
      const threshold = 50;
      if (deltaX > threshold) {
        handlePrev();
      } else if (deltaX < -threshold) {
        handleNext();
      }
    }
    
    setIsDragging(false);
    setLastPinchDist(0);
    if (scale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  const currentMedia = media[currentIndex];

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center select-none touch-none animate-in fade-in duration-300"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => { if (scale === 1) onClose(); }}
    >
      {/* Overlay Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="text-white font-black text-xs tracking-[0.2em] uppercase">
          {currentIndex + 1} / {media.length}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white pointer-events-auto active:scale-90 transition-transform"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {currentMedia.type === 'image' ? (
          <img
            ref={imgRef}
            key={currentIndex}
            src={currentMedia.url}
            alt="Gallery item"
            onDoubleClick={handleDoubleClick}
            className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out cursor-zoom-in"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              touchAction: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <video 
            key={currentIndex}
            src={currentMedia.url} 
            controls 
            autoPlay
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Footer Instructions */}
      {scale === 1 && (
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none animate-in slide-in-from-bottom-4">
          <div className="flex gap-4">
             <div className="bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Maximize2 size={12} className="text-white" />
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Glissez pour défiler</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaLightbox;

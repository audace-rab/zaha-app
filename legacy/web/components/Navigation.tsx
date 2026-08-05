
import React from 'react';
import { Home, Utensils, Bed, Sparkles } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  isVisible?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView, isVisible = true }) => {
  const navItems = [
    { id: AppView.FEED, icon: Home, label: 'Feed' },
    { id: AppView.RESTAURANTS, icon: Utensils, label: 'Restos' },
    { id: AppView.HOTELS, icon: Bed, label: 'Hôtels' },
    { id: AppView.CHAT, icon: Sparkles, label: 'Assistant' },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-50 pb-safe transition-all duration-500 ease-in-out transform ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
    }`}>
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
              currentView === item.id 
                ? 'text-teal-600 scale-110' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${currentView === item.id ? 'bg-teal-50' : ''}`}>
              <item.icon size={20} strokeWidth={currentView === item.id ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] font-bold ${currentView === item.id ? 'opacity-100' : 'opacity-80'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Navigation;

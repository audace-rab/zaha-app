
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Coordinates } from '../types';
import { chatWithAgent } from '../services/geminiService';
import { cacheGet, cacheSet, CACHE_KEYS } from '../services/cacheService';
import { Send, Sparkles, Loader2, User, Globe, ExternalLink, Trash2, AlertCircle, Info, Lock } from 'lucide-react';

interface AIAgentViewProps {
  userLocation: Coordinates | null;
}

interface QuotaData {
  count: number;
  startTime: number;
}

const MAX_QUOTA = 25;

const AIAgentView: React.FC<AIAgentViewProps> = ({ userLocation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = cacheGet<ChatMessage[]>(CACHE_KEYS.CHAT_HISTORY);
    return cached || [
      {
        id: 'welcome',
        role: 'model',
        text: "Que souhaitez-vous explorer aujourd’hui ?",
        timestamp: Date.now()
      }
    ];
  });
  
  const [quota, setQuota] = useState<QuotaData>(() => {
    const saved = localStorage.getItem(CACHE_KEYS.AI_QUOTA);
    if (saved) {
      const parsed: QuotaData = JSON.parse(saved);
      // Si les 24h sont passées, reset
      if (Date.now() - parsed.startTime > 24 * 60 * 60 * 1000) {
        return { count: 0, startTime: Date.now() };
      }
      return parsed;
    }
    return { count: 0, startTime: Date.now() };
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    cacheSet(CACHE_KEYS.CHAT_HISTORY, messages, 60 * 24 * 7);
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEYS.AI_QUOTA, JSON.stringify(quota));
  }, [quota]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || quota.count >= MAX_QUOTA) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const history = [...messages, userMsg];
    const response = await chatWithAgent(history, userLocation);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response.text,
      timestamp: Date.now(),
      sources: response.sources
    };

    setMessages(prev => [...prev, botMsg]);
    setQuota(prev => ({ ...prev, count: prev.count + 1 }));
    setIsTyping(false);
  };

  const clearHistory = () => {
    if (window.confirm("Effacer l'historique ?")) {
      const welcome = [messages[0]];
      setMessages(welcome);
    }
  };

  const isQuotaExceeded = quota.count >= MAX_QUOTA;
  const resetTime = new Date(quota.startTime + 24 * 60 * 60 * 1000);
  const resetTimeString = resetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const resetDateString = resetTime.toLocaleDateString([], { day: 'numeric', month: 'short' });

  return (
    <div className="flex flex-col h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-600 p-2 rounded-xl text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Zaha Assistant</h1>
            <div className="flex items-center text-[10px] text-teal-600 font-bold uppercase tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isQuotaExceeded ? 'bg-amber-500' : 'bg-teal-600 animate-pulse'}`}></span>
              {isQuotaExceeded ? 'Limite atteinte' : 'En ligne'}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <div className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                {quota.count}/{MAX_QUOTA}
            </div>
            <button onClick={clearHistory} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                <Trash2 size={18} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-teal-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.sources.map((source, idx) => (
                    <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center text-[10px] bg-gray-200/50 text-gray-600 px-2 py-1 rounded-md">
                      <Globe size={10} className="mr-1" />
                      {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                    </a>
                  ))}
                </div>
              )}
              <span className="text-[10px] text-gray-400 mt-1.5 px-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quota Message Overlay */}
      {isQuotaExceeded && (
          <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                  <p className="text-xs font-bold text-amber-800">Limite quotidienne atteinte (25/25)</p>
                  <p className="text-[10px] text-amber-700 mt-1">
                      Votre quota sera actualisé le <strong>{resetDateString}</strong> à <strong>{resetTimeString}</strong>.
                  </p>
              </div>
          </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <div className={`flex items-center rounded-2xl border p-1.5 transition-all ${isQuotaExceeded ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-200 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500'}`}>
          <textarea 
            rows={1}
            disabled={isQuotaExceeded}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isQuotaExceeded ? "Session verrouillée..." : "Posez une question..."}
            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none disabled:cursor-not-allowed"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping || isQuotaExceeded}
            className={`p-2.5 rounded-xl transition-all ${
              input.trim() && !isTyping && !isQuotaExceeded
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isTyping ? <Loader2 size={18} className="animate-spin" /> : isQuotaExceeded ? <Lock size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAgentView;

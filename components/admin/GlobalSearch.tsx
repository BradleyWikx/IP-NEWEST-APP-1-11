
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, X, Ticket, User, Wallet, Clock, Calendar, 
  ChevronRight, Command
} from 'lucide-react';
import { buildSearchIndex, filterSearch, SearchItem, SearchCategory } from '../../utils/searchIndex';

export const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [index, setIndex] = useState<SearchItem[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 1. Build/Rebuild Index on Data Change
  useEffect(() => {
    // Initial build
    setIndex(buildSearchIndex());

    // Listen for storage updates to rebuild
    const handleStorageUpdate = () => {
      setIndex(buildSearchIndex());
    };
    
    window.addEventListener('storage-update', handleStorageUpdate);
    return () => window.removeEventListener('storage-update', handleStorageUpdate);
  }, []);

  // 2. Filter Results
  const results = useMemo(() => filterSearch(index, query), [index, query]);

  // 3. Keyboard Shortcuts (Cmd+K)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  // 4. Focus Input on Open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 5. In-Modal Keyboard Navigation
  const handleModalKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    // Use query param 'open' to trigger drawer on target page
    const targetUrl = item.actionId 
      ? `${item.link}?open=${encodeURIComponent(item.actionId)}`
      : item.link;
    navigate(targetUrl);
  };

  // --- Render Helpers ---

  const getIcon = (category: SearchCategory) => {
    switch (category) {
      case 'RESERVATION': return <Ticket size={16} className="text-blue-500" />;
      case 'CUSTOMER': return <User size={16} className="text-emerald-500" />;
      case 'VOUCHER': return <Wallet size={16} className="text-amber-500" />;
      case 'WAITLIST': return <Clock size={16} className="text-purple-500" />;
      case 'EVENT': return <Calendar size={16} className="text-rose-500" />;
      default: return <Search size={16} />;
    }
  };

  const getBadge = (item: SearchItem) => {
    if (!item.status) return null;
    let color = 'bg-slate-800 text-slate-400 border-slate-700';
    
    // Status Logic mappings
    if (['CONFIRMED', 'ACTIVE', 'OPEN'].includes(item.status)) color = 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50';
    if (['REQUEST', 'PENDING', 'WAITLIST'].includes(item.status)) color = 'bg-blue-900/30 text-blue-500 border-blue-900/50';
    if (['OPTION', 'WAITLIST'].includes(item.status)) color = 'bg-amber-900/30 text-amber-500 border-amber-900/50';
    if (['CANCELLED', 'CLOSED', 'EXPIRED'].includes(item.status)) color = 'bg-red-900/30 text-red-500 border-red-900/50';

    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ml-2 ${color}`}>
        {item.status}
      </span>
    );
  };

  return (
    <>
      {/* Trigger Button (Desktop & Mobile) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full h-full flex items-center group cursor-text"
      >
        <div className="flex items-center text-slate-500 group-hover:text-slate-300 w-full">
          <Search size={18} className="mr-3" />
          <span className="text-sm hidden md:inline">Zoeken...</span>
          <span className="text-sm md:hidden">Zoeken</span>
          
          <div className="hidden md:flex ml-auto items-center space-x-1">
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            {/* Input Header */}
            <div className="flex items-center px-4 py-4 border-b border-slate-800 shrink-0">
              <Search className="text-slate-500 mr-3" size={20} />
              <input 
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleModalKeydown}
                placeholder="Zoek boekingen, klanten, data..."
                className="flex-grow bg-transparent text-lg text-white placeholder:text-slate-600 outline-none"
                autoComplete="off"
              />
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded bg-slate-900 text-slate-500 hover:text-white text-xs border border-slate-800 ml-2"
              >
                ESC
              </button>
            </div>

            {/* Results List */}
            <div 
              ref={listRef}
              className="overflow-y-auto custom-scrollbar flex-grow p-2"
            >
              {results.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  {query ? (
                    <>
                      <p className="font-bold text-slate-400 mb-1">Geen resultaten gevonden</p>
                      <p className="text-xs">Probeer een andere zoekterm.</p>
                    </>
                  ) : (
                    <>
                      <Command className="mx-auto mb-4 opacity-20" size={48} />
                      <p className="text-xs uppercase tracking-widest font-bold">Type om te zoeken</p>
                    </>
                  )}
                </div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors group
                      ${idx === selectedIndex ? 'bg-amber-900/10 border border-amber-900/30' : 'hover:bg-slate-900 border border-transparent'}
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 mr-4 shrink-0 group-hover:border-slate-700 ${idx === selectedIndex ? 'border-amber-900/50 bg-amber-900/20' : ''}`}>
                        {getIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center">
                          <span className={`text-sm font-bold truncate ${idx === selectedIndex ? 'text-amber-500' : 'text-white'}`}>
                            {item.title}
                          </span>
                          {getBadge(item)}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-700 ${idx === selectedIndex ? 'text-amber-500 opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-900 bg-slate-900/30 text-[10px] text-slate-600 flex justify-between items-center shrink-0">
               <span>
                 <span className="font-bold">{results.length}</span> resultaten
               </span>
               <div className="flex space-x-3">
                 <span className="flex items-center"><span className="bg-slate-800 px-1 rounded mr-1">↑↓</span> om te navigeren</span>
                 <span className="flex items-center"><span className="bg-slate-800 px-1 rounded mr-1">↵</span> om te selecteren</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

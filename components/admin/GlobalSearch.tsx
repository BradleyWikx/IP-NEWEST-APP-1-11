
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, X, Ticket, User, Wallet, Clock, Calendar, 
  ChevronRight, Command, Zap, PlusCircle, LayoutDashboard,
  Moon, Utensils, DollarSign
} from 'lucide-react';
import { buildSearchIndex, filterSearch, SearchItem } from '../../utils/searchIndex';

// --- Types ---

type CommandAction = {
  id: string;
  type: 'ACTION';
  label: string;
  icon: any;
  action: () => void;
  contextTag?: string; // Optional visual tag
};

type PaletteItem = SearchItem & { contextMatch?: boolean; contextLabel?: string } | CommandAction;

export const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [index, setIndex] = useState<SearchItem[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Build Index
  useEffect(() => {
    setIndex(buildSearchIndex());
    const handleStorageUpdate = () => setIndex(buildSearchIndex());
    window.addEventListener('storage-update', handleStorageUpdate);
    return () => window.removeEventListener('storage-update', handleStorageUpdate);
  }, []);

  // 2. Define System Commands
  const commands: CommandAction[] = useMemo(() => [
    { 
      id: 'cmd-new-booking', 
      type: 'ACTION', 
      label: 'Nieuwe Boeking Starten', 
      icon: PlusCircle, 
      action: () => navigate('/admin/reservations/new') 
    },
    { 
      id: 'cmd-calendar', 
      type: 'ACTION', 
      label: 'Ga naar Agenda', 
      icon: Calendar, 
      action: () => navigate('/admin/calendar') 
    },
    { 
      id: 'cmd-dashboard', 
      type: 'ACTION', 
      label: 'Ga naar Dashboard', 
      icon: LayoutDashboard, 
      action: () => navigate('/admin') 
    },
    { 
      id: 'cmd-theme', 
      type: 'ACTION', 
      label: 'Toggle Dark Mode', 
      icon: Moon, 
      action: () => alert('Thema gewijzigd (Demo)') 
    }
  ], [navigate]);

  // 3. Filter Logic (Merges Commands & Search Results with Context Ranking)
  const results = useMemo<PaletteItem[]>(() => {
    // Detect Context
    const isKitchen = location.pathname.includes('/kitchen');
    const isFinance = location.pathname.includes('/finance') || location.pathname.includes('/payments');
    
    if (!query) {
        // Show context-relevant commands first if empty
        return commands; 
    }

    const searchResults = filterSearch(index, query);
    
    // Enrich with Context Scores
    const rankedResults = searchResults.map(item => {
        let score = 0;
        let contextLabel = undefined;
        let contextMatch = false;

        // Kitchen Context: Boost Reservations with Allergy/Diet keywords
        if (isKitchen && item.category === 'RESERVATION') {
            // Check keywords for diet terms (assuming search index includes them)
            const dietTerms = ['glut', 'lact', 'vega', 'vis', 'noten', 'allergi'];
            const hasDiet = item.keywords.some(k => dietTerms.some(dt => k.toLowerCase().includes(dt)));
            if (hasDiet) {
                score += 10;
                contextMatch = true;
                contextLabel = 'Keuken Match';
            }
        }

        // Finance Context: Boost Vouchers or Paid amounts
        if (isFinance) {
            if (item.category === 'VOUCHER') {
                score += 10;
                contextMatch = true;
                contextLabel = 'Finance Match';
            }
            // Check if query looks like an amount
            if (!isNaN(parseFloat(query)) && item.keywords.some(k => k.includes(query))) {
                score += 5;
                contextMatch = true;
                contextLabel = 'Bedrag Match';
            }
        }

        return { ...item, score, contextMatch, contextLabel };
    }).sort((a, b) => b.score - a.score); // Sort by context score

    // Filter commands locally
    const filteredCommands = commands.filter(c => 
      c.label.toLowerCase().includes(query.toLowerCase())
    );

    return [...filteredCommands, ...rankedResults];
  }, [index, query, commands, location.pathname]);

  // 4. Keyboard Shortcuts
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

  // 5. Open/Focus Logic
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 6. Navigation Logic
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

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results]);

  const handleSelect = (item: PaletteItem) => {
    setIsOpen(false);
    
    if ('type' in item && item.type === 'ACTION') {
      item.action();
    } else {
      // It's a SearchItem
      const sItem = item as SearchItem;
      const targetUrl = sItem.actionId 
        ? `${sItem.link}?open=${encodeURIComponent(sItem.actionId)}`
        : sItem.link;
      
      // Dispatch event to add to TaskBar (Multi-Tab)
      window.dispatchEvent(new CustomEvent('grand-stage-open-tab', {
        detail: {
          id: sItem.id,
          title: sItem.title,
          link: targetUrl,
          iconType: sItem.category
        }
      }));

      navigate(targetUrl);
    }
  };

  // --- Render Helpers ---

  const getIcon = (item: PaletteItem) => {
    if ('type' in item && item.type === 'ACTION') {
      const Icon = item.icon;
      return <Icon size={16} className="text-slate-400" />;
    }

    const sItem = item as SearchItem;
    switch (sItem.category) {
      case 'RESERVATION': return <Ticket size={16} className="text-blue-500" />;
      case 'CUSTOMER': return <User size={16} className="text-emerald-500" />;
      case 'VOUCHER': return <Wallet size={16} className="text-amber-500" />;
      case 'WAITLIST': return <Clock size={16} className="text-purple-500" />;
      case 'EVENT': return <Calendar size={16} className="text-rose-500" />;
      default: return <Search size={16} />;
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full h-full flex items-center group cursor-text"
      >
        <div className="flex items-center text-slate-500 group-hover:text-slate-300 w-full">
          <Search size={18} className="mr-3" />
          <span className="text-sm hidden md:inline">Command Palette...</span>
          <span className="text-sm md:hidden">Zoeken</span>
          
          <div className="hidden md:flex ml-auto items-center space-x-1">
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            <div className="flex items-center px-4 py-4 border-b border-slate-800 shrink-0">
              <Command className="text-amber-500 mr-3" size={20} />
              <input 
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleModalKeydown}
                placeholder="Wat wil je doen?"
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

            <div ref={listRef} className="overflow-y-auto custom-scrollbar flex-grow p-2">
              {results.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p className="font-bold text-slate-400 mb-1">Geen resultaten</p>
                  <p className="text-xs">Probeer een andere opdracht.</p>
                </div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={('id' in item) ? item.id : idx}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors group
                      ${idx === selectedIndex ? 'bg-slate-800 border border-slate-700' : 'hover:bg-slate-900 border border-transparent'}
                    `}
                  >
                    <div className="flex items-center min-w-0 flex-grow">
                      <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 mr-4 shrink-0 group-hover:border-slate-700 ${idx === selectedIndex ? 'bg-black' : ''}`}>
                        {getIcon(item)}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center">
                          <span className={`text-sm font-bold truncate ${idx === selectedIndex ? 'text-white' : 'text-slate-300'}`}>
                            {'title' in item ? item.title : item.label}
                          </span>
                          {'status' in item && item.status && (
                             <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400 font-mono">
                               {item.status}
                             </span>
                          )}
                          {'contextMatch' in item && item.contextMatch && (
                             <span className="ml-2 flex items-center text-[9px] px-1.5 py-0.5 rounded border border-amber-900/50 bg-amber-900/20 text-amber-500 font-bold uppercase tracking-wider">
                               {location.pathname.includes('kitchen') ? <Utensils size={8} className="mr-1"/> : <DollarSign size={8} className="mr-1"/>}
                               {item.contextLabel}
                             </span>
                          )}
                        </div>
                        {'subtitle' in item && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                       {'type' in item && item.type === 'ACTION' && (
                         <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded mr-3 border border-slate-800">Command</span>
                       )}
                       <ChevronRight size={16} className={`text-slate-500 ${idx === selectedIndex ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-900 bg-slate-900/30 text-[10px] text-slate-600 flex justify-between items-center shrink-0">
               <span>
                 <span className="font-bold">{results.length}</span> opties
               </span>
               <div className="flex space-x-3">
                 <span className="flex items-center"><span className="bg-slate-800 px-1 rounded mr-1 border border-slate-700">↑↓</span> selecteer</span>
                 <span className="flex items-center"><span className="bg-slate-800 px-1 rounded mr-1 border border-slate-700">↵</span> open</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

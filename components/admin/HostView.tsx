
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Utensils, AlertCircle, CheckCircle2, 
  Search, Package, Star, Clock, Scan, X,
  ChevronRight, PartyPopper, LayoutDashboard, Lock, 
  Wallet, CreditCard, Filter, Map, List, WifiOff, CloudOff,
  Maximize, Minimize
} from 'lucide-react';
import { Button, Card, Input } from '../UI';
import { BookingStatus, Reservation } from '../../types';
import { bookingRepo } from '../../utils/storage';
import { ScannerModal } from './ScannerModal';
import { undoManager } from '../../utils/undoManager';
import { formatCurrency, formatGuestName } from '../../utils/formatters';
import { FloorPlanEditor } from './FloorPlanEditor';
import { useOfflineData } from '../../hooks/useOfflineData';

// --- TYPES ---

interface HostReservation {
  id: string;
  // Core
  customerName: string;
  partySize: number;
  virtualTableNumber: number; // Stable Index
  status: BookingStatus;
  // Details
  time: string;
  notes: {
    dietary: string;
    isCelebrating: boolean;
    celebrationText?: string;
  };
  // Financials & Flags
  hasVoucher: boolean;
  outstandingBalance: number;
  isPremium: boolean;
  
  arrived: boolean;
  createdAt: string; // Used for sorting
  tableId?: string; // Physical Table
}

interface GuestCardProps {
  reservation: HostReservation;
  onCheckIn: () => void;
  onDetails: () => void;
  focusMode: boolean;
}

// --- SUB-COMPONENT: GUEST CARD (Swipeable) ---

const GuestCard: React.FC<GuestCardProps> = ({ reservation, onCheckIn, onDetails, focusMode }) => {
  const isArrived = reservation.status === BookingStatus.ARRIVED;
  const hasDietary = !!reservation.notes.dietary;
  const hasBalance = reservation.outstandingBalance > 0.01;

  // Swipe Logic
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 100;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); 
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart !== null) {
      setTranslateX(e.targetTouches[0].clientX - touchStart);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe Left -> Details
      onDetails();
    } else if (isRightSwipe && !isArrived) {
      // Swipe Right -> Check-in
      if (navigator.vibrate) navigator.vibrate(50);
      onCheckIn();
    }
    
    // Reset
    setTranslateX(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Dynamic Styles based on swipe
  let bgStyle = {};
  let overlayIcon = null;
  
  if (translateX > 50 && !isArrived) { // Swiping Right (Green)
     bgStyle = { background: 'linear-gradient(to right, rgba(16, 185, 129, 0.5), transparent)' };
     overlayIcon = <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-white" size={32} />;
  } else if (translateX < -50) { // Swiping Left (Blue)
     bgStyle = { background: 'linear-gradient(to left, rgba(59, 130, 246, 0.5), transparent)' };
     overlayIcon = <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-white" size={32} />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl h-full">
      {/* Background Layer for Swipe Feedback */}
      <div className="absolute inset-0 z-0 transition-colors" style={bgStyle}>
         {overlayIcon}
      </div>

      <div 
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onDetails}
        style={{ transform: `translateX(${translateX}px)`, transition: touchStart ? 'none' : 'transform 0.2s ease-out' }}
        className={`
          relative z-10 flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 h-full
          ${isArrived 
            ? 'bg-slate-950/80 border-slate-800 opacity-75 grayscale-[0.5]' 
            : 'bg-slate-900 border-slate-700 shadow-lg hover:border-slate-600'}
        `}
      >
        {/* Header: Table & Time */}
        <div className="flex justify-between items-start mb-2">
           <div className="flex items-center space-x-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-serif font-bold border-2 ${isArrived ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-800 border-amber-500/50 text-white'}`}>
                 {reservation.tableId ? reservation.tableId.replace('TAB-','') : `#${reservation.virtualTableNumber}`}
              </div>
              <div>
                 <h3 className={`text-xl font-bold leading-tight line-clamp-1 ${isArrived ? 'text-slate-500' : 'text-white'}`}>
                    {reservation.customerName}
                 </h3>
                 {!focusMode && <span className="text-xs text-slate-500">{reservation.time}</span>}
              </div>
           </div>
           
           <div className="text-right">
              {reservation.isPremium && (
                 <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-900/30 text-amber-500 border border-amber-500/30">
                    <Star size={14} fill="currentColor" />
                 </span>
              )}
           </div>
        </div>

        {/* Body */}
        <div className="mb-4 flex-grow">
           <div className="flex items-center gap-3 mt-2">
              <div className={`flex items-center px-3 py-1.5 rounded-full ${isArrived ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-white border border-slate-600'}`}>
                 <Users size={16} className="mr-2" />
                 <span className="text-lg font-bold">{reservation.partySize}</span>
              </div>
              
              {hasDietary && (
                 <div className="flex items-center px-2 py-1.5 rounded-full bg-red-900/20 border border-red-500/30 text-red-400">
                    <Utensils size={14} />
                 </div>
              )}
              {reservation.notes.isCelebrating && (
                 <div className="flex items-center px-2 py-1.5 rounded-full bg-blue-900/20 border border-blue-500/30 text-blue-400">
                    <PartyPopper size={14} />
                 </div>
              )}
           </div>

           {/* Financial Indicators (Hidden in Focus Mode unless critical) */}
           {(!focusMode || hasBalance) && (
             <div className="flex flex-wrap gap-2 mt-3">
                {hasBalance && (
                   <span className="flex items-center text-[10px] font-bold text-red-400 bg-red-900/10 px-2 py-1 rounded border border-red-900/30">
                      <CreditCard size={10} className="mr-1" /> Open
                   </span>
                )}
                {!focusMode && reservation.hasVoucher && (
                   <span className="flex items-center text-[10px] font-bold text-amber-500 bg-amber-900/10 px-2 py-1 rounded border border-amber-900/30">
                      <Wallet size={10} className="mr-1" /> Voucher
                   </span>
                )}
             </div>
           )}
        </div>

        {/* Footer: Action (Hidden in Focus Mode if not arrived to reduce noise? No, always need checkin) */}
        <div className={`mt-auto pt-4 border-t border-slate-800 ${focusMode ? 'hidden' : ''}`}>
           {isArrived ? (
              <div className="w-full py-3 bg-emerald-900/5 border border-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-sm uppercase tracking-widest">
                 <CheckCircle2 size={16} className="mr-2" /> Binnen
              </div>
           ) : (
              <button 
                 onClick={(e) => { e.stopPropagation(); onCheckIn(); }}
                 className="w-full h-12 bg-emerald-600 active:bg-emerald-700 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm uppercase tracking-widest shadow-lg transition-all flex items-center justify-center"
              >
                 Check In
              </button>
           )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export const HostView = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<HostReservation | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  
  // Offline Hooks
  const { isOnline, data: reservations, lastSynced, refresh } = useOfflineData();

  // VIEW MODE
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [editLayout, setEditLayout] = useState(false);

  // LOCK SCREEN STATE
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // --- STABLE PROCESSING LOGIC ---
  const { guestList, stats } = useMemo(() => {
    // 1. Filter for Today & Active Statuses
    const dailyRaw = reservations.filter(r => 
        r.date === selectedDate && 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.NOSHOW &&
        r.status !== BookingStatus.ARCHIVED
    );

    // 2. STABLE SORT: By Creation Date (Oldest First)
    const sortedStable = dailyRaw.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 3. MAP & ASSIGN VIRTUAL TABLE NUMBER
    const enrichedList: HostReservation[] = sortedStable.map((res, index) => ({
      id: res.id,
      customerName: formatGuestName(res.customer.firstName, res.customer.lastName),
      partySize: res.partySize,
      virtualTableNumber: index + 1, // Fixed Table Number based on order
      tableId: res.tableId, // Physical table link
      time: res.startTime || '19:30',
      status: res.status,
      packageType: res.packageType,
      isPremium: res.packageType === 'premium',
      notes: res.notes,
      hasVoucher: !!res.financials.voucherCode || res.financials.voucherUsed > 0,
      outstandingBalance: res.financials.finalTotal - (res.financials.paid || 0),
      createdAt: res.createdAt,
      arrived: res.status === BookingStatus.ARRIVED
    }));

    // 4. APPLY SEARCH FILTER (Smart Search)
    const filtered = enrichedList.filter(r => {
        if (!searchTerm) return true;
        
        const term = searchTerm.toLowerCase().trim();
        const isNumeric = !isNaN(parseInt(term)) && term.length < 3; 

        if (isNumeric) {
            return r.partySize === parseInt(term) || (r.tableId && r.tableId.includes(term));
        } else {
            return r.customerName.toLowerCase().includes(term);
        }
    });

    // 5. FINAL SORT FOR DISPLAY
    const finalDisplayList = filtered.sort((a, b) => {
        if (a.arrived === b.arrived) {
            return a.virtualTableNumber - b.virtualTableNumber; 
        }
        return a.arrived ? 1 : -1; 
    });

    return {
      guestList: finalDisplayList,
      stats: {
        total: enrichedList.reduce((s, r) => s + r.partySize, 0),
        arrived: enrichedList.filter(r => r.arrived).reduce((s, r) => s + r.partySize, 0)
      }
    };
  }, [reservations, selectedDate, searchTerm]);

  // --- ACTIONS ---

  const handleCheckIn = (id: string) => {
    if (!isOnline) {
      alert("Offline Mode: Wijzigingen worden lokaal opgeslagen (simulatie).");
      // In a real PWA we'd queue this action
    }
    bookingRepo.update(id, (r) => ({ ...r, status: BookingStatus.ARRIVED }));
    undoManager.showSuccess("Gast ingecheckt!");
    refresh();
  };

  const handleScanSuccess = (res: Reservation) => {
    handleCheckIn(res.id);
    setShowScanner(false);
  };

  const handleTableClick = (tableId: string, reservation?: Reservation) => {
    if (reservation) {
        // Find processed guest obj
        const guest = guestList.find(g => g.id === reservation.id);
        if(guest) setSelectedGuest(guest);
    } else {
        // Empty table clicked - maybe open assign modal?
        console.log(`Table ${tableId} clicked (Empty)`);
    }
  };

  // --- LOCK SCREEN LOGIC ---
  const handleLock = () => { setPinInput(''); setPinError(false); setIsLocked(true); };
  const handlePinEntry = (num: string) => {
    if (pinError) return;
    const nextPin = pinInput + num;
    setPinInput(nextPin);
    if (nextPin.length === 4) {
      if (nextPin === '0000') { setIsLocked(false); setPinInput(''); } 
      else { setPinError(true); setTimeout(() => { setPinInput(''); setPinError(false); }, 600); }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans overflow-hidden">
      
      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div className="bg-red-600 text-white text-xs font-bold uppercase tracking-widest text-center py-1 flex items-center justify-center z-[101]">
          <WifiOff size={14} className="mr-2" /> Offline Modus - Laatst gesynchroniseerd: {lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'Nooit'}
        </div>
      )}

      {/* ... Header ... */}
      {!focusMode && (
      <div className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 pt-safe-top pb-3 px-4 z-20 shrink-0">
         <div className="flex justify-between items-center mb-4 pt-2">
            <div>
              <h1 className="text-xl font-serif text-white font-bold">Host Mode</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 hidden md:flex">
                 <button onClick={() => setViewMode('LIST')} className={`p-2 rounded ${viewMode === 'LIST' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}><List size={18}/></button>
                 <button onClick={() => setViewMode('MAP')} className={`p-2 rounded ${viewMode === 'MAP' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}><Map size={18}/></button>
              </div>

              <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block" />

              <button onClick={() => setFocusMode(true)} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white" title="Focus Mode">
                <Maximize size={18} />
              </button>

              <button onClick={handleLock} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                <Lock size={18} />
              </button>
              <button onClick={() => setShowScanner(true)} className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                <Scan size={20} />
              </button>
              <button onClick={() => navigate('/admin', { replace: true })} className="h-10 px-4 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs uppercase tracking-wider">
                <LayoutDashboard size={16} className="mr-2" /> Exit
              </button>
            </div>
         </div>

         {/* Smart Search Bar (Only in List View) */}
         {viewMode === 'LIST' && (
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  className="w-full h-12 bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-all text-lg"
                  placeholder="Zoek naam of '4' voor groep..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-800 rounded-full text-slate-400">
                    <X size={14} />
                  </button>
                )}
             </div>
         )}
      </div>
      )}

      {/* Simplified Header for Focus Mode */}
      {focusMode && (
        <div className="bg-black border-b border-slate-800 p-2 px-4 flex justify-between items-center z-20">
            <button onClick={() => setFocusMode(false)} className="p-2 text-slate-500 flex items-center text-xs font-bold uppercase">
                <Minimize size={16} className="mr-1"/> Exit Focus
            </button>
            <div className="flex items-center space-x-4">
                <span className="text-xl font-black text-white">{stats.arrived} <span className="text-slate-600 text-sm">/ {stats.total}</span></span>
                <button onClick={() => setShowScanner(true)} className="w-8 h-8 bg-amber-500 text-black rounded-full flex items-center justify-center">
                    <Scan size={16} />
                </button>
            </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden bg-black relative">
         {viewMode === 'LIST' ? (
            <div className="h-full overflow-y-auto p-4 pb-32 custom-scrollbar">
                {guestList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">Geen gasten gevonden.</p>
                </div>
                ) : (
                <div className={`grid gap-4 ${focusMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {guestList.map(guest => (
                    <GuestCard 
                        key={guest.id} 
                        reservation={guest} 
                        onCheckIn={() => handleCheckIn(guest.id)} 
                        onDetails={() => setSelectedGuest(guest)}
                        focusMode={focusMode}
                    />
                    ))}
                </div>
                )}
            </div>
         ) : (
            <div className="h-full w-full">
                <FloorPlanEditor 
                    mode={editLayout ? 'EDIT' : 'HOST'}
                    reservations={reservations.filter(r => r.date === selectedDate && r.status !== 'CANCELLED')}
                    onTableClick={handleTableClick}
                />
            </div>
         )}
      </div>

      {/* Status Bar (Hidden in Focus Mode) */}
      {!focusMode && (
      <div className="bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 pb-safe-bottom z-20 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <div className="flex justify-between items-center max-w-4xl mx-auto">
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Aanwezig</span>
               <div className="flex items-baseline space-x-1">
                 <span className="text-3xl font-black text-white">{stats.arrived}</span>
                 <span className="text-lg text-slate-500 font-medium">/ {stats.total}</span>
               </div>
            </div>
            
            <div className="w-1/2 md:w-64 h-3 bg-slate-800 rounded-full overflow-hidden ml-6">
               <div 
                 className={`h-full transition-all duration-500 ${stats.arrived >= stats.total ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                 style={{ width: `${stats.total > 0 ? (stats.arrived / stats.total) * 100 : 0}%` }}
               />
            </div>
         </div>
      </div>
      )}

      {/* Detail Modal */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in">
           <div className="bg-slate-950 w-full max-w-lg rounded-t-3xl border-t border-slate-800 p-6 pb-safe-bottom shadow-2xl animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6" />
              
              <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-white">{selectedGuest.customerName}</h2>
                   <p className="text-slate-500 text-sm font-mono mt-1">{selectedGuest.id}</p>
                 </div>
                 <div className="text-right">
                    <span className="text-4xl font-serif text-white block">{selectedGuest.virtualTableNumber}</span>
                    <span className="text--[10px] text-slate-500 uppercase font-bold tracking-widest">Tafel</span>
                 </div>
              </div>

              {/* ... Detail Content ... */}
              <div className="space-y-4 mb-8">
                 {selectedGuest.notes.dietary && (
                   <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start text-red-200">
                      <Utensils size={20} className="text-red-500 mr-3 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-sm mb-1 text-red-400 uppercase tracking-wide">Dieetwensen</p>
                        <p className="text-sm">{selectedGuest.notes.dietary}</p>
                      </div>
                   </div>
                 )}
                 
                 {selectedGuest.notes.isCelebrating && (
                   <div className="p-4 bg-blue-900/20 border border-blue-900/50 rounded-xl flex items-start text-blue-200">
                      <PartyPopper size={20} className="text-blue-500 mr-3 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-sm mb-1 text-blue-400 uppercase tracking-wide">Viering</p>
                        <p className="text-sm">{selectedGuest.notes.celebrationText || 'Geen details'}</p>
                      </div>
                   </div>
                 )}

                 <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Arrangement</span>
                    <span className="text-white font-bold capitalize">{selectedGuest.packageType}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <Button variant="secondary" onClick={() => setSelectedGuest(null)} className="h-12">Sluiten</Button>
                 {!selectedGuest.arrived && (
                   <Button onClick={() => { handleCheckIn(selectedGuest.id); setSelectedGuest(null); }} className="h-12 bg-emerald-600 hover:bg-emerald-700">Check In</Button>
                 )}
              </div>
           </div>
        </div>
      )}

      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onCheckIn={handleScanSuccess} />}

      {/* ... Lock Overlay ... */}
      {isLocked && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-300">
           {/* ... Lock Content ... */}
           <div className="mb-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-800 shadow-2xl mb-4">
                 <Lock size={32} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-serif text-white mb-2">Host View Vergrendeld</h2>
              <p className="text-slate-500 text-sm uppercase tracking-widest">Voer pincode in om verder te gaan</p>
           </div>

           <div className="space-y-8 w-full max-w-xs">
              <div className="flex justify-center space-x-4 mb-4 h-4">
                 {[0, 1, 2, 3].map(idx => (
                   <div key={idx} className={`w-3 h-3 rounded-full transition-all duration-300 ${idx < pinInput.length ? (pinError ? 'bg-red-500 scale-125' : 'bg-amber-500 scale-110') : 'bg-slate-800'}`} />
                 ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                   <button key={num} onClick={() => handlePinEntry(num.toString())} className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 transition-all mx-auto flex items-center justify-center shadow-lg">{num}</button>
                 ))}
                 <div />
                 <button onClick={() => handlePinEntry('0')} className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 transition-all mx-auto flex items-center justify-center shadow-lg">0</button>
                 <button onClick={() => setPinInput(prev => prev.slice(0, -1))} className="h-16 w-16 rounded-full bg-transparent text-slate-500 hover:text-white flex items-center justify-center transition-colors mx-auto">Correction</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Utensils, AlertCircle, CheckCircle2, 
  Search, Package, Star, Clock, Scan, X,
  ChevronRight, PartyPopper, LayoutDashboard, Lock, 
  Wallet, CreditCard, Filter
} from 'lucide-react';
import { Button, Card, Input } from '../UI';
import { BookingStatus, Reservation } from '../../types';
import { bookingRepo } from '../../utils/storage';
import { ScannerModal } from './ScannerModal';
import { undoManager } from '../../utils/undoManager';
import { formatCurrency, formatGuestName } from '../../utils/formatters';

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
}

interface GuestCardProps {
  reservation: HostReservation;
  onCheckIn: () => void;
  onDetails: () => void;
}

// --- SUB-COMPONENT: GUEST CARD (Redesigned) ---

const GuestCard: React.FC<GuestCardProps> = ({ reservation, onCheckIn, onDetails }) => {
  const isArrived = reservation.status === BookingStatus.ARRIVED;
  const hasDietary = !!reservation.notes.dietary;
  const hasBalance = reservation.outstandingBalance > 0.01;

  return (
    <div 
      className={`
        relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 h-full
        ${isArrived 
          ? 'bg-slate-950/60 border-slate-800 opacity-75 grayscale-[0.5]' 
          : 'bg-slate-900 border-slate-700 shadow-lg hover:border-slate-600'}
      `}
      onClick={onDetails}
    >
      {/* Header: Table & Time */}
      <div className="flex justify-between items-start mb-4">
         <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Tafel</span>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-serif font-bold border-2 ${isArrived ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-800 border-amber-500/50 text-white'}`}>
               {reservation.virtualTableNumber}
            </div>
         </div>
         <div className="text-right">
            <span className="flex items-center justify-end text-xs font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
               <Clock size={12} className="mr-1.5" /> {reservation.time}
            </span>
            {reservation.isPremium && (
               <span className="inline-flex items-center text-[10px] font-bold text-amber-500 uppercase mt-1">
                  <Star size={10} className="mr-1 fill-amber-500" /> Premium
               </span>
            )}
         </div>
      </div>

      {/* Body: Name & Pax */}
      <div className="mb-6 flex-grow">
         <h3 className={`text-xl font-bold leading-tight mb-2 line-clamp-2 ${isArrived ? 'text-slate-500' : 'text-white'}`}>
            {reservation.customerName}
         </h3>
         
         <div className="flex items-center space-x-2 mb-3">
            <div className={`flex items-center px-3 py-1.5 rounded-full ${isArrived ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-white border border-slate-600'}`}>
               <Users size={16} className="mr-2" />
               <span className="text-lg font-bold">{reservation.partySize}</span>
            </div>
            {hasDietary && (
               <div className="w-8 h-8 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center text-red-400" title="Dieetwensen">
                  <Utensils size={14} />
               </div>
            )}
            {reservation.notes.isCelebrating && (
               <div className="w-8 h-8 rounded-full bg-blue-900/20 border border-blue-500/30 flex items-center justify-center text-blue-400" title="Viering">
                  <PartyPopper size={14} />
               </div>
            )}
         </div>

         {/* Financial Indicators */}
         <div className="flex flex-wrap gap-2">
            {hasBalance && (
               <span className="flex items-center text-[10px] font-bold text-red-400 bg-red-900/10 px-2 py-1 rounded border border-red-900/30">
                  <CreditCard size={10} className="mr-1" /> Open: {formatCurrency(reservation.outstandingBalance)}
               </span>
            )}
            {reservation.hasVoucher && (
               <span className="flex items-center text-[10px] font-bold text-amber-500 bg-amber-900/10 px-2 py-1 rounded border border-amber-900/30">
                  <Wallet size={10} className="mr-1" /> Voucher
               </span>
            )}
         </div>
      </div>

      {/* Footer: Action */}
      <div className="mt-auto pt-4 border-t border-slate-800">
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
  );
};

// --- MAIN COMPONENT ---

export const HostView = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<HostReservation | null>(null);
  
  // LOCK SCREEN STATE
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // --- DATA LOADING ---
  const loadData = () => {
    setReservations(bookingRepo.getAll());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Live sync
    return () => clearInterval(interval);
  }, []);

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
            return r.partySize === parseInt(term);
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
    bookingRepo.update(id, (r) => ({ ...r, status: BookingStatus.ARRIVED }));
    undoManager.showSuccess("Gast ingecheckt!");
    loadData();
  };

  const handleScanSuccess = (res: Reservation) => {
    handleCheckIn(res.id);
    setShowScanner(false);
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
      {/* ... Header ... */}
      <div className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 pt-safe-top pb-3 px-4 z-20 shrink-0">
         <div className="flex justify-between items-center mb-4 pt-2">
            <div>
              <h1 className="text-xl font-serif text-white font-bold">Host Mode</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            
            <div className="flex items-center space-x-3">
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

         {/* Smart Search Bar */}
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
      </div>

      {/* Guest Grid */}
      <div className="flex-grow overflow-y-auto p-4 pb-32 custom-scrollbar bg-black">
         {guestList.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-slate-500">
             <Filter size={48} className="mb-4 opacity-20" />
             <p className="text-sm">Geen gasten gevonden.</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {guestList.map(guest => (
               <GuestCard 
                 key={guest.id} 
                 reservation={guest} 
                 onCheckIn={() => handleCheckIn(guest.id)} 
                 onDetails={() => setSelectedGuest(guest)}
               />
             ))}
           </div>
         )}
      </div>

      {/* Status Bar */}
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
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Tafel</span>
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

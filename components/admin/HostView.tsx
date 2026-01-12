
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Utensils, AlertCircle, CheckCircle2, 
  Search, Package, Star, Clock, Scan, X,
  ChevronRight, PartyPopper, LayoutDashboard, Lock, Unlock, Delete
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { BookingStatus, Reservation } from '../../types';
import { bookingRepo, customerRepo } from '../../utils/storage';
import { ScannerModal } from './ScannerModal';
import { undoManager } from '../../utils/undoManager';

// --- TYPES & INTERFACES ---

interface HostReservation {
  id: string;
  customerId: string;
  customerName: string;
  partySize: number;
  time: string; 
  status: BookingStatus;
  tableNumber?: number;
  packageType: string;
  notes: {
    dietary: string;
    isCelebrating: boolean;
    celebrationText?: string;
  };
  tags: string[];
  createdAt: string;
  arrived: boolean;
}

interface GuestCardProps {
  reservation: HostReservation;
  onCheckIn: () => void;
  onDetails: () => void;
}

// --- SUB-COMPONENT: GUEST CARD ---

const GuestCard: React.FC<GuestCardProps> = ({ reservation, onCheckIn, onDetails }) => {
  const isArrived = reservation.status === BookingStatus.ARRIVED;
  const isPremium = reservation.packageType === 'premium';
  const hasDietary = !!reservation.notes.dietary;

  return (
    <div 
      className={`
        relative p-5 rounded-2xl border transition-all duration-300 shadow-sm
        ${isArrived 
          ? 'bg-slate-950 border-slate-800 opacity-60' 
          : 'bg-slate-900 border-slate-700 active:scale-[0.98] active:bg-slate-800'}
      `}
    >
      <div className="flex justify-between items-start mb-4" onClick={onDetails}>
        {/* Left: Info */}
        <div className="flex-grow pr-4">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className={`text-xl font-bold leading-tight ${isArrived ? 'text-slate-400' : 'text-white'}`}>
              {reservation.customerName}
            </h3>
            {isPremium && <Star size={16} className="text-amber-500 fill-amber-500 shrink-0" />}
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-bold text-white flex items-center border border-slate-700">
              <Users size={12} className="mr-1.5"/> {reservation.partySize} Pers.
            </span>
            {hasDietary && (
              <span className="px-3 py-1 bg-red-900/20 text-red-400 rounded-lg text-xs font-bold border border-red-900/50 flex items-center">
                <Utensils size={12} className="mr-1.5"/> Dieet
              </span>
            )}
            {reservation.notes.isCelebrating && (
              <span className="px-3 py-1 bg-blue-900/20 text-blue-400 rounded-lg text-xs font-bold border border-blue-900/50 flex items-center">
                <PartyPopper size={12} className="mr-1.5"/> Viering
              </span>
            )}
          </div>
        </div>

        {/* Right: Table Number */}
        <div className="flex flex-col items-center justify-center shrink-0">
           <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-serif font-bold border-2 ${isArrived ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-800 border-slate-600 text-white'}`}>
             {reservation.tableNumber || '?'}
           </div>
           <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Tafel</span>
        </div>
      </div>

      {/* Action Area */}
      {isArrived ? (
        <div className="w-full py-3 bg-emerald-900/10 border border-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-500 font-bold text-sm uppercase tracking-widest">
          <CheckCircle2 size={16} className="mr-2" /> Aanwezig
        </div>
      ) : (
        <button 
          onClick={(e) => { e.stopPropagation(); onCheckIn(); }}
          className="w-full h-14 bg-emerald-600 active:bg-emerald-700 rounded-xl text-white font-bold text-lg shadow-[0_4px_0_0_#065f46] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center"
        >
          INCHECKEN
        </button>
      )}
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

  // --- PROCESSING ---
  const { guestList, stats } = useMemo(() => {
    const daily = reservations.filter(r => 
        r.date === selectedDate && 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.NOSHOW &&
        r.status !== BookingStatus.ARCHIVED
    );

    // Sort: Arrived at bottom, then by name
    const sorted = daily.sort((a, b) => {
        if (a.status === BookingStatus.ARRIVED && b.status !== BookingStatus.ARRIVED) return 1;
        if (a.status !== BookingStatus.ARRIVED && b.status === BookingStatus.ARRIVED) return -1;
        return a.customer.lastName.localeCompare(b.customer.lastName);
    });

    const mapped: HostReservation[] = sorted.map((res, index) => ({
      id: res.id,
      customerId: res.customerId,
      customerName: `${res.customer.firstName} ${res.customer.lastName}`,
      partySize: res.partySize,
      time: res.startTime || '19:30',
      status: res.status,
      // Simple table logic: index based for demo, in real app this is stored
      tableNumber: index + 1, 
      packageType: res.packageType,
      notes: res.notes,
      tags: res.tags || [],
      createdAt: res.createdAt,
      arrived: res.status === BookingStatus.ARRIVED
    }));

    // Search Filter
    const filtered = mapped.filter(r => 
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return {
      guestList: filtered,
      stats: {
        total: mapped.reduce((s, r) => s + r.partySize, 0),
        arrived: mapped.filter(r => r.status === BookingStatus.ARRIVED).reduce((s, r) => s + r.partySize, 0)
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
  
  const handleLock = () => {
    setPinInput('');
    setPinError(false);
    setIsLocked(true);
  };

  const handlePinEntry = (num: string) => {
    if (pinError) return;
    
    const nextPin = pinInput + num;
    setPinInput(nextPin);

    if (nextPin.length === 4) {
      if (nextPin === '0000') {
        // SUCCESS
        setIsLocked(false);
        setPinInput('');
      } else {
        // ERROR
        setPinError(true);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 600);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans overflow-hidden">
      
      {/* 1. APP HEADER (Sticky) */}
      <div className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 pt-safe-top pb-3 px-4 z-20 shrink-0">
         <div className="flex justify-between items-center mb-4 pt-2">
            <div>
              <h1 className="text-xl font-serif text-white font-bold">Host Mode</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleLock}
                className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="Vergrendel Scherm"
              >
                <Lock size={18} />
              </button>
              <button 
                onClick={() => setShowScanner(true)}
                className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <Scan size={20} />
              </button>
              <button 
                onClick={() => navigate('/admin', { replace: true })}
                className="h-10 px-4 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs uppercase tracking-wider"
                title="Sluit Host Mode en ga naar Dashboard"
              >
                <LayoutDashboard size={16} className="mr-2" /> Admin
              </button>
            </div>
         </div>

         {/* Search Bar */}
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              className="w-full h-12 bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-all text-lg"
              placeholder="Zoek gast..."
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

      {/* 2. GUEST LIST (Scrollable) */}
      <div className="flex-grow overflow-y-auto p-4 pb-32 space-y-4 custom-scrollbar">
         {guestList.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-slate-500">
             <Users size={48} className="mb-4 opacity-20" />
             <p className="text-sm">Geen gasten gevonden.</p>
           </div>
         ) : (
           guestList.map(guest => (
             <GuestCard 
               key={guest.id} 
               reservation={guest} 
               onCheckIn={() => handleCheckIn(guest.id)} 
               onDetails={() => setSelectedGuest(guest)}
             />
           ))
         )}
      </div>

      {/* 3. STATUS BAR (Sticky Bottom) */}
      <div className="bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 pb-safe-bottom z-20 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <div className="flex justify-between items-center max-w-md mx-auto">
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Aanwezig</span>
               <div className="flex items-baseline space-x-1">
                 <span className="text-3xl font-black text-white">{stats.arrived}</span>
                 <span className="text-lg text-slate-500 font-medium">/ {stats.total}</span>
               </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden ml-6">
               <div 
                 className={`h-full transition-all duration-500 ${stats.arrived >= stats.total ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                 style={{ width: `${stats.total > 0 ? (stats.arrived / stats.total) * 100 : 0}%` }}
               />
            </div>
         </div>
      </div>

      {/* 4. DETAIL MODAL */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in">
           <div className="bg-slate-950 w-full max-w-lg rounded-t-3xl border-t border-slate-800 p-6 pb-safe-bottom shadow-2xl animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6" />
              
              <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-white">{selectedGuest.customerName}</h2>
                   <p className="text-slate-500 text-sm font-mono mt-1">{selectedGuest.id}</p>
                 </div>
                 <button onClick={() => setSelectedGuest(null)} className="p-2 bg-slate-900 rounded-full text-white"><X size={20}/></button>
              </div>

              <div className="space-y-4 mb-8">
                 {selectedGuest.notes.dietary && (
                   <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start text-red-200">
                      <AlertCircle size={20} className="text-red-500 mr-3 mt-0.5 shrink-0" />
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

      {/* SCANNER */}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onCheckIn={handleScanSuccess} />}

      {/* LOCK SCREEN OVERLAY */}
      {isLocked && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center backdrop-blur-xl animate-in fade-in duration-300">
           <div className="mb-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-800 shadow-2xl mb-4">
                 <Lock size={32} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-serif text-white mb-2">Host View Vergrendeld</h2>
              <p className="text-slate-500 text-sm uppercase tracking-widest">Voer pincode in om verder te gaan</p>
           </div>

           <div className="space-y-8 w-full max-w-xs">
              {/* Dot Indicators */}
              <div className="flex justify-center space-x-4 mb-4 h-4">
                 {[0, 1, 2, 3].map(idx => (
                   <div 
                     key={idx} 
                     className={`w-3 h-3 rounded-full transition-all duration-300 ${
                       idx < pinInput.length 
                         ? (pinError ? 'bg-red-500 scale-125' : 'bg-amber-500 scale-110') 
                         : 'bg-slate-800'
                     }`} 
                   />
                 ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-4">
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                   <button 
                     key={num} 
                     onClick={() => handlePinEntry(num.toString())}
                     className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 hover:border-slate-600 hover:scale-105 active:scale-95 transition-all mx-auto flex items-center justify-center shadow-lg"
                   >
                     {num}
                   </button>
                 ))}
                 <div /> {/* Spacer */}
                 <button 
                   onClick={() => handlePinEntry('0')}
                   className="h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-bold hover:bg-slate-800 hover:border-slate-600 hover:scale-105 active:scale-95 transition-all mx-auto flex items-center justify-center shadow-lg"
                   >
                   0
                 </button>
                 <button 
                   onClick={handleBackspace}
                   className="h-16 w-16 rounded-full bg-transparent text-slate-500 hover:text-white flex items-center justify-center transition-colors mx-auto"
                 >
                   <Delete size={24} />
                 </button>
              </div>
              
              <div className="text-center pt-8">
                 <p className="text-slate-600 text-xs">Standaard PIN: 0000</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

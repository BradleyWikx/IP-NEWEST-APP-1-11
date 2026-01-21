import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Utensils, AlertCircle, CheckCircle2, 
  Search, Scan, X, ChevronRight, PartyPopper, 
  LayoutDashboard, Lock, Wallet, CreditCard, List, WifiOff,
  Maximize, Minimize, RotateCcw, Plus, Calendar, Clock, Star, AlertTriangle,
  Filter, Check
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { BookingStatus, Reservation } from '../../types';
import { bookingRepo } from '../../utils/storage';
import { ScannerModal } from './ScannerModal';
import { undoManager } from '../../utils/undoManager';
import { formatGuestName } from '../../utils/formatters';
import { useOfflineData } from '../../hooks/useOfflineData';
import { useIsMobile } from '../../hooks/useMediaQuery';

// --- TYPES ---

interface HostReservation {
  id: string;
  customerName: string;
  partySize: number;
  status: BookingStatus;
  time: string;
  notes: {
    dietary: string;
    isCelebrating: boolean;
    celebrationText?: string;
    comments?: string;
  };
  hasVoucher: boolean;
  outstandingBalance: number;
  isPremium: boolean;
  tableId?: string;
  arrived: boolean;
}

// --- SUB-COMPONENT: GUEST CARD (List Version) ---

interface GuestCardProps {
  reservation: HostReservation;
  onCheckIn: () => void;
  onClick: () => void;
}

const GuestCard: React.FC<GuestCardProps> = ({ 
  reservation, 
  onCheckIn, 
  onClick 
}) => {
  const isArrived = reservation.status === BookingStatus.ARRIVED;
  
  // Parse table number from ID (e.g. "TAB-12" -> "12")
  const tableDisplay = reservation.tableId ? reservation.tableId.replace('TAB-', '') : '-';

  return (
    <div 
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none group flex items-center justify-between
        ${isArrived 
          ? 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-80' 
          : 'bg-slate-900 border-slate-700 hover:border-amber-500 hover:shadow-lg active:scale-[0.99]'}
      `}
    >
      {/* Left: Info */}
      <div className="flex-grow min-w-0 pr-4">
        <div className="flex items-center space-x-3 mb-1">
            {/* Status Dot */}
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isArrived ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
            
            <h3 className={`font-bold text-lg leading-tight truncate ${isArrived ? 'text-slate-400' : 'text-white'}`}>
                {reservation.customerName}
            </h3>
            
            {reservation.isPremium && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
        </div>

        <div className="flex items-center space-x-4 text-sm text-slate-400">
            <span className="flex items-center bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-xs">
                <Users size={12} className="mr-1.5"/> {reservation.partySize}
            </span>
            <span className="flex items-center font-mono text-xs">
                <Clock size={12} className="mr-1.5"/> {reservation.time}
            </span>
            
            {/* Alert Icons */}
            <div className="flex space-x-2 pl-2 border-l border-slate-800">
                {reservation.notes.dietary && <Utensils size={14} className="text-red-400" />}
                {reservation.notes.isCelebrating && <PartyPopper size={14} className="text-purple-400" />}
                {reservation.outstandingBalance > 0.01 && <CreditCard size={14} className="text-red-500" />}
            </div>
        </div>
      </div>

      {/* Right: Table & Action */}
      <div className="flex items-center space-x-4">
         {/* Table Number Display */}
         <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-[9px] text-slate-500 font-bold uppercase">Tafel</span>
            <span className={`text-xl font-black ${reservation.tableId ? 'text-white' : 'text-slate-600'}`}>{tableDisplay}</span>
         </div>

         {/* Quick Action Button (Stop propagation to prevent card open) */}
         {!isArrived && (
             <button 
                onClick={(e) => { e.stopPropagation(); onCheckIn(); }}
                className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
             >
                <Check size={24} />
             </button>
         )}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export const HostView = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<HostReservation | null>(null);
  
  // Data
  const { isOnline, data: reservations, refresh } = useOfflineData();

  // --- PROCESSED LIST ---
  const { guestList, stats } = useMemo(() => {
    // Filter
    const dailyRaw = reservations.filter(r => 
        r.date === selectedDate && 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.NOSHOW &&
        r.status !== BookingStatus.ARCHIVED
    );

    // Map
    const enrichedList: HostReservation[] = dailyRaw.map(res => ({
      id: res.id,
      customerName: formatGuestName(res.customer.firstName, res.customer.lastName),
      partySize: res.partySize,
      tableId: res.tableId,
      time: res.startTime || '19:30',
      status: res.status,
      isPremium: res.packageType === 'premium',
      notes: {
        dietary: res.notes.dietary || '',
        isCelebrating: !!res.notes.isCelebrating,
        celebrationText: res.notes.celebrationText,
        comments: res.notes.comments
      },
      hasVoucher: !!res.financials.voucherCode,
      outstandingBalance: res.financials.finalTotal - (res.financials.paid || 0),
      arrived: res.status === BookingStatus.ARRIVED
    }));

    // Filter & Sort
    const filtered = enrichedList.filter(r => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return r.customerName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.tableId && r.tableId.includes(q));
    }).sort((a, b) => {
        if (a.arrived !== b.arrived) return a.arrived ? 1 : -1; // Arrived at bottom
        return a.time.localeCompare(b.time); // Time asc
    });

    return {
      guestList: filtered,
      stats: {
        total: enrichedList.reduce((s, r) => s + r.partySize, 0),
        arrived: enrichedList.filter(r => r.arrived).reduce((s, r) => s + r.partySize, 0),
        count: enrichedList.length,
        arrivedCount: enrichedList.filter(r => r.arrived).length
      }
    };
  }, [reservations, selectedDate, searchTerm]);

  // --- ACTIONS ---

  const handleCheckIn = (id: string) => {
    bookingRepo.update(id, (r) => ({ ...r, status: BookingStatus.ARRIVED }));
    undoManager.showSuccess("Gast binnengemeld");
    refresh();
  };

  const handleUndoCheckIn = (id: string) => {
    bookingRepo.update(id, (r) => ({ ...r, status: BookingStatus.CONFIRMED }));
    undoManager.showSuccess("Inchecken ongedaan gemaakt");
    refresh();
  };

  const handleWalkIn = () => {
    const newId = `WALK-${Date.now()}`;
    const newRes: Reservation = {
        id: newId,
        createdAt: new Date().toISOString(),
        customerId: `CUST-${Date.now()}`,
        customer: { id: `CUST-${Date.now()}`, firstName: 'Walk-in', lastName: 'Gast', email: '', phone: '' },
        date: selectedDate,
        showId: 'show-wonderland', // Default fallback
        status: BookingStatus.ARRIVED,
        partySize: 2,
        packageType: 'standard',
        addons: [], merchandise: [],
        financials: { total: 0, subtotal: 0, discount: 0, finalTotal: 0, paid: 0, isPaid: false },
        notes: { internal: 'Walk-in aan de deur' },
        startTime: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    bookingRepo.add(newRes);
    refresh();
    setSelectedGuest({ ...newRes } as any); // Open detail for immediate editing
  };

  const handleTableAssign = (tableNumber: string) => {
      if (selectedGuest) {
          bookingRepo.update(selectedGuest.id, (r) => ({ ...r, tableId: `TAB-${tableNumber}` }));
          refresh();
          // Update local state to reflect immediately
          setSelectedGuest(prev => prev ? ({ ...prev, tableId: `TAB-${tableNumber}` }) : null);
      }
  };

  // --- RENDER ---

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP BAR */}
      <div className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center space-x-4">
            <div className="flex flex-col">
               <h1 className="text-white font-bold text-lg leading-none">Host Mode</h1>
               <span className="text-[10px] text-slate-500 uppercase tracking-widest">{new Date(selectedDate).toLocaleDateString()}</span>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center space-x-3 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
               <div className="flex flex-col items-center leading-none px-2 border-r border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Gasten</span>
                  <span className="text-sm font-bold text-white">{stats.arrived} / {stats.total}</span>
               </div>
               <div className="flex flex-col items-center leading-none px-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Groepen</span>
                  <span className="text-sm font-bold text-white">{stats.arrivedCount} / {stats.count}</span>
               </div>
            </div>
         </div>

         <div className="flex items-center space-x-2">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
               <input 
                 className="w-40 md:w-64 bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs text-white focus:border-amber-500 outline-none transition-all"
                 placeholder="Zoek gast of tafel..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
               {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X size={12}/></button>}
            </div>

            <button onClick={handleWalkIn} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg">
               <Plus size={20} />
            </button>
            
            <button onClick={() => setShowScanner(true)} className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-full shadow-lg">
               <Scan size={20} />
            </button>

            <button onClick={() => navigate('/admin')} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full ml-2">
               <LayoutDashboard size={20} />
            </button>
         </div>
      </div>

      {/* 2. MAIN LIST CONTENT */}
      <div className="flex-grow bg-black relative overflow-y-auto custom-scrollbar p-4">
         <div className="max-w-5xl mx-auto space-y-3">
            {guestList.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <p className="text-lg mb-2">Geen gasten gevonden.</p>
                    <p className="text-xs">Controleer de datum of zoekterm.</p>
                </div>
            ) : (
                guestList.map(guest => (
                    <GuestCard 
                        key={guest.id} 
                        reservation={guest} 
                        onCheckIn={() => handleCheckIn(guest.id)} 
                        onClick={() => setSelectedGuest(guest)}
                    />
                ))
            )}
            
            {/* Bottom padding for mobile scrolling */}
            <div className="h-20" />
         </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-slate-950 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                 <div>
                    <h2 className="text-2xl font-serif text-white">{selectedGuest.customerName}</h2>
                    <div className="flex items-center space-x-2 text-sm text-slate-400 mt-1">
                       <span className="font-mono">{selectedGuest.id}</span>
                       <span>•</span>
                       <span>{selectedGuest.partySize} Personen</span>
                    </div>
                 </div>
                 <button onClick={() => setSelectedGuest(null)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white">
                    <X size={20} />
                 </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                 {/* Table Assignment Input */}
                 <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Tafelnummer</p>
                        <p className="text-sm text-slate-400">Huidig: <span className="text-white font-bold">{selectedGuest.tableId ? selectedGuest.tableId.replace('TAB-', '') : 'Geen'}</span></p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Input 
                            className="w-20 text-center font-bold text-lg h-10" 
                            placeholder="#"
                            defaultValue={selectedGuest.tableId ? selectedGuest.tableId.replace('TAB-', '') : ''}
                            onBlur={(e: any) => handleTableAssign(e.target.value)}
                            onKeyDown={(e: any) => { if(e.key === 'Enter') handleTableAssign(e.target.value) }}
                        />
                    </div>
                 </div>

                 {/* Status Badges */}
                 <div className="flex flex-wrap gap-2">
                    <Badge status={selectedGuest.status}>{selectedGuest.status}</Badge>
                    {selectedGuest.isPremium && <span className="bg-amber-900/30 text-amber-500 px-2 py-1 rounded text-xs font-bold border border-amber-900/50">PREMIUM</span>}
                    {selectedGuest.hasVoucher && <span className="bg-purple-900/30 text-purple-400 px-2 py-1 rounded text-xs font-bold border border-purple-900/50">VOUCHER</span>}
                 </div>

                 {/* Alerts */}
                 {selectedGuest.notes.dietary && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start text-red-200">
                       <Utensils size={20} className="mr-3 text-red-500 mt-0.5" />
                       <div>
                          <h4 className="font-bold text-sm uppercase text-red-400 mb-1">Dieetwensen</h4>
                          <p className="text-sm">{selectedGuest.notes.dietary}</p>
                       </div>
                    </div>
                 )}

                 {selectedGuest.notes.isCelebrating && (
                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-start text-blue-200">
                       <PartyPopper size={20} className="mr-3 text-blue-500 mt-0.5" />
                       <div>
                          <h4 className="font-bold text-sm uppercase text-blue-400 mb-1">Viering</h4>
                          <p className="text-sm">{selectedGuest.notes.celebrationText || 'Iets te vieren'}</p>
                       </div>
                    </div>
                 )}

                 {/* Payment */}
                 <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-400">Openstaand Saldo</span>
                    <span className={`text-xl font-mono font-bold ${selectedGuest.outstandingBalance > 0.01 ? 'text-red-500' : 'text-emerald-500'}`}>
                       €{selectedGuest.outstandingBalance.toFixed(2)}
                    </span>
                 </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-3">
                 {!selectedGuest.arrived ? (
                    <Button onClick={() => { handleCheckIn(selectedGuest.id); setSelectedGuest(null); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 font-bold text-lg shadow-lg shadow-emerald-900/20">
                       <CheckCircle2 size={20} className="mr-2" /> Check In
                    </Button>
                 ) : (
                    <Button onClick={() => { handleUndoCheckIn(selectedGuest.id); setSelectedGuest(null); }} variant="secondary" className="flex-1 h-12">
                       <RotateCcw size={18} className="mr-2" /> Undo Check-in
                    </Button>
                 )}
              </div>
           </div>
        </div>
      )}

      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onCheckIn={(r) => { handleCheckIn(r.id); setShowScanner(false); }} />}

    </div>
  );
};
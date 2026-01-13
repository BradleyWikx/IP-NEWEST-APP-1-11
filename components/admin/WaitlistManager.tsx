
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Check, X, ArrowRight, UserPlus, AlertTriangle, 
  RotateCcw, Calendar, Users, ArrowLeftRight, CheckCircle2,
  AlertCircle, Search, Mail
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer } from '../UI';
import { WaitlistEntry, Reservation, BookingStatus, CalendarEvent } from '../../types';
import { waitlistRepo, bookingRepo, getShows, calendarRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';

// --- Types ---

interface DateGroup {
  date: string;
  showName: string;
  event: CalendarEvent | undefined;
  waitlist: WaitlistEntry[];
  cancelled: Reservation[];
  matchPossible: boolean; // True if we have both waitlist AND cancellations
  totalWaitlistPax: number;
  totalCancelledPax: number;
}

interface MatchSuggestion {
    waitlistEntry: WaitlistEntry;
    cancelledSlot: Reservation;
    fitScore: number; // For sorting best matches
}

export const WaitlistManager = () => {
  const [groupedData, setGroupedData] = useState<DateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DateGroup | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // --- DATA LOADING & GROUPING ---

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    const allWaitlist = waitlistRepo.getAll().filter(w => w.status === 'PENDING');
    const allReservations = bookingRepo.getAll(); // We need all to find CANCELLED
    const allEvents = calendarRepo.getAll();
    const shows = getShows();

    // 1. Identify all relevant dates (those with waitlist OR cancellations)
    const dates = new Set<string>();
    allWaitlist.forEach(w => dates.add(w.date));
    
    // Filter cancellations relevant for filling spots (active dates only ideally, but let's take all future)
    const today = new Date().toISOString().split('T')[0];
    const cancellations = allReservations.filter(r => 
      r.status === BookingStatus.CANCELLED && 
      r.date >= today
    );
    cancellations.forEach(r => dates.add(r.date));

    // 2. Build Groups
    const groups: DateGroup[] = [];

    dates.forEach(date => {
      const event = allEvents.find(e => e.date === date);
      let showName = 'Geen Show';
      if (event && event.type === 'SHOW') {
         const s = shows.find(def => def.id === (event as any).showId);
         showName = s ? s.name : 'Onbekende Show';
      } else if (event) {
         showName = event.title;
      }

      const wlItems = allWaitlist.filter(w => w.date === date);
      const cxItems = cancellations.filter(r => r.date === date);

      // Only add if there is actionable data
      if (wlItems.length > 0 || cxItems.length > 0) {
        groups.push({
          date,
          showName,
          event,
          waitlist: wlItems.sort((a,b) => new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime()), // Oldest first
          cancelled: cxItems.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), // Newest first
          matchPossible: wlItems.length > 0 && cxItems.length > 0,
          totalWaitlistPax: wlItems.reduce((s, w) => s + w.partySize, 0),
          totalCancelledPax: cxItems.reduce((s, r) => s + r.partySize, 0),
        });
      }
    });

    setGroupedData(groups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    
    // Refresh selected group if open
    if (selectedGroup) {
        const freshGroup = groups.find(g => g.date === selectedGroup.date);
        setSelectedGroup(freshGroup || null);
    }
  };

  // --- ACTIONS: CONVERT WAITLIST ---

  const handleConvert = (entry: WaitlistEntry, group: DateGroup) => {
    setIsProcessing(true);

    // 1. Resolve Pricing
    const show = getShows().find(s => s.id === (group.event as any)?.showId);
    if (!group.event || !show) {
        alert("Kan event data niet vinden. Controleer planning.");
        setIsProcessing(false);
        return;
    }

    const pricing = getEffectivePricing(group.event as any, show);
    const totals = calculateBookingTotals({
        totalGuests: entry.partySize,
        packageType: 'standard', // Default
        addons: [],
        merchandise: [],
        date: entry.date,
        showId: show.id
    }, pricing);

    // 2. Create Reservation
    const newReservation: Reservation = {
      id: `RES-WL-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerId: entry.customerId,
      customer: {
        id: entry.customerId,
        firstName: entry.contactName.split(' ')[0],
        lastName: entry.contactName.split(' ').slice(1).join(' ') || 'Gast',
        email: entry.contactEmail,
        phone: entry.contactPhone || ''
      },
      date: entry.date,
      showId: show.id,
      status: BookingStatus.CONFIRMED, // Direct confirm
      partySize: entry.partySize,
      packageType: 'standard', 
      addons: [],
      merchandise: [],
      financials: { 
          total: totals.subtotal,
          subtotal: totals.subtotal,
          discount: 0,
          finalTotal: totals.amountDue,
          paid: 0, 
          isPaid: false,
          paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString()
      },
      notes: { 
          internal: `Geconverteerd vanuit Wachtlijst (Ref: ${entry.id}).` 
      },
      startTime: group.event.times.start
    };

    bookingRepo.add(newReservation);
    waitlistRepo.delete(entry.id);

    logAuditAction('CONVERT_WAITLIST', 'RESERVATION', newReservation.id, {
        description: `Converted waitlist entry to reservation. Matched against cancellations.`
    });

    triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: newReservation.id, data: newReservation });

    undoManager.showSuccess(`Wachtende geplaatst! Bevestiging verstuurd.`);
    refreshData();
    setIsProcessing(false);
  };

  // --- ACTIONS: MATCH LOGIC ---
  const findMatches = () => {
    const matches: MatchSuggestion[] = [];
    
    groupedData.forEach(group => {
        if (!group.matchPossible) return;
        
        group.waitlist.forEach(wl => {
            // Find cancelled slot with exact or similar size
            const exactMatch = group.cancelled.find(cx => cx.partySize === wl.partySize);
            const closeMatch = group.cancelled.find(cx => cx.partySize >= wl.partySize);
            
            if (exactMatch) {
                matches.push({ waitlistEntry: wl, cancelledSlot: exactMatch, fitScore: 100 });
            } else if (closeMatch) {
                matches.push({ waitlistEntry: wl, cancelledSlot: closeMatch, fitScore: 80 }); // Good but wasted space
            }
        });
    });
    
    // Dedup and sort
    const uniqueMatches = matches.filter((v,i,a) => a.findIndex(t => t.waitlistEntry.id === v.waitlistEntry.id) === i);
    setSuggestions(uniqueMatches.sort((a,b) => b.fitScore - a.fitScore));
    setShowSuggestions(true);
  };

  const handleSuggestionAction = (suggestion: MatchSuggestion) => {
    // Navigate to group detail
    const group = groupedData.find(g => g.date === suggestion.waitlistEntry.date);
    if(group) {
        setSelectedGroup(group);
        setShowSuggestions(false);
    }
  };

  // --- ACTIONS: RESTORE CANCELLATION ---
  const handleRestore = (reservation: Reservation) => {
    if (!confirm("Weet je zeker dat je deze annulering wilt herstellen naar BEVESTIGD?")) return;
    
    bookingRepo.update(reservation.id, (r) => ({ ...r, status: BookingStatus.CONFIRMED }));
    
    logAuditAction('RESTORE_BOOKING', 'RESERVATION', reservation.id, {
        description: `Restored cancelled booking via Capacity Matchmaker.`
    });

    triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: reservation.id, data: { ...reservation, status: BookingStatus.CONFIRMED } });
    
    undoManager.showSuccess("Boeking hersteld.");
    refreshData();
  };

  // --- RENDER ---

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Capacity Matchmaker</h2>
          <p className="text-slate-500 text-sm">Beheer uitval en vul gaten op met de wachtlijst.</p>
        </div>
        <Button onClick={findMatches} variant="secondary" className="flex items-center">
            <Search size={18} className="mr-2"/> Zoek Matches
        </Button>
      </div>

      {groupedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 text-slate-500">
           <CheckCircle2 size={48} className="mb-4 opacity-50" />
           <p className="text-lg font-bold">Alles is rustig</p>
           <p className="text-sm">Geen openstaande wachtlijst items of recente annuleringen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {groupedData.map(group => (
             <div 
               key={group.date}
               onClick={() => setSelectedGroup(group)}
               className={`
                 relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 group hover:-translate-y-1
                 ${group.matchPossible 
                    ? 'bg-emerald-900/10 border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'}
               `}
             >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                   <div>
                     <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{group.showName}</p>
                     <h3 className="text-xl font-serif font-bold text-white flex items-center">
                       {new Date(group.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })}
                     </h3>
                   </div>
                   {group.matchPossible && (
                     <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg animate-pulse">
                        <ArrowLeftRight size={16} />
                     </div>
                   )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex items-center text-amber-500 mb-1">
                         <Clock size={14} className="mr-1.5"/> 
                         <span className="text-xs font-bold uppercase">Wachtlijst</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{group.waitlist.length}</p>
                      <p className="text-[10px] text-slate-400">{group.totalWaitlistPax} personen</p>
                   </div>
                   <div className="p-3 bg-black/30 rounded-xl border border-white/5">
                      <div className="flex items-center text-red-500 mb-1">
                         <X size={14} className="mr-1.5"/> 
                         <span className="text-xs font-bold uppercase">Uitval</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{group.cancelled.length}</p>
                      <p className="text-[10px] text-slate-400">{group.totalCancelledPax} personen</p>
                   </div>
                </div>

                {/* Action Hint */}
                <div className={`mt-4 pt-3 border-t text-xs font-bold flex items-center ${group.matchPossible ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-800 text-slate-500'}`}>
                   {group.matchPossible ? (
                     <>Match Mogelijk! Klik om te verwerken <ArrowRight size={12} className="ml-auto" /></>
                   ) : (
                     <>Details bekijken <ArrowRight size={12} className="ml-auto" /></>
                   )}
                </div>
             </div>
           ))}
        </div>
      )}

      {/* DETAIL DRAWER */}
      <ResponsiveDrawer
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup ? `Details ${new Date(selectedGroup.date).toLocaleDateString()}` : 'Details'}
        widthClass="md:w-[900px]"
      >
        {selectedGroup && (
          <div className="h-full flex flex-col space-y-6 pb-12">
             
             {/* Header Info */}
             <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                <div>
                   <h4 className="text-white font-bold">{selectedGroup.showName}</h4>
                   <div className="flex items-center text-xs text-slate-400 space-x-3 mt-1">
                      <span className="flex items-center"><Calendar size={12} className="mr-1"/> {selectedGroup.date}</span>
                      <span className="flex items-center"><Users size={12} className="mr-1"/> {selectedGroup.totalWaitlistPax} Wachtend / {selectedGroup.totalCancelledPax} Vrijgekomen</span>
                   </div>
                </div>
                {selectedGroup.matchPossible && (
                  <Badge status="CONFIRMED" className="bg-emerald-900/20 text-emerald-500 border-emerald-500/50 px-3 py-1.5">
                    <ArrowLeftRight size={14} className="mr-2 inline" />
                    Directe Match Mogelijk
                  </Badge>
                )}
             </div>

             {/* Two Columns */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
                
                {/* LEFT: WAITLIST */}
                <div className="flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                   <div className="p-4 border-b border-slate-800 bg-amber-900/10 flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 flex items-center">
                        <Clock size={16} className="mr-2"/> Wachtlijst ({selectedGroup.waitlist.length})
                      </h4>
                   </div>
                   <div className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {selectedGroup.waitlist.map(w => (
                        <div key={w.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col space-y-2 group hover:border-amber-500/50 transition-colors">
                           <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-white">{w.contactName}</p>
                                <p className="text-xs text-slate-500">Sinds: {new Date(w.requestDate).toLocaleDateString()}</p>
                              </div>
                              <span className="bg-slate-800 text-white font-bold text-xs px-2 py-1 rounded border border-slate-700">
                                {w.partySize}p
                              </span>
                           </div>
                           
                           {/* Match Action */}
                           <Button 
                             onClick={() => handleConvert(w, selectedGroup)} 
                             disabled={isProcessing}
                             className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none flex items-center justify-center shadow-lg"
                           >
                             <UserPlus size={14} className="mr-2" /> Plaatsen (Boek)
                           </Button>
                        </div>
                      ))}
                      {selectedGroup.waitlist.length === 0 && (
                        <p className="text-center text-slate-500 text-xs py-8">Geen wachtenden.</p>
                      )}
                   </div>
                </div>

                {/* RIGHT: CANCELLATIONS */}
                <div className="flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                   <div className="p-4 border-b border-slate-800 bg-red-900/10 flex justify-between items-center">
                      <h4 className="font-bold text-red-500 flex items-center">
                        <X size={16} className="mr-2"/> Annuleringen ({selectedGroup.cancelled.length})
                      </h4>
                   </div>
                   <div className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {selectedGroup.cancelled.map(r => (
                        <div key={r.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col space-y-2 opacity-75 hover:opacity-100 transition-opacity">
                           <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-slate-300 line-through decoration-red-500">{r.customer.lastName}</p>
                                <p className="text-xs text-slate-500">Geannuleerd op {new Date().toLocaleDateString()}</p> 
                              </div>
                              <span className="bg-red-900/20 text-red-400 font-bold text-xs px-2 py-1 rounded border border-red-900/50">
                                {r.partySize}p
                              </span>
                           </div>

                           <Button 
                             variant="secondary"
                             onClick={() => handleRestore(r)} 
                             className="w-full h-8 text-xs flex items-center justify-center border-slate-700 hover:bg-slate-800"
                           >
                             <RotateCcw size={14} className="mr-2" /> Herstel Boeking
                           </Button>
                        </div>
                      ))}
                      {selectedGroup.cancelled.length === 0 && (
                        <p className="text-center text-slate-500 text-xs py-8">Geen recente annuleringen.</p>
                      )}
                   </div>
                </div>

             </div>

             <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex items-start space-x-3 text-xs text-blue-200">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>
                  <strong>Tip:</strong> Gebruik deze module om snel gaten in de planning te vullen. 
                  Het omzetten van een wachtlijst-item negeert de reguliere capaciteitslimieten ("Admin Override"), 
                  zodat je vrijgekomen plekken direct kunt benutten.
                </p>
             </div>

          </div>
        )}
      </ResponsiveDrawer>

      {/* SUGGESTION MODAL */}
      <ResponsiveDrawer
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        title="Slimme Suggesties"
      >
         <div className="space-y-4">
             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                 <p className="text-sm text-slate-400">Er zijn <strong>{suggestions.length}</strong> mogelijke matches gevonden waarbij een vrijgekomen plek past bij een wachtende groep.</p>
             </div>
             
             {suggestions.map((s, idx) => (
                 <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                     <div>
                         <p className="font-bold text-white text-sm">{new Date(s.waitlistEntry.date).toLocaleDateString()}</p>
                         <div className="flex items-center space-x-2 mt-1">
                             <span className="text-xs text-amber-500">{s.waitlistEntry.contactName} ({s.waitlistEntry.partySize}p)</span>
                             <ArrowRight size={12} className="text-slate-600" />
                             <span className="text-xs text-red-500">Vrijgekomen: {s.cancelledSlot.partySize}p</span>
                         </div>
                     </div>
                     <Button onClick={() => handleSuggestionAction(s)} className="text-xs h-8">
                        Bekijk & Match
                     </Button>
                 </div>
             ))}

             {suggestions.length === 0 && (
                 <div className="text-center p-8 text-slate-500">
                     Geen matches gevonden.
                 </div>
             )}
         </div>
      </ResponsiveDrawer>
    </div>
  );
};

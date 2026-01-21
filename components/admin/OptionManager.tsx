
import React, { useState, useMemo } from 'react';
import { AlertCircle, Clock, CheckCircle2, X, Phone, Mail, Calendar, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button, Badge, Card, Input } from '../UI';
import { Reservation, BookingStatus } from '../../types';
import { bookingRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { calculateTimeRemaining } from '../../utils/dateHelpers';
import { undoManager } from '../../utils/undoManager';
import { formatGuestName } from '../../utils/formatters';

export const OptionManager = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [showAllDates, setShowAllDates] = useState(true);
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'CONFIRM' | 'CANCEL', id: string } | null>(null);
  const [sendEmail, setSendEmail] = useState(true);

  React.useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setReservations(bookingRepo.getAll().filter(r => r.status === BookingStatus.OPTION));
  };

  // --- UI TRIGGERS ---

  const initiateAction = (type: 'CONFIRM' | 'CANCEL', id: string) => {
      setConfirmModal({ isOpen: true, type, id });
      setSendEmail(true); // Default checked
  };

  const handleExecute = () => {
    if (!confirmModal) return;
    const { type, id } = confirmModal;

    if (type === 'CONFIRM') {
        const r = reservations.find(res => res.id === id);
        const updated = bookingRepo.getAll().map(r => r.id === id ? { ...r, status: BookingStatus.CONFIRMED } : r);
        saveData(STORAGE_KEYS.RESERVATIONS, updated);
        logAuditAction('CONFIRM_OPTION', 'RESERVATION', id, { description: 'Confirmed from Option Manager' });
        
        if(r && sendEmail) triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: { ...r, status: BookingStatus.CONFIRMED } });
        
        undoManager.showSuccess('Optie bevestigd');
    } else {
        const r = reservations.find(res => res.id === id);
        const updated = bookingRepo.getAll().map(r => r.id === id ? { ...r, status: BookingStatus.CANCELLED, cancellationReason: 'Optie verlopen/geannuleerd via beheer' } : r);
        saveData(STORAGE_KEYS.RESERVATIONS, updated);
        logAuditAction('CANCEL_OPTION', 'RESERVATION', id, { description: 'Cancelled from Option Manager' });
        
        if(r && sendEmail) triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: { ...r, status: BookingStatus.CANCELLED } });
        
        undoManager.showSuccess('Optie geannuleerd');
    }

    setConfirmModal(null);
    refreshData();
  };

  const handleEmail = (res: Reservation) => {
    triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: res.id, data: res });
    undoManager.showSuccess(`Herinnering verstuurd naar ${res.customer.email}`);
  };

  // --- FILTERING & SPLITTING ---

  const { expired, active } = useMemo(() => {
    const filtered = reservations.filter(r => {
        if (showAllDates) return true;
        return r.date === filterDate;
    });

    const now = new Date();
    const expiredList: Reservation[] = [];
    const activeList: Reservation[] = [];

    filtered.forEach(r => {
        if (!r.optionExpiresAt) {
            activeList.push(r); // No expiry = active default
            return;
        }
        const exp = new Date(r.optionExpiresAt);
        // Expiry is usually end of day, but let's be strict if it's passed
        if (exp < now) {
            expiredList.push(r);
        } else {
            activeList.push(r);
        }
    });

    return { 
        expired: expiredList.sort((a,b) => new Date(a.optionExpiresAt!).getTime() - new Date(b.optionExpiresAt!).getTime()), // Oldest expiry first
        active: activeList.sort((a,b) => new Date(a.optionExpiresAt!).getTime() - new Date(b.optionExpiresAt!).getTime()) // Soonest expiry first
    };
  }, [reservations, filterDate, showAllDates]);

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h2 className="text-3xl font-serif text-white">Optie Beheer</h2>
            <p className="text-slate-500 text-sm">Overzicht van lopende en verlopen opties.</p>
        </div>
        
        <div className="flex items-center space-x-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button 
                onClick={() => { setShowAllDates(true); setFilterDate(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${showAllDates ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}
            >
                Alle Data
            </button>
            <div className="flex items-center space-x-2 px-2">
                <span className={`text-xs font-bold uppercase ${!showAllDates ? 'text-white' : 'text-slate-500'}`}>Specifiek:</span>
                <input 
                    type="date" 
                    value={filterDate} 
                    onChange={(e) => { setFilterDate(e.target.value); setShowAllDates(false); }}
                    className="bg-black/30 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: EXPIRED OPTIONS */}
          <div className="space-y-4">
              <div className="flex items-center space-x-2 text-red-500 pb-2 border-b border-red-900/30">
                  <AlertCircle size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm">Verlopen Opties ({expired.length})</h3>
              </div>
              
              <div className="space-y-3">
                  {expired.map(res => {
                      const daysOverdue = Math.ceil((new Date().getTime() - new Date(res.optionExpiresAt!).getTime()) / (1000 * 3600 * 24));
                      
                      return (
                          <div key={res.id} className="bg-slate-900/50 border border-red-900/30 rounded-xl p-4 flex flex-col gap-3 group hover:bg-slate-900 transition-colors">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h4 className="font-bold text-white text-sm">{formatGuestName(res.customer.firstName, res.customer.lastName)}</h4>
                                      <p className="text-xs text-slate-500">{res.partySize}p • {new Date(res.date).toLocaleDateString()}</p>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-[10px] font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded border border-red-900/50">
                                          {daysOverdue} dagen te laat
                                      </span>
                                  </div>
                              </div>
                              
                              <div className="flex justify-between items-center pt-2 border-t border-red-900/10">
                                  <div className="flex space-x-2">
                                      <a href={`tel:${res.customer.phone}`} className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white"><Phone size={14}/></a>
                                      <a href={`mailto:${res.customer.email}`} className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white"><Mail size={14}/></a>
                                  </div>
                                  <div className="flex space-x-2">
                                      <Button onClick={() => initiateAction('CANCEL', res.id)} className="h-7 text-[10px] bg-red-900/20 text-red-400 hover:bg-red-900/40 border-none">
                                          Annuleren
                                      </Button>
                                      <Button onClick={() => initiateAction('CONFIRM', res.id)} className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 border-none">
                                          Toch Bevestigen
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                  {expired.length === 0 && <p className="text-slate-500 text-xs italic text-center py-8">Geen verlopen opties.</p>}
              </div>
          </div>

          {/* RIGHT: ACTIVE OPTIONS */}
          <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-500 pb-2 border-b border-emerald-900/30">
                  <Clock size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm">Lopende Opties ({active.length})</h3>
              </div>

              <div className="space-y-3">
                  {active.map(res => {
                      const { label, color } = calculateTimeRemaining(res.optionExpiresAt);
                      const isUrgent = color === 'amber' || color === 'red';

                      return (
                          <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 group hover:border-slate-600 transition-colors">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h4 className="font-bold text-white text-sm">{formatGuestName(res.customer.firstName, res.customer.lastName)}</h4>
                                      <p className="text-xs text-slate-500">{res.partySize}p • {new Date(res.date).toLocaleDateString()}</p>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded border ${isUrgent ? 'text-amber-500 bg-amber-900/20 border-amber-900/50' : 'text-emerald-500 bg-emerald-900/20 border-emerald-900/50'}`}>
                                          {label}
                                      </span>
                                  </div>
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                  <div className="flex space-x-2">
                                      <Button variant="ghost" onClick={() => handleEmail(res)} className="h-7 px-2 text-[10px] text-slate-400">
                                          <Mail size={12} className="mr-1"/> Herinnering
                                      </Button>
                                  </div>
                                  <div className="flex space-x-2">
                                      <button onClick={() => initiateAction('CANCEL', res.id)} className="p-1.5 hover:bg-red-900/20 rounded text-slate-500 hover:text-red-500 transition-colors"><X size={14}/></button>
                                      <Button onClick={() => initiateAction('CONFIRM', res.id)} variant="secondary" className="h-7 text-[10px]">
                                          <CheckCircle2 size={12} className="mr-1"/> Bevestig
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                  {active.length === 0 && <p className="text-slate-500 text-xs italic text-center py-8">Geen lopende opties.</p>}
              </div>
          </div>

      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl">
              <div className="p-6">
                 <h3 className="text-xl font-bold text-white mb-2">Weet je het zeker?</h3>
                 <p className="text-sm text-slate-400 mb-6">
                    Je staat op het punt om de optie te <strong className="text-white uppercase">{confirmModal.type === 'CONFIRM' ? 'bevestigen' : 'annuleren'}</strong>.
                 </p>
                 
                 <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={sendEmail} 
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-blue-600" 
                        />
                        <span className="text-sm text-white">Stuur bevestiging per e-mail</span>
                    </label>
                 </div>

                 <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setConfirmModal(null)} className="flex-1">Annuleren</Button>
                    <Button onClick={handleExecute} className={`flex-1 border-none ${confirmModal.type === 'CONFIRM' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {confirmModal.type === 'CONFIRM' ? 'Bevestigen' : 'Annuleren'}
                    </Button>
                 </div>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};

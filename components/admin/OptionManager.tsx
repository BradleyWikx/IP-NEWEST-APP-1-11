
import React, { useState } from 'react';
import { AlertCircle, Clock, CheckCircle2, X, Phone, Mail } from 'lucide-react';
import { Button, Badge } from '../UI';
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

  React.useEffect(() => {
    setReservations(bookingRepo.getAll().filter(r => r.status === BookingStatus.OPTION));
  }, []);

  const onUpdate = () => {
    setReservations(bookingRepo.getAll().filter(r => r.status === BookingStatus.OPTION));
  };

  const confirmOption = (id: string) => {
    const r = reservations.find(res => res.id === id);
    const updated = bookingRepo.getAll().map(r => r.id === id ? { ...r, status: BookingStatus.CONFIRMED } : r);
    saveData(STORAGE_KEYS.RESERVATIONS, updated);
    logAuditAction('CONFIRM_OPTION', 'RESERVATION', id, { description: 'Confirmed from Option Manager' });
    
    // --- EMAIL TRIGGER ---
    if(r) triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: { ...r, status: BookingStatus.CONFIRMED } });
    
    undoManager.showSuccess('Optie bevestigd');
    onUpdate();
  };

  const cancelOption = (id: string) => {
    const r = reservations.find(res => res.id === id);
    const updated = bookingRepo.getAll().map(r => r.id === id ? { ...r, status: BookingStatus.CANCELLED } : r);
    saveData(STORAGE_KEYS.RESERVATIONS, updated);
    logAuditAction('CANCEL_OPTION', 'RESERVATION', id, { description: 'Cancelled from Option Manager' });
    if(r) triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: { ...r, status: BookingStatus.CANCELLED } });
    undoManager.showSuccess('Optie geannuleerd');
    onUpdate();
  };

  const handleEmail = (res: Reservation) => {
    triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: res.id, data: res });
    undoManager.showSuccess(`Herinnering verstuurd naar ${res.customer.email}`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-serif text-white">Verlopende Opties</h3>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <ResponsiveTable 
          data={reservations}
          keyExtractor={r => r.id}
          columns={[
            { 
              header: 'Klant', 
              accessor: (r: Reservation) => (
                <div>
                  <span className="font-bold text-white block">{formatGuestName(r.customer.firstName, r.customer.lastName)}</span>
                  <span className="text-[10px] text-slate-500">{r.customer.email}</span>
                </div>
              ) 
            },
            { 
              header: 'Datum Event', 
              accessor: (r: Reservation) => (
                <span className="font-mono text-slate-300">{new Date(r.date).toLocaleDateString()}</span>
              ) 
            },
            { 
              header: 'Verloopt Op', 
              accessor: (r: Reservation) => {
                const { label, color, isExpired } = calculateTimeRemaining(r.optionExpiresAt);
                const expiryDate = r.optionExpiresAt ? new Date(r.optionExpiresAt).toLocaleDateString() : 'N/A';
                
                return (
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${isExpired ? 'text-red-500 font-black' : color === 'amber' ? 'text-amber-500' : 'text-slate-400'}`}>
                      {expiryDate}
                    </span>
                    <span className={`text-[10px] ${isExpired ? 'text-red-400' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </div>
                );
              }
            },
            { 
              header: 'Status', 
              accessor: (r: Reservation) => <Badge status="OPTION">OPTIE</Badge> 
            },
            { 
              header: 'Acties', 
              accessor: (res: Reservation) => (
                <div className="flex items-center justify-end space-x-2">
                   {/* Contact Actions */}
                   <a 
                     href={`tel:${res.customer.phone}`} 
                     className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                     title="Bel Klant"
                   >
                     <Phone size={14} />
                   </a>
                   <button 
                     onClick={() => handleEmail(res)} 
                     className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" 
                     title="Stuur Mail"
                   >
                     <Mail size={14} />
                   </button>
                   
                   <div className="w-px h-4 bg-slate-700 mx-2" />

                   {/* Resolution Actions */}
                   <button 
                     onClick={() => confirmOption(res.id)} 
                     className="p-2 rounded bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-500 transition-colors border border-emerald-900/50" 
                     title="Bevestig Optie"
                   >
                     <CheckCircle2 size={14} />
                   </button>
                   <button 
                     onClick={() => cancelOption(res.id)} 
                     className="p-2 rounded bg-red-900/20 hover:bg-red-900/40 text-red-500 transition-colors border border-red-900/50" 
                     title="Annuleer Optie"
                   >
                     <X size={14} />
                   </button>
                </div>
              )
            }
          ]}
          emptyMessage="Geen openstaande opties."
        />
      </div>
    </div>
  );
};

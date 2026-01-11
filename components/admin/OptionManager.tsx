
import React, { useState } from 'react';
import { AlertCircle, Clock, CheckCircle2, X } from 'lucide-react';
import { Button, Badge } from '../UI';
import { Reservation, BookingStatus } from '../../types';
import { bookingRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { calculateTimeRemaining } from '../../utils/dateHelpers';

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
    
    onUpdate();
  };

  const cancelOption = (id: string) => {
    const r = reservations.find(res => res.id === id);
    const updated = bookingRepo.getAll().map(r => r.id === id ? { ...r, status: BookingStatus.CANCELLED } : r);
    saveData(STORAGE_KEYS.RESERVATIONS, updated);
    logAuditAction('CANCEL_OPTION', 'RESERVATION', id, { description: 'Cancelled from Option Manager' });
    if(r) triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: { ...r, status: BookingStatus.CANCELLED } });
    onUpdate();
  };

  const sendReminder = (res: Reservation) => {
    triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: res.id, data: res });
    alert(`Herinnering verstuurd naar ${res.customer.email}`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-serif text-white">Verlopende Opties</h3>
      <ResponsiveTable 
        data={reservations}
        keyExtractor={r => r.id}
        columns={[
          { header: 'Gast', accessor: (r: Reservation) => <span className="font-bold text-white">{r.customer.lastName}</span> },
          { header: 'Verloopt', accessor: (r: Reservation) => {
             const { label, color } = calculateTimeRemaining(r.optionExpiresAt);
             return <Badge status={color === 'red' ? 'CANCELLED' : 'OPTION'}>{label}</Badge>;
          }},
          { header: 'Acties', accessor: (res: Reservation) => (
            <div className="flex space-x-2">
               <button onClick={() => sendReminder(res)} className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-900/20 text-slate-400 hover:text-orange-500 transition-colors" title="Stuur Herinnering">
                 <AlertCircle size={18} />
               </button>
               <button onClick={() => confirmOption(res.id)} className="flex flex-col items-center justify-center p-2 rounded hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-500 transition-colors" title="Bevestigen">
                 <CheckCircle2 size={18} />
               </button>
               <button onClick={() => cancelOption(res.id)} className="flex flex-col items-center justify-center p-2 rounded hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Annuleren">
                 <X size={18} />
               </button>
            </div>
          )}
        ]}
        emptyMessage="Geen openstaande opties."
      />
    </div>
  );
};

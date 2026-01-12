
import React, { useState, useEffect } from 'react';
import { Clock, Check, X, ArrowRight, Mail, UserPlus, AlertTriangle } from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { WaitlistEntry, Reservation, BookingStatus } from '../../types';
import { waitlistRepo, bookingRepo, getShows, saveData, STORAGE_KEYS, calendarRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';

export const WaitlistManager = () => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [convertItem, setConvertItem] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setWaitlist(waitlistRepo.getAll().sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
  };

  const handleConvert = () => {
    if (!convertItem) return;

    // 1. Fetch Event & Show for Pricing & ID mapping
    const events = calendarRepo.getLegacyEvents();
    const shows = getShows();
    const event = events.find(e => e.date === convertItem.date);
    const show = event ? shows.find(s => s.id === event.showId) : null;

    // Fallback if missing
    if (!event || !show) {
        alert("Kan geen bijbehorend evenement vinden. Controleer de planning.");
        return;
    }

    // 2. Prepare Reservation Data
    // We assume 'standard' package as default for waitlist conversion unless specified in notes (manual check often needed)
    const pricing = getEffectivePricing(event, show);
    const totals = calculateBookingTotals({
        totalGuests: convertItem.partySize,
        packageType: 'standard', 
        addons: [],
        merchandise: [],
        date: convertItem.date,
        showId: show.id
    }, pricing);

    const newReservation: Reservation = {
      id: `RES-WL-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerId: convertItem.customerId,
      customer: {
        id: convertItem.customerId,
        firstName: convertItem.contactName.split(' ')[0],
        lastName: convertItem.contactName.split(' ').slice(1).join(' ') || 'Gast',
        email: convertItem.contactEmail,
        phone: convertItem.contactPhone || ''
      },
      date: convertItem.date,
      showId: show.id,
      status: BookingStatus.CONFIRMED, // Direct confirm per instructions
      partySize: convertItem.partySize,
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
          internal: `Geconverteerd vanuit Wachtlijst (Ref: ${convertItem.id}). Controleer dieetwensen in originele aanvraag.` 
      },
      startTime: event.startTime
    };

    // 3. Save Reservation
    bookingRepo.add(newReservation);

    // 4. Delete from Waitlist (effectively converting it)
    const originalItem = JSON.parse(JSON.stringify(convertItem));
    waitlistRepo.delete(convertItem.id); 

    // 5. Log & Undo
    logAuditAction('CONVERT_WAITLIST', 'RESERVATION', newReservation.id, {
      description: `Converted waitlist ${convertItem.id} to CONFIRMED booking. Overrode capacity.`,
      before: convertItem,
      after: newReservation
    });

    // Side effect tracking for undo: restore waitlist, delete reservation
    undoManager.registerUndo(
      'Wachtlijst conversie',
      'WAITLIST',
      convertItem.id,
      originalItem, // Snapshot to restore
      [{ type: 'RESERVATION', id: newReservation.id }] 
    );

    // --- EMAIL TRIGGER ---
    // Note: Using BOOKING_CONFIRMED template as it's a confirmed booking now, or a specific "You got a spot" template
    // For now we reuse CONFIRMED but ideally we'd have a specific key like 'WAITLIST_PROMOTED'
    triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: newReservation.id, data: newReservation });

    setConvertItem(null);
    refreshData();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Wachtlijst</h2>
          <p className="text-slate-500 text-sm">Beheer aanvragen voor volgeboekte shows.</p>
        </div>
      </div>

      <ResponsiveTable 
        data={waitlist}
        keyExtractor={(w) => w.id}
        columns={[
          { header: 'Datum Show', accessor: (w: WaitlistEntry) => <span className="font-mono text-white">{new Date(w.date).toLocaleDateString()}</span> },
          { header: 'Naam', accessor: (w: WaitlistEntry) => <span className="font-bold">{w.contactName}</span> },
          { header: 'Grootte', accessor: (w: WaitlistEntry) => <span>{w.partySize}p</span> },
          { header: 'Aangevraagd', accessor: (w: WaitlistEntry) => <span className="text-xs text-slate-400">{new Date(w.requestDate).toLocaleDateString()}</span> },
          { header: 'Status', accessor: (w: WaitlistEntry) => <Badge status={w.status === 'PENDING' ? 'WAITLIST' : 'ARCHIVED'}>{w.status}</Badge> },
          { header: 'Actie', accessor: (w: WaitlistEntry) => (
             w.status === 'PENDING' && (
               <Button onClick={() => setConvertItem(w)} className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 border-none flex items-center">
                 <UserPlus size={14} className="mr-1" /> Zet om naar Boeking
               </Button>
             )
          )}
        ]}
      />

      {/* Confirmation Dialog */}
      {convertItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6 bg-slate-900 border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <UserPlus size={20} className="mr-2 text-emerald-500" />
                Omzetten naar Boeking
            </h3>
            
            <div className="bg-amber-900/20 border border-amber-900/50 p-4 rounded-xl mb-6">
                <div className="flex items-start">
                    <AlertTriangle size={18} className="text-amber-500 mr-3 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-200/80 space-y-2">
                        <p><strong>Let op:</strong> Dit negeert de capaciteitslimiet van de zaal.</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li>Er wordt direct een <strong>CONFIRMED</strong> reservering aangemaakt.</li>
                            <li>De klant ontvangt een bevestiging per e-mail.</li>
                            <li>Het wachtlijst item wordt verwijderd.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="text-sm text-slate-400 mb-6 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                    <span>Klant:</span> <span className="text-white font-bold">{convertItem.contactName}</span>
                    <span>Datum:</span> <span className="text-white">{new Date(convertItem.date).toLocaleDateString()}</span>
                    <span>Aantal:</span> <span className="text-white">{convertItem.partySize} pers.</span>
                </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setConvertItem(null)}>Annuleren</Button>
              <Button onClick={handleConvert} className="bg-emerald-600 hover:bg-emerald-700">Bevestigen & Mailen</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

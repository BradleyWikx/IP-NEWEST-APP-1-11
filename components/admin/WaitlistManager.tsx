
import React, { useState, useEffect } from 'react';
import { Clock, Check, X, ArrowRight, Mail } from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { WaitlistEntry, Reservation, BookingStatus } from '../../types';
import { waitlistRepo, bookingRepo, getShows, saveData, STORAGE_KEYS } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';

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

    // 1. Create Reservation Draft
    const newReservation: Reservation = {
      id: `RES-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerId: convertItem.customerId,
      customer: {
        id: convertItem.customerId,
        firstName: convertItem.contactName.split(' ')[0],
        lastName: convertItem.contactName.split(' ').slice(1).join(' '),
        email: convertItem.contactEmail,
        phone: convertItem.contactPhone || ''
      },
      date: convertItem.date,
      showId: 'UNKNOWN',
      status: BookingStatus.REQUEST,
      partySize: convertItem.partySize,
      packageType: 'standard', // Default
      addons: [],
      merchandise: [],
      financials: { total: 0, finalTotal: 0, paid: 0, isPaid: false },
      notes: { internal: `Converted from Waitlist (Ref: ${convertItem.id})` }
    };

    // 2. Save Reservation
    bookingRepo.add(newReservation);

    // 3. Update Waitlist Status
    const originalItem = JSON.parse(JSON.stringify(convertItem));
    waitlistRepo.update(convertItem.id, (w) => ({ ...w, status: 'CONVERTED' }));

    // 4. Log & Undo
    logAuditAction('CONVERT_WAITLIST', 'RESERVATION', newReservation.id, {
      description: `Converted waitlist ${convertItem.id} to request`,
      before: convertItem,
      after: newReservation
    });

    undoManager.registerUndo(
      'Wachtlijst conversie',
      'WAITLIST',
      convertItem.id,
      originalItem,
      [{ type: 'RESERVATION', id: newReservation.id }] // Side effect tracking
    );

    // --- EMAIL TRIGGER ---
    triggerEmail('WAITLIST_CONVERTED_TO_REQUEST', { type: 'WAITLIST', id: convertItem.id, data: convertItem });

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
          { header: 'Datum Show', accessor: (w) => <span className="font-mono text-white">{new Date(w.date).toLocaleDateString()}</span> },
          { header: 'Naam', accessor: (w) => <span className="font-bold">{w.contactName}</span> },
          { header: 'Grootte', accessor: (w) => <span>{w.partySize}p</span> },
          { header: 'Aangevraagd', accessor: (w) => <span className="text-xs text-slate-400">{new Date(w.requestDate).toLocaleDateString()}</span> },
          { header: 'Status', accessor: (w) => <Badge status={w.status === 'PENDING' ? 'WAITLIST' : 'ARCHIVED'}>{w.status}</Badge> },
          { header: 'Actie', accessor: (w) => (
             w.status === 'PENDING' && (
               <Button onClick={() => setConvertItem(w)} variant="secondary" className="h-8 text-xs px-2">
                 Omzetten
               </Button>
             )
          )}
        ]}
      />

      {/* Confirmation Dialog */}
      {convertItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6 bg-slate-900 border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4">Wachtlijst Omzetten</h3>
            <p className="text-slate-400 mb-6">
              Hiermee wordt een nieuwe reservering aangemaakt voor <strong>{convertItem.contactName}</strong> op <strong>{new Date(convertItem.date).toLocaleDateString()}</strong>.
              De klant ontvangt een e-mail dat er plek is vrijgekomen.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setConvertItem(null)}>Annuleren</Button>
              <Button onClick={handleConvert}>Bevestigen & Mailen</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

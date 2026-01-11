
import React, { useState, useEffect } from 'react';
import { Inbox, CheckCircle2, XCircle, ArrowRight, Calendar, Users, MessageSquare } from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer } from '../UI';
import { ChangeRequest, Reservation } from '../../types';
import { requestRepo, bookingRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { recalculateReservationFinancials } from '../../utils/pricing';

export const ChangeRequestInbox = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [associatedReservation, setAssociatedReservation] = useState<Reservation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    setRequests(requestRepo.getAll().filter(r => r.status === 'NEW' || r.status === 'IN_REVIEW'));
  }, []);

  useEffect(() => {
    if (selectedRequest) {
      const res = bookingRepo.getById(selectedRequest.reservationId);
      setAssociatedReservation(res || null);
    }
  }, [selectedRequest]);

  const handleApprove = () => {
    if (!selectedRequest || !associatedReservation) return;
    setIsProcessing(true);

    // 1. Update Reservation Data
    let updatedReservation = { ...associatedReservation, ...selectedRequest.payload };
    
    // 2. Recalculate Financials (Important if partySize or extras changed)
    // This function also checks if 'isPaid' should remain true or revert to false if costs increase
    const newFinancials = recalculateReservationFinancials(updatedReservation);
    updatedReservation.financials = newFinancials;

    bookingRepo.update(associatedReservation.id, () => updatedReservation);

    // 3. Update Request Status
    const updatedReq: ChangeRequest = { ...selectedRequest, status: 'APPROVED' };
    const allReqs = requestRepo.getAll();
    saveData(STORAGE_KEYS.REQUESTS, allReqs.map(r => r.id === selectedRequest.id ? updatedReq : r));
    setRequests(requests.filter(r => r.id !== selectedRequest.id));

    // 4. Log Audit
    logAuditAction('APPROVE_CHANGE_REQUEST', 'RESERVATION', associatedReservation.id, {
      description: `Applied changes from request ${selectedRequest.id}. New Total: ${newFinancials.finalTotal}`,
      before: associatedReservation,
      after: updatedReservation
    });

    // 5. Email Trigger
    triggerEmail('BOOKING_CHANGE_APPROVED', { type: 'RESERVATION', id: associatedReservation.id, data: updatedReservation });

    setIsProcessing(false);
    setSelectedRequest(null);
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    setIsProcessing(true);

    const updatedReq: ChangeRequest = { ...selectedRequest, status: 'REJECTED', adminNotes: rejectionReason };
    const allReqs = requestRepo.getAll();
    saveData(STORAGE_KEYS.REQUESTS, allReqs.map(r => r.id === selectedRequest.id ? updatedReq : r));
    setRequests(requests.filter(r => r.id !== selectedRequest.id));

    if (associatedReservation) {
        triggerEmail('BOOKING_CHANGE_REJECTED', { type: 'RESERVATION', id: selectedRequest.reservationId, data: associatedReservation });
    }

    setIsProcessing(false);
    setRejectionReason('');
    setSelectedRequest(null);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Inbox</h2>
          <p className="text-slate-500 text-sm">Wijzigingsverzoeken van klanten.</p>
        </div>
      </div>

      <ResponsiveTable 
        data={requests}
        keyExtractor={r => r.id}
        onRowClick={(r) => setSelectedRequest(r)}
        columns={[
          { header: 'Type', accessor: (r: ChangeRequest) => <Badge status={r.type === 'CANCELLATION' ? 'CANCELLED' : 'OPTION'}>{r.type}</Badge> },
          { header: 'Klant', accessor: (r: ChangeRequest) => <span className="font-bold text-white">{r.customerName}</span> },
          { header: 'Bericht', accessor: (r: ChangeRequest) => <span className="text-slate-400 italic truncate block max-w-xs">"{r.message || r.details?.message}"</span> },
          { header: 'Datum', accessor: (r: ChangeRequest) => <span className="font-mono text-xs">{new Date(r.createdAt).toLocaleDateString()}</span> }
        ]}
        emptyMessage="Geen openstaande verzoeken."
      />

      <ResponsiveDrawer isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title="Verzoek Behandelen">
        {selectedRequest && associatedReservation && (
          <div className="space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="font-bold text-white mb-2">Huidige Reservering</h4>
              <p className="text-sm text-slate-400">Datum: {associatedReservation.date}</p>
              <p className="text-sm text-slate-400">Gasten: {associatedReservation.partySize}</p>
              <p className="text-sm text-slate-400">Totaal: €{associatedReservation.financials.finalTotal}</p>
              <p className="text-xs text-slate-500">Betaald: €{associatedReservation.financials.paid}</p>
            </div>

            <div className="flex flex-col items-center justify-center text-slate-500">
               <ArrowRight className="rotate-90 md:rotate-0" />
            </div>

            <div className="bg-amber-900/10 border border-amber-900/50 rounded-xl p-4">
              <h4 className="font-bold text-amber-500 mb-2">Gevraagde Wijziging</h4>
              {Object.entries(selectedRequest.payload).map(([key, val]) => (
                <p key={key} className="text-sm text-white">
                  <span className="capitalize text-slate-400">{key}:</span> {String(val)}
                </p>
              ))}
              {selectedRequest.message && (
                <div className="mt-4 pt-4 border-t border-amber-900/30">
                  <p className="text-xs font-bold text-amber-600 uppercase mb-1">Bericht Klant</p>
                  <p className="text-sm italic text-amber-100">"{selectedRequest.message}"</p>
                </div>
              )}
            </div>
            
            <div className="p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg text-xs text-blue-200 flex items-start">
               <CheckCircle2 size={16} className="mr-2 mt-0.5 shrink-0" />
               <p>Bij goedkeuring wordt het totaalbedrag automatisch herberekend. Als het nieuwe bedrag hoger is dan het reeds betaalde bedrag, zal de status "Betaald" komen te vervallen.</p>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <Button onClick={handleReject} variant="ghost" className="flex-1 text-red-500 hover:bg-red-900/20">Weigeren</Button>
              <Button onClick={handleApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Goedkeuren</Button>
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </div>
  );
};

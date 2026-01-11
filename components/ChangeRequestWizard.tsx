
import React, { useState } from 'react';
import { Button, Input, Card } from './UI';
import { ChangeRequest } from '../types';
import { loadData, saveData, STORAGE_KEYS, notificationsRepo, tasksRepo } from '../utils/storage';
import { triggerEmail } from '../utils/emailEngine';

const REQUESTS_KEY = 'grand_stage_change_requests';

export const ChangeRequestWizard = ({ booking, onClose, onSuccess }: any) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    const request: ChangeRequest = {
      id: `REQ-${Date.now()}`,
      reservationId: booking.id,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      type: 'MODIFICATION',
      status: 'NEW',
      payload: {}, 
      message,
      createdAt: new Date().toISOString()
    };

    const existing = loadData<ChangeRequest[]>(REQUESTS_KEY, []);
    saveData(REQUESTS_KEY, [...existing, request]);

    triggerEmail('BOOKING_CHANGE_REQUEST_RECEIVED', { type: 'RESERVATION', id: booking.id, data: booking });
    
    notificationsRepo.createFromEvent('NEW_CHANGE_REQUEST', request);

    // --- TASK TRIGGER ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    tasksRepo.createAutoTask({
        type: 'CHANGE_REQUEST_FOLLOW_UP',
        title: `Wijziging: ${booking.customer.lastName}`,
        notes: `Klant wil wijzigen: "${message}". Reageer binnen 24u.`,
        dueAt: tomorrow.toISOString(),
        entityType: 'CHANGE_REQUEST',
        entityId: request.id
    });

    onSuccess("Uw wijzigingsverzoek is ontvangen. U ontvangt binnen 24 uur een reactie.");
    onClose();
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-2xl font-serif text-white mb-6">Wijziging Doorgeven</h2>
      <div className="space-y-4 flex-grow">
        <p className="text-slate-400 text-sm">Beschrijf hieronder wat u wilt wijzigen aan uw reservering.</p>
        <textarea 
          className="w-full h-40 bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:border-amber-500 outline-none"
          placeholder="Bijv. Ik wil graag de datum wijzigen naar..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={handleSubmit}>Versturen</Button>
      </div>
    </div>
  );
};

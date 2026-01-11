
import React, { useState } from 'react';
import { Button, Input, Card } from './UI';
import { WaitlistEntry } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { notificationsRepo, waitlistRepo } from '../utils/storage';
import { ErrorBanner } from './UI/ErrorBanner';

export const WaitlistModal = ({ date, onClose }: { date: string, onClose: () => void }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', partySize: 2 });
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    if (!formData.name || !formData.email) {
      setError("Naam en email zijn verplicht.");
      return;
    }

    // Duplicate check
    const existing = waitlistRepo.getAll();
    const duplicate = existing.find(w => w.date === date && w.contactEmail.toLowerCase() === formData.email.toLowerCase() && w.status === 'PENDING');
    if (duplicate) {
      setError("U staat al op de wachtlijst voor deze datum met dit emailadres.");
      return;
    }

    const waitlistId = `WL-${Date.now()}`;
    const newEntry: WaitlistEntry = {
      id: waitlistId,
      date,
      customerId: `CUST-${Date.now()}`,
      contactName: formData.name,
      contactEmail: formData.email,
      contactPhone: formData.phone,
      partySize: formData.partySize,
      requestDate: new Date().toISOString(),
      status: 'PENDING'
    };

    waitlistRepo.add(newEntry);

    // --- EMAIL TRIGGER ---
    triggerEmail('WAITLIST_JOINED', { type: 'WAITLIST', id: waitlistId, data: newEntry });
    
    // --- NOTIFICATION TRIGGER ---
    notificationsRepo.createFromEvent('NEW_WAITLIST', newEntry);

    setSubmittedId(waitlistId);
  };

  if (submittedId) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-xl">
        <h3 className="text-xl text-white font-bold mb-2">Ingeschreven!</h3>
        <p className="text-slate-400 mb-4">We nemen contact op als er een plek vrijkomt.</p>
        <Button onClick={onClose}>Sluiten</Button>
      </div>
    );
  }

  return (
    <Card className="p-6 bg-slate-900 border-slate-800 w-full max-w-md mx-auto">
      <h3 className="text-xl font-serif text-white mb-4">Wachtlijst Inschrijving</h3>
      <p className="text-sm text-slate-400 mb-4">Voor datum: {new Date(date).toLocaleDateString()}</p>
      
      {error && <ErrorBanner message={error} className="mb-4" onDismiss={() => setError(null)} />}

      <div className="space-y-4">
        <Input label="Naam" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} />
        <Input label="Email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
        <Input label="Telefoon" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} />
        <Input label="Aantal Personen" type="number" value={formData.partySize} onChange={(e: any) => setFormData({...formData, partySize: parseInt(e.target.value)})} />
        <Button onClick={handleSubmit} className="w-full">Inschrijven</Button>
      </div>
    </Card>
  );
};

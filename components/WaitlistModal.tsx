
import React, { useState } from 'react';
import { Button, Input, Card } from './UI';
import { WaitlistEntry } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { notificationsRepo, waitlistRepo } from '../utils/storage';
import { ErrorBanner } from './UI/ErrorBanner';
import { Loader2 } from 'lucide-react';

export const WaitlistModal = ({ date, onClose }: { date: string, onClose: () => void }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', partySize: 2, notes: '' });
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    // 1. Validation
    if (!formData.name || !formData.email) {
      setError("Naam en email zijn verplicht.");
      setIsSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        setError("Vul een geldig e-mailadres in.");
        setIsSubmitting(false);
        return;
    }

    // 2. Duplicate check
    const existing = waitlistRepo.getAll();
    const duplicate = existing.find(w => w.date === date && w.contactEmail.toLowerCase() === formData.email.toLowerCase() && w.status === 'PENDING');
    if (duplicate) {
      setError("U staat al op de wachtlijst voor deze datum met dit emailadres.");
      setIsSubmitting(false);
      return;
    }

    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    // 3. Create Entry
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
      status: 'PENDING',
      notes: formData.notes
    };

    try {
        waitlistRepo.add(newEntry);

        // --- EMAIL TRIGGER ---
        triggerEmail('WAITLIST_JOINED', { type: 'WAITLIST', id: waitlistId, data: newEntry });
        
        // --- NOTIFICATION TRIGGER ---
        notificationsRepo.createFromEvent('NEW_WAITLIST', newEntry);

        setSubmittedId(waitlistId);
    } catch (err) {
        console.error(err);
        setError("Er is iets misgegaan bij het opslaan. Probeer het opnieuw.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <Card className="p-8 text-center bg-slate-900 border-slate-800 rounded-xl max-w-md mx-auto animate-in fade-in zoom-in">
        <h3 className="text-xl text-white font-bold mb-2">Ingeschreven!</h3>
        <p className="text-slate-400 mb-6">We hebben je op de wachtlijst geplaatst. We nemen contact op als er een plek vrijkomt.</p>
        <Button onClick={onClose} className="w-full">Sluiten</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-slate-900 border-slate-800 w-full max-w-md mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-serif text-white">Wachtlijst Inschrijving</h3>
        <p className="text-sm text-slate-400">Datum: {new Date(date).toLocaleDateString()}</p>
      </div>
      
      {error && <ErrorBanner message={error} className="mb-4" onDismiss={() => setError(null)} />}

      <div className="space-y-4">
        <Input 
            label="Naam *" 
            value={formData.name} 
            onChange={(e: any) => setFormData({...formData, name: e.target.value})}
            disabled={isSubmitting}
        />
        <Input 
            label="Email *" 
            type="email"
            value={formData.email} 
            onChange={(e: any) => setFormData({...formData, email: e.target.value})} 
            disabled={isSubmitting}
        />
        <div className="grid grid-cols-2 gap-4">
            <Input 
                label="Telefoon" 
                value={formData.phone} 
                onChange={(e: any) => setFormData({...formData, phone: e.target.value})} 
                disabled={isSubmitting}
            />
            <Input 
                label="Personen *" 
                type="number" 
                min="1"
                value={formData.partySize} 
                onChange={(e: any) => setFormData({...formData, partySize: Math.max(1, parseInt(e.target.value) || 1)})} 
                disabled={isSubmitting}
            />
        </div>
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Notitie</label>
            <textarea 
                className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-amber-500 outline-none h-20 resize-none disabled:opacity-50"
                placeholder="Bijv. Rolstoel, voorkeur tafel..."
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                disabled={isSubmitting}
            />
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-amber-600 hover:bg-amber-700 text-black border-none">
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Inschrijven'}
        </Button>
      </div>
    </Card>
  );
};

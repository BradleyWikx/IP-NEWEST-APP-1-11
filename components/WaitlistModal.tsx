
import React, { useState } from 'react';
import { Button, Input, Card } from './UI';
import { WaitlistEntry } from '../types';
import { triggerEmail } from '../utils/emailEngine';
import { notificationsRepo, waitlistRepo } from '../utils/storage';
import { ErrorBanner } from './UI/ErrorBanner';
import { Loader2, MapPin } from 'lucide-react';

export const WaitlistModal = ({ date, onClose }: { date: string, onClose: () => void }) => {
  const [formData, setFormData] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    phone: '', 
    street: '',
    houseNumber: '',
    zip: '',
    city: '',
    partySize: 2 
  });
  
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    // 1. Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setError("Naam, email en telefoonnummer zijn verplicht.");
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

    // 3. Create Entry - Packing address into notes as requested to simplify model
    const addressString = `Adres: ${formData.street} ${formData.houseNumber}, ${formData.zip} ${formData.city}`;
    const waitlistId = `WL-${Date.now()}`;
    
    const newEntry: WaitlistEntry = {
      id: waitlistId,
      date,
      customerId: `CUST-${Date.now()}`,
      contactName: `${formData.firstName} ${formData.lastName}`,
      contactEmail: formData.email,
      contactPhone: formData.phone,
      partySize: formData.partySize,
      requestDate: new Date().toISOString(),
      status: 'PENDING',
      notes: addressString // Storing address here for simplicity
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
    <Card className="p-6 bg-slate-900 border-slate-800 w-full max-w-lg mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-serif text-white">Wachtlijst Inschrijving</h3>
        <p className="text-sm text-slate-400">Datum: {new Date(date).toLocaleDateString()}</p>
      </div>
      
      {error && <ErrorBanner message={error} className="mb-4" onDismiss={() => setError(null)} />}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Input 
                label="Voornaam *" 
                value={formData.firstName} 
                onChange={(e: any) => setFormData({...formData, firstName: e.target.value})}
                disabled={isSubmitting}
            />
            <Input 
                label="Achternaam *" 
                value={formData.lastName} 
                onChange={(e: any) => setFormData({...formData, lastName: e.target.value})}
                disabled={isSubmitting}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
             <Input 
                label="Email *" 
                type="email"
                value={formData.email} 
                onChange={(e: any) => setFormData({...formData, email: e.target.value})} 
                disabled={isSubmitting}
            />
             <Input 
                label="Telefoon *" 
                value={formData.phone} 
                onChange={(e: any) => setFormData({...formData, phone: e.target.value})} 
                disabled={isSubmitting}
            />
        </div>

        <div className="pt-2 border-t border-slate-800">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
              <MapPin size={12} className="mr-1"/> Adresgegevens
           </label>
           <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                  <Input label="Straat" value={formData.street} onChange={(e: any) => setFormData({...formData, street: e.target.value})} disabled={isSubmitting} />
              </div>
              <div className="col-span-1">
                  <Input label="Nr" value={formData.houseNumber} onChange={(e: any) => setFormData({...formData, houseNumber: e.target.value})} disabled={isSubmitting} />
              </div>
              <div className="col-span-1">
                  <Input label="Postcode" value={formData.zip} onChange={(e: any) => setFormData({...formData, zip: e.target.value})} disabled={isSubmitting} />
              </div>
              <div className="col-span-3">
                  <Input label="Woonplaats" value={formData.city} onChange={(e: any) => setFormData({...formData, city: e.target.value})} disabled={isSubmitting} />
              </div>
           </div>
        </div>

        <div>
             <Input 
                label="Aantal Personen *" 
                type="number" 
                min="1"
                value={formData.partySize} 
                onChange={(e: any) => setFormData({...formData, partySize: Math.max(1, parseInt(e.target.value) || 1)})} 
                disabled={isSubmitting}
            />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-amber-600 hover:bg-amber-700 text-black border-none mt-4">
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Inschrijven'}
        </Button>
      </div>
    </Card>
  );
};

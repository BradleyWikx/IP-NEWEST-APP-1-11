
import React, { useState } from 'react';
import { Mail, Check, AlertCircle, Send, CheckCircle2 } from 'lucide-react';
import { Button, Input, Card } from './UI';
import { Subscriber } from '../types';
import { loadData, saveData } from '../utils/storage';

const STORAGE_KEY = 'grand_stage_subscribers';

export const NewsletterSignup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    prefUpdates: true,
    prefSpecials: false,
    prefMerch: false
  });
  const [status, setStatus] = useState<'IDLE' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('SUBMITTING');
    setErrorMessage('');

    // Basic Validation
    if (!formData.name || !formData.email) {
      setErrorMessage('Vul a.u.b. uw naam en e-mailadres in.');
      setStatus('IDLE');
      return;
    }
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      setErrorMessage('Vul een geldig e-mailadres in.');
      setStatus('IDLE');
      return;
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const subscribers = loadData<Subscriber[]>(STORAGE_KEY, []);
      
      if (subscribers.some(s => s.email.toLowerCase() === formData.email.toLowerCase())) {
        setErrorMessage('Dit e-mailadres is reeds ingeschreven.');
        setStatus('ERROR');
        return;
      }

      const prefs = [];
      if (formData.prefUpdates) prefs.push('UPDATES');
      if (formData.prefSpecials) prefs.push('SPECIALS');
      if (formData.prefMerch) prefs.push('MERCH');

      const newSubscriber: Subscriber = {
        id: `SUB-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        preferences: prefs,
        createdAt: new Date().toISOString(),
        status: 'PENDING' // Simulation of double opt-in
      };

      saveData(STORAGE_KEY, [...subscribers, newSubscriber]);
      setStatus('SUCCESS');
    } catch (err) {
      setErrorMessage('Er is iets misgegaan. Probeer het later opnieuw.');
      setStatus('ERROR');
    }
  };

  if (status === 'SUCCESS') {
    return (
      <Card className="border-slate-800 p-8 text-center animate-in fade-in zoom-in-95 bg-slate-900/50 backdrop-blur-md">
        <div className="w-16 h-16 bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-900/50">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-2xl font-serif text-white mb-2">Bijna klaar!</h3>
        <p className="text-slate-400 mb-6">
          We hebben een bevestigingsmail gestuurd naar <strong>{formData.email}</strong>. 
          Klik op de link in de mail om uw inschrijving te activeren.
        </p>
        <Button variant="secondary" onClick={() => setStatus('IDLE')}>Nog een inschrijving</Button>
      </Card>
    );
  }

  return (
    <Card className="p-8 relative overflow-hidden bg-slate-900/50 backdrop-blur-md border-slate-800">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
            <Mail size={24} />
          </div>
          <div>
            <h3 className="text-xl font-serif text-white">Blijf op de hoogte</h3>
            <p className="text-slate-500 text-xs uppercase tracking-widest">Inspiration Point Nieuwsbrief</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input 
              label="Uw Naam"
              placeholder="Jan Jansen" 
              value={formData.name} 
              onChange={(e: any) => setFormData({...formData, name: e.target.value})}
            />
            <Input 
              label="E-mailadres"
              type="email" 
              placeholder="jan@voorbeeld.nl" 
              value={formData.email} 
              onChange={(e: any) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interesses</p>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.prefUpdates ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-700 bg-slate-900'}`}>
                {formData.prefUpdates && <Check size={14} strokeWidth={3} />}
              </div>
              <input type="checkbox" className="hidden" checked={formData.prefUpdates} onChange={() => setFormData({...formData, prefUpdates: !formData.prefUpdates})} />
              <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Show updates & Agenda</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.prefSpecials ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-700 bg-slate-900'}`}>
                {formData.prefSpecials && <Check size={14} strokeWidth={3} />}
              </div>
              <input type="checkbox" className="hidden" checked={formData.prefSpecials} onChange={() => setFormData({...formData, prefSpecials: !formData.prefSpecials})} />
              <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Speciale Evenementen & Gala's</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.prefMerch ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-700 bg-slate-900'}`}>
                {formData.prefMerch && <Check size={14} strokeWidth={3} />}
              </div>
              <input type="checkbox" className="hidden" checked={formData.prefMerch} onChange={() => setFormData({...formData, prefMerch: !formData.prefMerch})} />
              <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Vouchers & Merchandise</span>
            </label>
          </div>

          {status === 'ERROR' && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center">
              <AlertCircle size={16} className="mr-2 shrink-0" />
              {errorMessage}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={status === 'SUBMITTING'} 
            className="w-full flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black border-none"
          >
            {status === 'SUBMITTING' ? 'Verwerken...' : 'Inschrijven'}
            {!status.includes('SUBMITTING') && <Send size={16} className="ml-2" />}
          </Button>
          
          <p className="text-[10px] text-slate-600 text-center">
            Door in te schrijven gaat u akkoord met ons privacybeleid. U kunt zich op elk moment uitschrijven.
          </p>
        </form>
      </div>
    </Card>
  );
};

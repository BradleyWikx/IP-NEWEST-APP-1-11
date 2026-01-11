import React, { useState } from 'react';
import { 
  Search, Calendar, Clock, Users, Package, ArrowLeft, 
  AlertCircle, CheckCircle2, MessageSquare, ShoppingBag, 
  X, Plus, Minus, Send, ExternalLink, Receipt
} from 'lucide-react';
import { Button, Input, Card, Badge } from './UI';
import { MOCK_SHOW_TYPES, MOCK_MERCHANDISE } from '../mock/data';
import { Link } from 'react-router-dom';
import { NewsletterSignup } from './NewsletterSignup';
import { ChangeRequestWizard } from './ChangeRequestWizard';

const MOCK_DB_KEY = 'grand_stage_reservations';

export const CustomerPortal = () => {
  const [step, setStep] = useState<'LOGIN' | 'DASHBOARD'>('LOGIN');
  const [search, setSearch] = useState({ resNum: '', lastName: '' });
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [showChangeWizard, setShowChangeWizard] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const allReservations = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '[]');
      const found = allReservations.find((r: any) => 
        r.id.toLowerCase() === search.resNum.toLowerCase().trim() && 
        r.customer.lastName.toLowerCase() === search.lastName.toLowerCase().trim()
      );

      if (found) {
        setBooking(found);
        setStep('DASHBOARD');
      } else {
        setError("Geen reservering gevonden met deze combinatie.");
      }
    } catch (err) {
      setError("Er is een fout opgetreden bij het zoeken.");
    }
  };

  const handleRequestSuccess = (msg: string) => {
    setRequestSuccess(msg);
    setTimeout(() => setRequestSuccess(null), 6000);
  };

  if (step === 'LOGIN') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background ambience */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-black to-black -z-10" />
        
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Login Section */}
          <div className="space-y-8">
            <div className="text-center md:text-left">
               <Link to="/" className="inline-flex items-center text-slate-500 hover:text-white mb-8 transition-colors text-xs font-bold uppercase tracking-widest">
                 <ArrowLeft size={14} className="mr-2" /> Terug naar Home
               </Link>
               <h1 className="text-4xl font-serif text-white mb-2">Mijn Reservering</h1>
               <p className="text-slate-400">Beheer uw boeking of voeg extra's toe.</p>
            </div>

            <Card className="p-8 bg-slate-900/50 backdrop-blur-md border-slate-800">
              <form onSubmit={handleLookup} className="space-y-6">
                <Input 
                  label="Reserveringsnummer" 
                  placeholder="Bijv. RES-2505121234" 
                  value={search.resNum}
                  onChange={(e: any) => setSearch({...search, resNum: e.target.value})}
                />
                <Input 
                  label="Achternaam" 
                  placeholder="Uw achternaam" 
                  value={search.lastName}
                  onChange={(e: any) => setSearch({...search, lastName: e.target.value})}
                />
                
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center text-red-400 text-sm">
                    <AlertCircle size={16} className="mr-2 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full flex justify-center items-center">
                  <Search size={18} className="mr-2" /> Zoek Reservering
                </Button>
              </form>
            </Card>
          </div>

          {/* Newsletter Section */}
          <div className="relative">
             {/* Divider for mobile */}
             <div className="md:hidden w-full h-px bg-slate-800 my-8" />
             <NewsletterSignup />
          </div>

        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  const show = booking.showId ? MOCK_SHOW_TYPES[booking.showId] : null;

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
           <div className="flex items-center space-x-4">
             <Link to="/" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
               <ArrowLeft size={16} />
             </Link>
             <div>
               <h1 className="text-white font-serif text-lg">Reservering {booking.id}</h1>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Klantportaal</p>
             </div>
           </div>
           <button onClick={() => setStep('LOGIN')} className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest">Uitloggen</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {requestSuccess && (
          <div className="bg-emerald-900/20 border border-emerald-900/50 p-6 rounded-2xl flex items-start text-emerald-400 animate-in slide-in-from-top-4">
            <CheckCircle2 size={24} className="mr-4 mt-1 shrink-0" />
            <div>
              <span className="font-bold text-lg block mb-1">Aanvraag Verzonden</span>
              <span className="text-sm text-emerald-400/80">{requestSuccess}</span>
            </div>
          </div>
        )}

        {/* Status Hero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="md:col-span-2 p-8 bg-gradient-to-br from-slate-900 to-slate-900/50 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-6">
                  <Badge status={booking.status} className="scale-110" />
                  {booking.status === 'REQUEST' && (
                    <span className="text-slate-400 text-xs flex items-center"><Clock size={12} className="mr-1"/> In afwachting van bevestiging</span>
                  )}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif text-white mb-2">{show?.name}</h2>
                <p className="text-slate-300 text-lg capitalize">{new Date(booking.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
           </Card>

           <Card className="p-6 flex flex-col justify-center space-y-6">
              <div className="text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Totaalbedrag</p>
                 <p className="text-3xl font-serif text-white">€{booking.financials.finalTotal.toFixed(2)}</p>
                 {booking.financials.voucherUsed > 0 && <p className="text-xs text-amber-500 mt-1">Voucher toegepast</p>}
              </div>
              <div className="pt-6 border-t border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Uw Gezelschap</p>
                <div className="flex justify-center items-center space-x-2 text-white">
                  <Users size={20} />
                  <span className="text-xl font-bold">{booking.totalGuests}</span>
                </div>
              </div>
           </Card>
        </div>

        {/* Details & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Left: Details */}
           <div className="lg:col-span-2 space-y-8">
              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-6 flex items-center">
                  <Receipt size={16} className="mr-2" /> Detailoverzicht
                </h3>
                
                <div className="space-y-4">
                   <div className="flex justify-between py-3 border-b border-slate-800/50">
                     <span className="text-slate-400">Arrangement</span>
                     <span className="text-white font-bold">{booking.packageType === 'premium' ? 'Premium' : 'Standard'}</span>
                   </div>
                   
                   {booking.addons.length > 0 && (
                     <div className="py-3 border-b border-slate-800/50">
                       <span className="text-slate-400 block mb-2">Extra Opties</span>
                       <div className="space-y-1">
                         {booking.addons.map((addon: any) => (
                           <div key={addon.id} className="flex justify-between text-sm">
                             <span className="text-slate-300 ml-4">• {addon.id}</span>
                             <span className="text-white">x{addon.quantity}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {booking.merchandise.length > 0 && (
                     <div className="py-3 border-b border-slate-800/50">
                       <span className="text-slate-400 block mb-2">Merchandise</span>
                       <div className="space-y-1">
                         {booking.merchandise.map((merch: any) => (
                           <div key={merch.id} className="flex justify-between text-sm">
                             <span className="text-slate-300 ml-4">• {merch.id}</span>
                             <span className="text-white">x{merch.quantity}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   <div className="py-3">
                     <span className="text-slate-400 block mb-2">Contact & Opmerkingen</span>
                     <p className="text-sm text-white mb-1">{booking.customer.email} | {booking.customer.phone}</p>
                     {booking.notes.dietary && <p className="text-sm text-amber-500 mt-2">Dieet: {booking.notes.dietary}</p>}
                     {booking.notes.isCelebrating && <p className="text-sm text-red-500 mt-1">Viering: {booking.notes.celebrationText}</p>}
                   </div>
                </div>
              </div>
           </div>

           {/* Right: Actions */}
           <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Beheer</h3>
              
              <button 
                onClick={() => setShowChangeWizard(true)}
                className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-slate-800 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare size={20} />
                </div>
                <h4 className="text-white font-bold mb-1">Wijziging Doorgeven</h4>
                <p className="text-xs text-slate-400">Datum wijzigen, aantal personen, extra's of dieetwensen.</p>
              </button>

              <button 
                onClick={() => setShowChangeWizard(true)} // Can be optimized to open directly on Merch tab if desired
                className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500 hover:bg-slate-800 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShoppingBag size={20} />
                </div>
                <h4 className="text-white font-bold mb-1">Merchandise Toevoegen</h4>
                <p className="text-xs text-slate-400">Bestel souvenirs of extra's bij uw reservering.</p>
              </button>
           </div>
        </div>
      </div>

      {/* CHANGE WIZARD MODAL */}
      {showChangeWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-950 border border-slate-700 rounded-3xl w-full max-w-4xl h-[90vh] shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
             <ChangeRequestWizard 
               booking={booking} 
               onClose={() => setShowChangeWizard(false)}
               onSuccess={handleRequestSuccess}
             />
          </div>
        </div>
      )}
    </div>
  );
};
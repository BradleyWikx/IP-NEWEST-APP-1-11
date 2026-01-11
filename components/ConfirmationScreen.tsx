
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Mail, ArrowRight, Clock, FileText, CreditCard } from 'lucide-react';
import { Button, Card } from './UI';

export const ConfirmationScreen = () => {
  const location = useLocation();
  const reservation = location.state?.reservation;

  if (!reservation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Geen reservering gevonden.</p>
          <Link to="/"><Button>Terug naar Home</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 md:p-8">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto border border-blue-900/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <CheckCircle2 size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-serif text-white">Aanvraag Ontvangen!</h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto">
            Bedankt {reservation.customer.firstName}. We hebben je aanvraag voor <strong>{new Date(reservation.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</strong> goed ontvangen.
          </p>
        </div>

        <Card className="bg-slate-900 border-slate-800 p-8 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div>
            <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4">Wat gebeurt er nu?</h3>
            <div className="space-y-6 relative">
              {/* Vertical Connector Line */}
              <div className="absolute left-6 top-2 bottom-4 w-0.5 bg-slate-800 z-0" />

              <div className="flex items-start relative z-10">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-blue-500 font-bold shrink-0 mr-4">1</div>
                <div>
                   <h4 className="font-bold text-white text-lg">Controle Beschikbaarheid</h4>
                   <p className="text-slate-400 text-sm mt-1">
                     Wij controleren de beschikbaarheid voor uw gekozen datum. Dit is nog <strong>geen definitieve boeking</strong>.
                   </p>
                </div>
              </div>

              <div className="flex items-start relative z-10">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 mr-4">2</div>
                <div>
                   <h4 className="font-bold text-white text-lg">Bevestiging & Factuur</h4>
                   <p className="text-slate-400 text-sm mt-1">
                     Bij akkoord ontvangt u een bevestiging. De factuur volgt <strong>2 weken</strong> voor de voorstelling.
                   </p>
                </div>
              </div>

              <div className="flex items-start relative z-10">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 mr-4">3</div>
                <div>
                   <h4 className="font-bold text-white text-lg">Betaling</h4>
                   <p className="text-slate-400 text-sm mt-1">
                     De betaling dient uiterlijk <strong>1 week</strong> voor aanvang van de show voldaan te zijn.
                   </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex items-start space-x-3">
             <Mail size={20} className="text-blue-400 mt-0.5 shrink-0" />
             <p className="text-sm text-blue-200">
               We hebben een kopie van deze aanvraag gestuurd naar <strong>{reservation.customer.email}</strong>.
             </p>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Reserveringsnummer</p>
              <p className="font-mono text-xl text-white tracking-wider">{reservation.id}</p>
            </div>
            <div className="text-right">
               <p className="text-xs text-slate-500 mb-1">Tot 2 weken vooraf</p>
               <span className="text-[10px] bg-emerald-900/20 text-emerald-400 px-2 py-1 rounded border border-emerald-900/30 font-bold uppercase">Kosteloos Wijzigen</span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/portal" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">Bekijk in Portaal</Button>
          </Link>
          <Link to="/" className="w-full sm:w-auto">
            <Button className="w-full flex items-center justify-center">
              Terug naar Kalender <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
};

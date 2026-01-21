
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Mail, ArrowRight, Download } from 'lucide-react';
import { Button, Card } from './UI';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarTools';
import { useTranslation } from '../utils/i18n';

export const ConfirmationScreen = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const reservation = location.state?.reservation;

  if (!reservation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Geen reservering gevonden.</p>
          <Link to="/"><Button>{t('back_home')}</Button></Link>
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
          <h1 className="text-4xl font-serif text-white">{t('confirmation_title')}</h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto">
            {t('confirmation_msg')} {reservation.customer.firstName}. {t('confirmation_sub')}
          </p>
        </div>

        <Card className="bg-slate-900 border-slate-800 p-8 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl flex items-start space-x-3">
             <Mail size={20} className="text-blue-400 mt-0.5 shrink-0" />
             <p className="text-sm text-blue-200">
               We hebben een kopie van deze aanvraag gestuurd naar <strong>{reservation.customer.email}</strong>.
             </p>
          </div>

          {/* ADD TO CALENDAR BUTTONS */}
          <div className="grid grid-cols-2 gap-3">
             <a 
                href={generateGoogleCalendarUrl(reservation)} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Add to Google Calendar"
             >
                <Calendar size={16} className="mr-2" /> {t('calendar_google')}
             </a>
             <button 
                onClick={() => downloadIcsFile(reservation)}
                className="flex items-center justify-center p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Download ICS file for Outlook or Apple Calendar"
             >
                <Download size={16} className="mr-2" /> {t('calendar_ics')}
             </button>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Reserveringsnummer</p>
              <p className="font-mono text-xl text-white tracking-wider">{reservation.id}</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/portal" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">{t('portal_btn')}</Button>
          </Link>
          <Link to="/" className="w-full sm:w-auto">
            <Button className="w-full flex items-center justify-center">
              {t('back_home')} <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
};

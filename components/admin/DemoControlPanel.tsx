
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, Database, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Card, Button } from '../UI';
import { seedFullDatabase } from '../../utils/seed';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';

export const DemoControlPanel = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleFullReset = async () => {
    setShowConfirm(false);
    setIsLoading(true);
    setProgress(0);
    setStatusMsg("Initialiseren...");
    
    try {
        // Run the seed
        await seedFullDatabase((msg, pct) => {
            setStatusMsg(msg);
            setProgress(pct);
        });
        
        // Finalize
        setIsDone(true);
        setStatusMsg("Voltooid! Dashboard wordt geladen...");
        
        // Force a global UI refresh without reloading the page (prevents console errors)
        window.dispatchEvent(new Event('storage-update'));
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
            navigate('/admin');
        }, 1500);

    } catch (e) {
        console.error(e);
        setStatusMsg("Er ging iets mis: " + (e as any).message);
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto animate-in fade-in">
      <Card className="w-full bg-slate-900 border border-slate-800 p-10 text-center space-y-8 shadow-2xl relative overflow-hidden group">
        
        {/* Animated Gradient Border */}
        <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 ${isLoading ? 'animate-pulse' : ''}`} />

        <div className="mb-8">
          <div className="w-24 h-24 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-800 shadow-xl group-hover:border-red-900/50 transition-colors">
            {isDone ? (
                <CheckCircle2 size={48} className="text-emerald-500" />
            ) : isLoading ? (
                <Loader2 size={40} className="text-amber-500 animate-spin" />
            ) : (
                <Database size={40} className="text-slate-200" />
            )}
          </div>
          <h2 className="text-4xl font-serif text-white mb-3">Demo Environment</h2>
          <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
            Met één klik wordt het volledige systeem gewist en opnieuw opgebouwd met realistische data voor Inspiration Point.
          </p>
        </div>

        {/* Status Bar */}
        {isLoading && (
            <div className="w-full max-w-xs mx-auto mb-6">
                <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                    <span>{statusMsg}</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-amber-500 transition-all duration-300 ease-out" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        )}

        <div className="p-6 bg-red-950/10 rounded-xl border border-red-900/30">
             {!isLoading && !isDone && (
               <div className="flex justify-center mb-4 text-red-500">
                 <AlertTriangle size={32} />
               </div>
             )}
             
             {isDone ? (
                <div className="text-emerald-500 font-bold text-lg mb-4">
                    Data succesvol geladen!
                </div>
             ) : (
                <>
                    <h3 className="text-xl font-bold text-white mb-2">Universe Generator</h3>
                    <p className="text-xs text-slate-500 mb-6">
                    Genereert: 200+ Boekingen, 50+ Klanten, Volledige Agenda (-3m/+6m), Vouchers, Taken, Wachtlijsten.
                    </p>
                </>
             )}
             
             {isDone ? (
                 <Button onClick={() => navigate('/admin')} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg">
                    Naar Dashboard <ArrowRight size={18} className="ml-2"/>
                 </Button>
             ) : (
                 <Button 
                    onClick={() => setShowConfirm(true)} 
                    disabled={isLoading}
                    className="w-full h-14 text-lg bg-red-600 hover:bg-red-700 text-white border-none shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                 >
                    {isLoading ? 'Genereren...' : 'INITIALISEER DEMO OMGEVING'}
                 </Button>
             )}
        </div>

        <p className="text-[10px] text-slate-600">
          Alle wijzigingen zijn lokaal in uw browser (localStorage).
        </p>

      </Card>

      <DestructiveActionModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleFullReset}
        title="Weet je het zeker?"
        description={
            <div className="space-y-4">
                <p>Dit proces zal <strong>alle huidige data verwijderen</strong> (Boekingen, Klanten, Instellingen) en vervangen door een demo dataset.</p>
                <p>Dit kan niet ongedaan worden gemaakt.</p>
            </div>
        }
        verificationText="DEMO"
        confirmButtonText="Start Generatie"
      />
    </div>
  );
};

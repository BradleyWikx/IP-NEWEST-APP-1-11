import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, PlayCircle, Loader2, Plus, Database } from 'lucide-react';
import { Card, Button } from '../UI';
import { seedFullDatabase, addRandomReservations } from '../../utils/seed';
import { undoManager } from '../../utils/undoManager';

export const DemoControlPanel = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleFullReset = async () => {
    if (confirm("⚠️ WEET JE HET ZEKER?\n\nAlle huidige data wordt gewist en vervangen door een demo-set. Dit kan niet ongedaan worden gemaakt.")) {
      setIsLoading(true);
      
      // Allow UI to render loading state
      setTimeout(() => {
        seedFullDatabase();
        window.location.reload();
      }, 500);
    }
  };

  const handleAddData = () => {
    setIsLoading(true);
    setTimeout(() => {
      const count = addRandomReservations(10);
      if (count > 0) {
        undoManager.showSuccess(`${count} boekingen toegevoegd.`);
      } else {
        alert("Kan geen data toevoegen. Reset de database eerst.");
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto">
      <Card className="w-full bg-slate-900 border border-slate-800 p-8 text-center space-y-8 shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />

        <div className="mb-8">
          <div className="w-20 h-20 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-800 shadow-xl">
            <Database size={40} className={`text-slate-200 ${isLoading ? 'animate-pulse' : ''}`} />
          </div>
          <h2 className="text-3xl font-serif text-white mb-2">Demo Database Beheer</h2>
          <p className="text-slate-400">
            Beheer de testdata in uw lokale omgeving.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Option 1: Incremental Add */}
          <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-colors group">
             <div className="flex justify-center mb-4 text-emerald-500 group-hover:scale-110 transition-transform">
               <Plus size={32} />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Data Toevoegen</h3>
             <p className="text-xs text-slate-500 mb-6 min-h-[40px]">
               Genereer 10 extra reserveringen bovenop de huidige data.
             </p>
             <Button 
               onClick={handleAddData} 
               disabled={isLoading}
               className="w-full bg-slate-800 hover:bg-slate-700 border-slate-700"
             >
               {isLoading ? 'Bezig...' : '+10 Boekingen'}
             </Button>
          </div>

          {/* Option 2: Full Reset */}
          <div className="p-6 bg-red-950/10 rounded-xl border border-red-900/30 hover:border-red-500/50 transition-colors group">
             <div className="flex justify-center mb-4 text-red-500 group-hover:scale-110 transition-transform">
               <RefreshCw size={32} />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Harde Reset</h3>
             <p className="text-xs text-slate-500 mb-6 min-h-[40px]">
               Wis alles en herstel de database naar de beginstaat. 
             </p>
             <Button 
               onClick={handleFullReset} 
               disabled={isLoading}
               className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800/50"
             >
               {isLoading ? 'Resetten...' : 'Volledige Reset'}
             </Button>
          </div>

        </div>

        <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-600 bg-black/20 p-2 rounded-lg">
          <AlertTriangle size={12} />
          <span>Wijzigingen zijn alleen lokaal in uw browser (localStorage).</span>
        </div>

      </Card>
    </div>
  );
};
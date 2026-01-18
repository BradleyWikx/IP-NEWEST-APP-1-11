
import React, { useState, useEffect } from 'react';
import { 
  Save, AlertTriangle, Users, Palette, Clock, 
  CheckCircle2, RefreshCw, Database, ShoppingBag, 
  Gift
} from 'lucide-react';
import { Button, Card, Input } from '../UI';
import { loadData, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';

// --- Types for Global Settings ---
interface GlobalSettings {
  capacityTarget: number;
  addonsThreshold: number;
  enableVouchers: boolean;
  enableMerchandise: boolean;
  enableWaitlist: boolean;
  timeFormat: '24h' | '12h';
  labels: {
    doorTime: string;
    startTime: string;
    endTime: string;
  };
  colors: {
    matinee: string;
    weekday: string;
    weekend: string;
    special: string;
  };
}

const DEFAULT_GLOBAL: GlobalSettings = {
  capacityTarget: 230,
  addonsThreshold: 25,
  enableVouchers: true,
  enableMerchandise: true,
  enableWaitlist: true,
  timeFormat: '24h',
  labels: {
    doorTime: 'Ontvangst',
    startTime: 'Start Show',
    endTime: 'Einde'
  },
  colors: {
    matinee: '#10b981', // emerald-500
    weekday: '#6366f1', // indigo-500
    weekend: '#f59e0b', // amber-500
    special: '#f43f5e', // rose-500
  }
};

const SETTINGS_KEY = 'grand_stage_global_settings';

export const SettingsManager = () => {
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);

  useEffect(() => {
    // Load Global
    setGlobalSettings(loadData<GlobalSettings>(SETTINGS_KEY, DEFAULT_GLOBAL));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
    
    saveData(SETTINGS_KEY, globalSettings);
    logAuditAction('UPDATE_GLOBAL_SETTINGS', 'SYSTEM', 'GLOBAL', {
      after: globalSettings,
      description: `Global settings updated. Sync existing: ${applyToExisting}`
    });

    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const updateGlobalNested = (category: keyof GlobalSettings, field: string, value: any) => {
    setGlobalSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as object),
        [field]: value
      }
    }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white">Instellingen</h2>
          <p className="text-slate-500 text-sm">Beheer globale systeem defaults.</p>
        </div>
        <div className="flex items-center space-x-4">
           {showSuccess && (
             <div className="flex items-center text-emerald-500 text-sm font-bold animate-in fade-in slide-in-from-right-4">
               <CheckCircle2 size={16} className="mr-2" /> Opgeslagen
             </div>
           )}
           <Button onClick={handleSave} disabled={isSaving} className="flex items-center min-w-[140px]">
             {isSaving ? 'Bezig...' : <><Save size={18} className="mr-2" /> Opslaan</>}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
          {/* Left Column: Core System */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-8 space-y-6">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                <Users size={14} className="mr-2"/> Capaciteit & Logica
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Input 
                     label="Standaard Capaciteit" 
                     type="number" 
                     value={globalSettings.capacityTarget} 
                     onChange={(e: any) => setGlobalSettings({...globalSettings, capacityTarget: parseInt(e.target.value) || 0})}
                   />
                   <p className="text-[10px] text-slate-500 italic">De standaard zaalbezetting voor nieuwe shows.</p>
                 </div>
                 <div className="space-y-2">
                   <Input 
                     label="Add-on Drempelwaarde" 
                     type="number" 
                     value={globalSettings.addonsThreshold} 
                     onChange={(e: any) => setGlobalSettings({...globalSettings, addonsThreshold: parseInt(e.target.value) || 0})}
                   />
                   <p className="text-[10px] text-slate-500 italic">Minimaal aantal personen voor dranken-arrangementen.</p>
                 </div>
              </div>
            </Card>

            <Card className="p-8 space-y-6">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                <RefreshCw size={14} className="mr-2"/> Functionaliteit
              </h3>
              
              <div className="space-y-4">
                {[
                  { key: 'enableVouchers', label: 'Vouchers Inschakelen', desc: 'Sta toe dat klanten vouchers gebruiken in de wizard.', icon: Gift },
                  { key: 'enableMerchandise', label: 'Merchandise Inschakelen', desc: 'Toon de souvenir-shop stap in het boekingsproces.', icon: ShoppingBag },
                  { key: 'enableWaitlist', label: 'Wachtlijst Inschakelen', desc: 'Activeer de wachtlijst-flow voor volgeboekte data.', icon: Clock },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setGlobalSettings({...globalSettings, [item.key]: !globalSettings[item.key as keyof GlobalSettings]})}
                      className={`w-12 h-6 rounded-full relative transition-colors ${globalSettings[item.key as keyof GlobalSettings] ? 'bg-emerald-500' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${globalSettings[item.key as keyof GlobalSettings] ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8 space-y-6">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                <Clock size={14} className="mr-2"/> Tijd & Labels
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input label="Label: Deur" value={globalSettings.labels.doorTime} onChange={(e: any) => updateGlobalNested('labels', 'doorTime', e.target.value)} />
                <Input label="Label: Start" value={globalSettings.labels.startTime} onChange={(e: any) => updateGlobalNested('labels', 'startTime', e.target.value)} />
                <Input label="Label: Einde" value={globalSettings.labels.endTime} onChange={(e: any) => updateGlobalNested('labels', 'endTime', e.target.value)} />
              </div>
            </Card>
          </div>

          {/* Right Column: Branding & Maintenance */}
          <div className="space-y-8">
            <Card className="p-8 space-y-6">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                <Palette size={14} className="mr-2"/> Kleurcodering
              </h3>
              <div className="space-y-4">
                {Object.entries(globalSettings.colors).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase capitalize">{key}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] font-mono text-slate-500">{value}</span>
                      <input 
                        type="color" 
                        value={value} 
                        onChange={(e) => updateGlobalNested('colors', key, e.target.value)}
                        className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer p-0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="bg-red-900/10 border border-red-900/50 p-6 rounded-2xl space-y-4">
              <div className="flex items-start space-x-3 text-red-500">
                 <AlertTriangle size={24} className="shrink-0" />
                 <h4 className="font-bold">Let op bij wijzigen</h4>
              </div>
              <p className="text-xs text-red-400 leading-relaxed">
                Wijzigingen in capaciteit of prijzen hebben direct invloed op nieuw aangemaakte data in de agenda.
              </p>
              <label className="flex items-center space-x-3 cursor-pointer group pt-2">
                <div 
                  onClick={() => setApplyToExisting(!applyToExisting)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${applyToExisting ? 'bg-red-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${applyToExisting ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white uppercase tracking-widest">Toepassen op bestaande data</span>
              </label>
            </div>

            <Card className="p-8 space-y-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                <Database size={14} className="mr-2"/> Systeem Onderhoud
              </h3>
              <button 
                onClick={() => { if(confirm('Systeemlogboeken wissen?')) logAuditAction('PURGE_LOGS', 'SYSTEM', 'GLOBAL', { description: 'Audit logs purged manually.' }); }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-red-950/20 hover:text-red-500 border border-slate-700 text-slate-400 text-xs font-bold rounded-xl transition-all"
              >
                Logboeken Wissen
              </button>
            </Card>
          </div>
        </div>
    </div>
  );
};

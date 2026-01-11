
import React, { useState, useEffect } from 'react';
import { 
  Save, AlertTriangle, Users, Gift, Palette, Clock, 
  Settings, CheckCircle2, Info, ToggleRight, Trash2,
  RefreshCw, Database, ShoppingBag, Ticket, Truck, Layers,
  Plus, X, Edit3, Lock, DollarSign
} from 'lucide-react';
import { Button, Card, Input } from '../UI';
import { loadData, saveData, STORAGE_KEYS, settingsRepo, getShowDefinitions } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { VoucherSaleConfig, VoucherProductDef, ShowDefinition } from '../../types';

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
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'VOUCHERS'>('GLOBAL');
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL);
  const [voucherConfig, setVoucherConfig] = useState<VoucherSaleConfig | null>(null);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);

  // Voucher Product Edit State
  const [editingProduct, setEditingProduct] = useState<Partial<VoucherProductDef> | null>(null);

  useEffect(() => {
    // Load Global
    setGlobalSettings(loadData<GlobalSettings>(SETTINGS_KEY, DEFAULT_GLOBAL));
    // Load Voucher Config
    setVoucherConfig(settingsRepo.getVoucherSaleConfig());
    // Load Shows for source definitions
    setShows(getShowDefinitions());
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
    
    if (activeTab === 'GLOBAL') {
      saveData(SETTINGS_KEY, globalSettings);
      logAuditAction('UPDATE_GLOBAL_SETTINGS', 'SYSTEM', 'GLOBAL', {
        after: globalSettings,
        description: `Global settings updated. Sync existing: ${applyToExisting}`
      });
    } else if (activeTab === 'VOUCHERS' && voucherConfig) {
      settingsRepo.updateVoucherSaleConfig(voucherConfig);
      logAuditAction('UPDATE_VOUCHER_CONFIG', 'SYSTEM', 'VOUCHERS', {
        description: 'Voucher sales configuration updated'
      });
    }

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

  // --- Voucher Config Helpers ---

  const addVoucherProduct = () => {
    setEditingProduct({
      id: `VP-${Date.now()}`,
      label: '',
      description: '',
      price: 50,
      active: true
    });
  };

  const saveVoucherProduct = () => {
    if (!voucherConfig || !editingProduct) return;
    
    const newProduct = editingProduct as VoucherProductDef;
    const exists = voucherConfig.products.find(p => p.id === newProduct.id);
    
    let updatedProducts;
    if (exists) {
      updatedProducts = voucherConfig.products.map(p => p.id === newProduct.id ? newProduct : p);
    } else {
      updatedProducts = [...voucherConfig.products, newProduct];
    }

    setVoucherConfig({ ...voucherConfig, products: updatedProducts });
    setEditingProduct(null);
  };

  const deleteVoucherProduct = (id: string) => {
    if (!voucherConfig) return;
    setVoucherConfig({
      ...voucherConfig,
      products: voucherConfig.products.filter(p => p.id !== id)
    });
  };

  const prefillFromProfile = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val || !editingProduct) return;
    
    // Parse combined ID "showId:profileId"
    const [showId, profileId] = val.split(':');
    const show = shows.find(s => s.id === showId);
    const profile = show?.profiles.find(p => p.id === profileId);

    if (profile) {
      setEditingProduct({
        ...editingProduct,
        label: `${profile.name} Voucher`,
        description: `Tegoedbon voor 1 persoon (${profile.name}).`,
        price: profile.pricing.standard
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white">Instellingen</h2>
          <p className="text-slate-500 text-sm">Beheer globale defaults en verkoopmodules.</p>
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

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('GLOBAL')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'GLOBAL' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Algemeen
        </button>
        <button 
          onClick={() => setActiveTab('VOUCHERS')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'VOUCHERS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Theaterbonnen Verkoop
        </button>
      </div>

      {/* --- GLOBAL SETTINGS TAB --- */}
      {activeTab === 'GLOBAL' && (
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
      )}

      {/* --- VOUCHER SALES CONFIG TAB --- */}
      {activeTab === 'VOUCHERS' && voucherConfig && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Main Toggle */}
          <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between">
             <div className="flex items-center space-x-4">
               <div className={`p-3 rounded-full ${voucherConfig.isEnabled ? 'bg-emerald-900/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                 <Gift size={24} />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Theaterbonnen Verkoop</h3>
                 <p className="text-slate-500 text-xs">Schakel de publieke verkoop pagina voor cadeaukaarten in of uit.</p>
               </div>
             </div>
             <button 
                onClick={() => setVoucherConfig({...voucherConfig, isEnabled: !voucherConfig.isEnabled})}
                className={`w-14 h-8 rounded-full relative transition-colors ${voucherConfig.isEnabled ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'}`}
             >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${voucherConfig.isEnabled ? 'left-7' : 'left-1'}`} />
             </button>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Col: Products */}
            <div className="space-y-8">
              <Card className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                    <Ticket size={14} className="mr-2"/> Arrangement Producten
                  </h3>
                  <Button variant="secondary" onClick={addVoucherProduct} className="text-xs h-8 px-3">
                    <Plus size={14} className="mr-1"/> Toevoegen
                  </Button>
                </div>

                <div className="space-y-3">
                  {voucherConfig.products.map(product => (
                    <div key={product.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center group">
                       <div>
                         <p className="text-white font-bold text-sm">{product.label}</p>
                         <p className="text-slate-500 text-xs truncate max-w-[200px]">{product.description}</p>
                         <p className="text-amber-500 font-mono text-xs mt-1">€{product.price.toFixed(2)}</p>
                       </div>
                       <div className="flex space-x-2 opacity-50 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingProduct(product)} className="p-2 bg-slate-900 rounded hover:text-white text-slate-400"><Edit3 size={14}/></button>
                         <button onClick={() => deleteVoucherProduct(product.id)} className="p-2 bg-slate-900 rounded hover:text-red-500 text-slate-400"><Trash2 size={14}/></button>
                       </div>
                    </div>
                  ))}
                  {voucherConfig.products.length === 0 && (
                    <p className="text-slate-500 text-xs italic text-center py-4">Nog geen producten geconfigureerd.</p>
                  )}
                </div>
              </Card>

              <Card className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                    <DollarSign size={14} className="mr-2"/> Vrij Bedrag
                  </h3>
                  <button 
                    onClick={() => setVoucherConfig({
                      ...voucherConfig, 
                      freeAmount: { ...voucherConfig.freeAmount, enabled: !voucherConfig.freeAmount.enabled }
                    })}
                    className={`w-10 h-6 rounded-full relative transition-colors ${voucherConfig.freeAmount.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.freeAmount.enabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                
                <div className={`grid grid-cols-3 gap-4 ${!voucherConfig.freeAmount.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                   <Input 
                     label="Min (€)" type="number" 
                     value={voucherConfig.freeAmount.min}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, min: parseInt(e.target.value)}})}
                   />
                   <Input 
                     label="Max (€)" type="number" 
                     value={voucherConfig.freeAmount.max}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, max: parseInt(e.target.value)}})}
                   />
                   <Input 
                     label="Stap (€)" type="number" 
                     value={voucherConfig.freeAmount.step}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, step: parseInt(e.target.value)}})}
                   />
                </div>
              </Card>
            </div>

            {/* Right Col: Rules & Delivery */}
            <div className="space-y-8">
              <Card className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                  <Layers size={14} className="mr-2"/> Bundeling
                </h3>
                
                <div className="flex items-start justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
                   <div className="pr-4">
                     <p className="text-white font-bold text-sm mb-1">Gecombineerde Uitgifte Toestaan</p>
                     <p className="text-slate-500 text-xs leading-relaxed">
                       Indien ingeschakeld kan de klant kiezen om alle items in de winkelwagen samen te voegen tot één voucher met de totaalwaarde.
                     </p>
                   </div>
                   <button 
                      onClick={() => setVoucherConfig({
                        ...voucherConfig, 
                        bundling: { ...voucherConfig.bundling, allowCombinedIssuance: !voucherConfig.bundling.allowCombinedIssuance }
                      })}
                      className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${voucherConfig.bundling.allowCombinedIssuance ? 'bg-emerald-500' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.bundling.allowCombinedIssuance ? 'left-5' : 'left-1'}`} />
                    </button>
                </div>
              </Card>

              <Card className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                  <Truck size={14} className="mr-2"/> Verzending & Kosten
                </h3>

                {/* Pickup (ReadOnly/Info) */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                   <span className="text-sm text-slate-300">Fysiek Ophalen</span>
                   <span className="text-xs font-bold text-emerald-500 uppercase">Gratis</span>
                </div>

                {/* Digital (ReadOnly/Info) */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                   <div className="flex items-center">
                     <span className="text-sm text-slate-300 mr-2">Digitaal (E-mail)</span>
                     <Lock size={12} className="text-slate-600" title="Fixed system fee"/>
                   </div>
                   <span className="text-xs font-bold text-slate-300 uppercase">€{voucherConfig.delivery.digitalFee.toFixed(2)}</span>
                </div>

                {/* Shipping */}
                <div className="flex items-center justify-between pt-2">
                   <div className="flex items-center space-x-3">
                     <button 
                        onClick={() => setVoucherConfig({
                          ...voucherConfig, 
                          delivery: { ...voucherConfig.delivery, shipping: { ...voucherConfig.delivery.shipping, enabled: !voucherConfig.delivery.shipping.enabled } }
                        })}
                        className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${voucherConfig.delivery.shipping.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.delivery.shipping.enabled ? 'left-5' : 'left-1'}`} />
                      </button>
                      <span className="text-sm text-slate-300">Postverzending</span>
                   </div>
                   
                   <div className={`flex items-center space-x-2 ${!voucherConfig.delivery.shipping.enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                     <span className="text-xs text-slate-500">Tarief €</span>
                     <Input 
                       type="number" 
                       className="w-20 text-right h-8 py-1"
                       value={voucherConfig.delivery.shipping.fee}
                       onChange={(e: any) => setVoucherConfig({
                         ...voucherConfig, 
                         delivery: { ...voucherConfig.delivery, shipping: { ...voucherConfig.delivery.shipping, fee: parseFloat(e.target.value) } }
                       })}
                     />
                   </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Product Editor Drawer (Nested) */}
          {editingProduct && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Voucher Product</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={20} className="text-slate-500 hover:text-white"/></button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    {/* Source Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bron (Optioneel)</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 outline-none"
                        onChange={prefillFromProfile}
                        defaultValue=""
                      >
                        <option value="" disabled>Kopieer van Show Profiel...</option>
                        {shows.map(show => (
                          <optgroup key={show.id} label={show.name}>
                            {show.profiles.map(p => (
                              <option key={p.id} value={`${show.id}:${p.id}`}>{p.name} (€{p.pricing.standard})</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <Input 
                      label="Label" 
                      value={editingProduct.label} 
                      onChange={(e: any) => setEditingProduct({...editingProduct, label: e.target.value})}
                      placeholder="Bijv. Premium Arrangement"
                    />
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Omschrijving</label>
                      <textarea 
                        className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none"
                        value={editingProduct.description}
                        onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                      />
                    </div>

                    <Input 
                      label="Prijs (€)" 
                      type="number"
                      value={editingProduct.price} 
                      onChange={(e: any) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                    />
                  </div>

                  <div className="p-4 border-t border-slate-800 flex justify-end space-x-2">
                    <Button variant="ghost" onClick={() => setEditingProduct(null)}>Annuleren</Button>
                    <Button onClick={saveVoucherProduct}>Opslaan</Button>
                  </div>
               </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { 
  Tag, Plus, Trash2, Edit3, Save, X, Percent, DollarSign, 
  Users, CheckCircle2, AlertCircle, Copy, Calendar
} from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { PromoCodeRule, DiscountKind, PromoScope } from '../../types';
import { promoRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { ResponsiveTable } from '../ResponsiveTable';

export const PromoManager = () => {
  const [promos, setPromos] = useState<PromoCodeRule[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCodeRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setPromos(promoRepo.getAll());
  };

  const handleCreate = () => {
    setEditingPromo({
      id: `PROMO-${Date.now()}`,
      code: '',
      label: '',
      enabled: true,
      kind: DiscountKind.PERCENTAGE,
      scope: PromoScope.ARRANGEMENT_ONLY,
      percentage: 10,
      allowWithVoucher: true,
      allowStacking: false,
      constraints: {},
      invitedConfig: {
        freeArrangementsMode: 'ALL',
        eligibleArrangement: 'ANY'
      }
    });
    setError(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (promo: PromoCodeRule) => {
    setEditingPromo({ ...promo });
    setError(null);
    setIsDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Zeker weten?')) {
      promoRepo.delete(id);
      logAuditAction('DELETE_PROMO', 'SYSTEM', id, { description: 'Deleted promo code' });
    }
  };

  const handleSave = () => {
    if (!editingPromo) return;
    
    if (!editingPromo.code || !editingPromo.label) {
      setError("Code en Label zijn verplicht.");
      return;
    }

    // Check Duplicate Code (if new or changed)
    const existing = promos.find(p => p.code.toUpperCase() === editingPromo.code.toUpperCase() && p.id !== editingPromo.id);
    if (existing) {
      setError("Deze code bestaat al.");
      return;
    }

    const isNew = !promos.find(p => p.id === editingPromo.id);
    
    // Ensure cleanup of unused fields based on Kind
    const cleanPromo = { ...editingPromo };
    if (cleanPromo.kind !== DiscountKind.FIXED_PER_PERSON) delete cleanPromo.fixedAmountPerPerson;
    if (cleanPromo.kind !== DiscountKind.PERCENTAGE) delete cleanPromo.percentage;
    if (cleanPromo.kind !== DiscountKind.FIXED_TOTAL) delete cleanPromo.fixedAmountTotal;
    if (cleanPromo.kind !== DiscountKind.INVITED_COMP) delete cleanPromo.invitedConfig;

    if (isNew) {
      promoRepo.add(cleanPromo);
    } else {
      promoRepo.update(cleanPromo.id, () => cleanPromo);
    }

    logAuditAction(isNew ? 'CREATE_PROMO' : 'UPDATE_PROMO', 'SYSTEM', cleanPromo.id, {
      description: `Saved promo code ${cleanPromo.code}`,
      after: cleanPromo
    });

    setIsDrawerOpen(false);
    setEditingPromo(null);
  };

  const getKindLabel = (kind: DiscountKind) => {
    switch(kind) {
      case DiscountKind.PERCENTAGE: return 'Percentage';
      case DiscountKind.FIXED_PER_PERSON: return 'Vast Bedrag p.p.';
      case DiscountKind.FIXED_TOTAL: return 'Vast Bedrag Totaal';
      case DiscountKind.INVITED_COMP: return 'Vrijkaarten (Invited)';
      default: return kind;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Promotie Codes</h2>
          <p className="text-slate-500 text-sm">Beheer kortingsacties en gastenlijst codes.</p>
        </div>
        <Button onClick={handleCreate} className="flex items-center">
          <Plus size={18} className="mr-2" /> Nieuwe Code
        </Button>
      </div>

      <ResponsiveTable
        data={promos}
        keyExtractor={p => p.id}
        columns={[
          { header: 'Code', accessor: (p: PromoCodeRule) => <span className="font-mono font-bold text-amber-500 text-lg">{p.code}</span> },
          { header: 'Label', accessor: (p: PromoCodeRule) => <span className="font-bold text-white">{p.label}</span> },
          { header: 'Type', accessor: (p: PromoCodeRule) => <span className="text-xs uppercase bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-400">{getKindLabel(p.kind)}</span> },
          { header: 'Waarde', accessor: (p: PromoCodeRule) => {
             if (p.percentage) return <span className="text-emerald-500 font-bold">{p.percentage}%</span>;
             if (p.fixedAmountPerPerson) return <span className="text-emerald-500 font-bold">€{p.fixedAmountPerPerson} p.p.</span>;
             if (p.fixedAmountTotal) return <span className="text-emerald-500 font-bold">€{p.fixedAmountTotal}</span>;
             if (p.kind === DiscountKind.INVITED_COMP) return <span className="text-purple-500 font-bold">Gratis</span>;
             return '-';
          }},
          { header: 'Status', accessor: (p: PromoCodeRule) => <Badge status={p.enabled ? 'CONFIRMED' : 'CANCELLED'}>{p.enabled ? 'Actief' : 'Inactief'}</Badge> },
          { header: 'Acties', accessor: (p: PromoCodeRule) => (
            <div className="flex space-x-2 justify-end">
              <Button variant="ghost" onClick={() => handleEdit(p)} className="h-8 w-8 p-0 text-slate-400 hover:text-white"><Edit3 size={16}/></Button>
              <Button variant="ghost" onClick={() => handleDelete(p.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"><Trash2 size={16}/></Button>
            </div>
          )}
        ]}
      />

      <ResponsiveDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Promotie Bewerken">
        {editingPromo && (
          <div className="space-y-8 pb-12">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center">
                <AlertCircle size={16} className="mr-2 shrink-0" /> {error}
              </div>
            )}

            {/* Core Info */}
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Code (Hoofdletters)" value={editingPromo.code} onChange={(e: any) => setEditingPromo({...editingPromo, code: e.target.value.toUpperCase()})} placeholder="ZOMER2025" />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type Korting</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                    value={editingPromo.kind}
                    onChange={(e) => setEditingPromo({...editingPromo, kind: e.target.value as DiscountKind})}
                  >
                    <option value={DiscountKind.PERCENTAGE}>Percentage</option>
                    <option value={DiscountKind.FIXED_PER_PERSON}>Vast bedrag per persoon</option>
                    <option value={DiscountKind.FIXED_TOTAL}>Vast bedrag op totaal</option>
                    <option value={DiscountKind.INVITED_COMP}>Vrijkaarten (Invited)</option>
                  </select>
                </div>
              </div>
              <Input label="Label (Zichtbaar voor klant)" value={editingPromo.label} onChange={(e: any) => setEditingPromo({...editingPromo, label: e.target.value})} placeholder="Zomerdeal" />
            </section>

            {/* Dynamic Value Inputs */}
            <section className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
               {editingPromo.kind === DiscountKind.PERCENTAGE && (
                 <Input label="Percentage (%)" type="number" value={editingPromo.percentage || 0} onChange={(e: any) => setEditingPromo({...editingPromo, percentage: parseFloat(e.target.value)})} />
               )}
               {editingPromo.kind === DiscountKind.FIXED_PER_PERSON && (
                 <Input label="Bedrag per persoon (€)" type="number" value={editingPromo.fixedAmountPerPerson || 0} onChange={(e: any) => setEditingPromo({...editingPromo, fixedAmountPerPerson: parseFloat(e.target.value)})} />
               )}
               {editingPromo.kind === DiscountKind.FIXED_TOTAL && (
                 <Input label="Totaalbedrag (€)" type="number" value={editingPromo.fixedAmountTotal || 0} onChange={(e: any) => setEditingPromo({...editingPromo, fixedAmountTotal: parseFloat(e.target.value)})} />
               )}
               {editingPromo.kind === DiscountKind.INVITED_COMP && editingPromo.invitedConfig && (
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modus</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                        value={editingPromo.invitedConfig.freeArrangementsMode}
                        onChange={(e: any) => setEditingPromo({...editingPromo, invitedConfig: { ...editingPromo.invitedConfig!, freeArrangementsMode: e.target.value }})}
                      >
                        <option value="ALL">Iedereen Gratis</option>
                        <option value="COUNT">Eerste X Gratis</option>
                      </select>
                    </div>
                    {editingPromo.invitedConfig.freeArrangementsMode === 'COUNT' && (
                      <Input label="Aantal Vrijkaarten" type="number" value={editingPromo.invitedConfig.freeCount || 2} onChange={(e: any) => setEditingPromo({...editingPromo, invitedConfig: { ...editingPromo.invitedConfig!, freeCount: parseInt(e.target.value) }})} />
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Geldig op Arrangement</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                        value={editingPromo.invitedConfig.eligibleArrangement}
                        onChange={(e: any) => setEditingPromo({...editingPromo, invitedConfig: { ...editingPromo.invitedConfig!, eligibleArrangement: e.target.value }})}
                      >
                        <option value="ANY">Elk Arrangement</option>
                        <option value="STANDARD">Alleen Standard</option>
                        <option value="PREMIUM">Alleen Premium</option>
                      </select>
                    </div>
                 </div>
               )}
            </section>

            {/* Scope & Rules */}
            <section className="space-y-4">
               <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center border-b border-slate-800 pb-2">
                 <Copy size={14} className="mr-2" /> Regels
               </h4>
               
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scope</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                      value={editingPromo.scope}
                      onChange={(e: any) => setEditingPromo({...editingPromo, scope: e.target.value})}
                    >
                      <option value="ARRANGEMENT_ONLY">Alleen op Entree</option>
                      <option value="ENTIRE_BOOKING">Gehele Boeking (incl extra's)</option>
                    </select>
                 </div>
                 <div className="flex items-end pb-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={editingPromo.enabled} onChange={(e) => setEditingPromo({...editingPromo, enabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700" />
                      <span className="text-sm font-bold text-white">Actief</span>
                    </label>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <Input label="Min. Personen" type="number" value={editingPromo.constraints?.minPartySize || ''} onChange={(e: any) => setEditingPromo({...editingPromo, constraints: { ...editingPromo.constraints, minPartySize: parseInt(e.target.value) || undefined }})} />
                 <Input label="Max. Personen" type="number" value={editingPromo.constraints?.maxPartySize || ''} onChange={(e: any) => setEditingPromo({...editingPromo, constraints: { ...editingPromo.constraints, maxPartySize: parseInt(e.target.value) || undefined }})} />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <Input label="Geldig Vanaf" type="date" value={editingPromo.constraints?.validFrom || ''} onChange={(e: any) => setEditingPromo({...editingPromo, constraints: { ...editingPromo.constraints, validFrom: e.target.value }})} />
                 <Input label="Geldig Tot" type="date" value={editingPromo.constraints?.validUntil || ''} onChange={(e: any) => setEditingPromo({...editingPromo, constraints: { ...editingPromo.constraints, validUntil: e.target.value }})} />
               </div>
            </section>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>Annuleren</Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Opslaan</Button>
            </div>
          </div>
        )}
      </ResponsiveDrawer>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Save, X, ChevronRight, 
  Search, Calendar, Clock, DollarSign, Tag, Image as ImageIcon,
  MoreHorizontal, CheckCircle2, AlertCircle, Copy, Info
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { ShowDefinition, ShowProfile } from '../../types';
import { getShowDefinitions, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { undoManager } from '../../utils/undoManager';

// --- Price Profile Editor Component ---

interface PriceProfileEditorProps {
  profile: ShowProfile;
  onChange: (updated: ShowProfile) => void;
  onDelete: () => void;
  isNew?: boolean;
}

const PriceProfileEditor: React.FC<PriceProfileEditorProps> = ({ profile, onChange, onDelete, isNew }) => {
  const [isOpen, setIsOpen] = useState(isNew);

  const update = (field: string, value: any) => onChange({ ...profile, [field]: value });
  const updateTiming = (field: string, value: any) => onChange({ ...profile, timing: { ...profile.timing, [field]: value } });
  const updatePricing = (field: string, value: any) => onChange({ ...profile, pricing: { ...profile.pricing, [field]: parseFloat(value) || 0 } });

  const COLORS = ['emerald', 'indigo', 'amber', 'rose', 'blue', 'purple', 'slate'];

  return (
    <div className="bg-black/20 border border-slate-800 rounded-xl overflow-hidden mb-4">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full bg-${profile.color}-500 shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
          <span className="font-bold text-white text-sm">{profile.name || 'Nieuw Profiel'}</span>
          <span className="text-xs text-slate-500 border-l border-slate-700 pl-3">
             {profile.timing.startTime} Start • €{profile.pricing.standard} Base
          </span>
        </div>
        <div className="flex items-center space-x-2">
           <Button variant="ghost" onClick={(e: any) => { e.stopPropagation(); onDelete(); }} className="h-8 w-8 p-0 text-slate-500 hover:text-red-500">
             <Trash2 size={14} />
           </Button>
           <ChevronRight size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="p-6 border-t border-slate-800 space-y-6 animate-in slide-in-from-top-2">
           <div className="grid grid-cols-2 gap-4">
             <Input label="Profiel Naam" value={profile.name} onChange={(e: any) => update('name', e.target.value)} placeholder="Bijv. Matinee" />
             <div className="space-y-1.5">
               <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Kleur Label</label>
               <div className="flex space-x-2">
                 {COLORS.map(c => (
                   <button 
                     key={c} 
                     type="button"
                     onClick={() => update('color', c)}
                     className={`w-8 h-8 rounded-full border-2 transition-all ${profile.color === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'} bg-${c}-500`}
                   />
                 ))}
               </div>
             </div>
           </div>

           <div className="grid grid-cols-3 gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <Input type="time" label="Deuren Open" value={profile.timing.doorTime} onChange={(e: any) => updateTiming('doorTime', e.target.value)} />
              <Input type="time" label="Start Show" value={profile.timing.startTime} onChange={(e: any) => updateTiming('startTime', e.target.value)} />
              <Input type="time" label="Einde Show" value={profile.timing.endTime} onChange={(e: any) => updateTiming('endTime', e.target.value)} />
           </div>

           <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Prijzen per persoon</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Input type="number" label="Standard" value={profile.pricing.standard} onChange={(e: any) => updatePricing('standard', e.target.value)} />
                 <Input type="number" label="Premium" value={profile.pricing.premium} onChange={(e: any) => updatePricing('premium', e.target.value)} />
                 <Input type="number" label="Addon: Pre-Drink" value={profile.pricing.addonPreDrink} onChange={(e: any) => updatePricing('addonPreDrink', e.target.value)} />
                 <Input type="number" label="Addon: After-Drink" value={profile.pricing.addonAfterDrink} onChange={(e: any) => updatePricing('addonAfterDrink', e.target.value)} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// --- Show Editor Drawer ---

interface ShowEditorProps {
  show: ShowDefinition | null;
  onSave: (show: ShowDefinition) => void;
  onClose: () => void;
}

const INITIAL_PROFILE: ShowProfile = {
  id: '',
  name: 'Avondvoorstelling',
  color: 'indigo',
  timing: { doorTime: '18:30', startTime: '19:30', endTime: '22:30' },
  pricing: { standard: 55, premium: 85, addonPreDrink: 12.50, addonAfterDrink: 15.00 }
};

const ShowEditorDrawer = ({ show, onSave, onClose }: ShowEditorProps) => {
  const [formData, setFormData] = useState<ShowDefinition>(
    show ? JSON.parse(JSON.stringify(show)) : {
      id: '',
      name: '',
      description: '',
      activeFrom: new Date().toISOString().split('T')[0],
      activeTo: '',
      isActive: true,
      tags: [],
      profiles: []
    }
  );
  const [tagsInput, setTagsInput] = useState(show?.tags.join(', ') || '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!formData.name || !formData.activeFrom) {
      setError("Naam en startdatum zijn verplicht.");
      return;
    }
    if (formData.profiles.length === 0) {
      setError("Voeg minimaal één prijsprofiel toe.");
      return;
    }

    onSave({
      ...formData,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  const addProfile = () => {
    setFormData({
      ...formData,
      profiles: [
        ...formData.profiles,
        { ...INITIAL_PROFILE, id: `PROF-${Date.now()}` }
      ]
    });
  };

  const updateProfile = (index: number, updated: ShowProfile) => {
    const newProfiles = [...formData.profiles];
    newProfiles[index] = updated;
    setFormData({ ...formData, profiles: newProfiles });
  };

  const deleteProfile = (index: number) => {
    if (confirm('Profiel verwijderen?')) {
        setFormData({
        ...formData,
        profiles: formData.profiles.filter((_, i) => i !== index)
        });
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full md:w-[800px] bg-slate-950 border-l border-slate-900 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-900 flex justify-between items-center bg-slate-900/50">
           <div>
             <h2 className="text-2xl font-serif text-white">{show ? 'Bewerk Show' : 'Nieuwe Show'}</h2>
             <p className="text-slate-500 text-sm">Definieer algemene info en prijsprofielen.</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white"><X size={24}/></button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8">
           {error && (
             <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-500 flex items-center text-sm font-bold">
               <AlertCircle size={18} className="mr-2" /> {error}
             </div>
           )}

           {/* General Info */}
           <section className="space-y-4">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center"><Tag size={14} className="mr-2"/> Algemene Informatie</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                   <Input label="Show Naam *" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} placeholder="Bijv. The Great Gatsby" />
                 </div>
                 
                 <div className="md:col-span-2">
                   <label className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1.5 block">Beschrijving</label>
                   <textarea 
                     className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none"
                     value={formData.description}
                     onChange={(e) => setFormData({...formData, description: e.target.value})}
                   />
                 </div>

                 {/* Explicit Show Image URL Input */}
                 <div className="md:col-span-2 bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <Input 
                      label="Afbeelding URL (Poster / Logo)" 
                      value={formData.posterImage || ''} 
                      onChange={(e: any) => setFormData({...formData, posterImage: e.target.value})} 
                      placeholder="https://..." 
                    />
                    <div className="mt-3 flex items-start space-x-2 text-slate-500">
                      <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="text-[10px] leading-relaxed">
                        <p className="mb-1">Plak hier een directe link naar de afbeelding.</p>
                        <p>
                          <span className="text-amber-500 font-bold uppercase">Aanbevolen formaat:</span> 
                          <span className="text-slate-300 ml-1">1920x1080px (16:9)</span> of minimaal <span className="text-slate-300">1200px breed</span>.
                        </p>
                      </div>
                    </div>
                 </div>

                 <Input type="date" label="Actief Vanaf *" value={formData.activeFrom} onChange={(e: any) => setFormData({...formData, activeFrom: e.target.value})} />
                 <Input type="date" label="Actief Tot" value={formData.activeTo} onChange={(e: any) => setFormData({...formData, activeTo: e.target.value})} />

                 <div className="md:col-span-2">
                   <Input label="Tags (komma gescheiden)" value={tagsInput} onChange={(e: any) => setTagsInput(e.target.value)} placeholder="Drama, Muziek, Gala" />
                 </div>
              </div>
           </section>

           {/* Status Toggle */}
           <section className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <p className="text-white font-bold text-sm">Show Activeren</p>
                <p className="text-xs text-slate-500">Indien uitgeschakeld is deze show niet zichtbaar in de planning.</p>
              </div>
              <div 
                 onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                 className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isActive ? 'left-7' : 'left-1'}`} />
              </div>
           </section>

           {/* Profiles Section */}
           <section className="space-y-4 pt-4 border-t border-slate-900">
              <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center"><DollarSign size={14} className="mr-2"/> Prijs Profielen</h3>
                 <Button variant="secondary" onClick={addProfile} className="text-xs py-1.5 h-8">
                   <Plus size={14} className="mr-1" /> Profiel Toevoegen
                 </Button>
              </div>

              {formData.profiles.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                  Nog geen profielen. Voeg een profiel toe (bijv. Matinee, Avond) om prijzen te bepalen.
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.profiles.map((profile, idx) => (
                    <PriceProfileEditor 
                      key={profile.id || idx} 
                      profile={profile} 
                      onChange={(updated) => updateProfile(idx, updated)}
                      onDelete={() => deleteProfile(idx)}
                      isNew={!show && idx === formData.profiles.length - 1} // Auto open new profiles if creating fresh
                    />
                  ))}
                </div>
              )}
           </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-900 bg-slate-900/50 flex justify-end space-x-4">
           <Button variant="ghost" onClick={onClose}>Annuleren</Button>
           <Button onClick={handleSave} className="flex items-center"><Save size={18} className="mr-2"/> Opslaan</Button>
        </div>
      </div>
    </>
  );
};

// --- Main Page Component ---

export const ShowsManager = () => {
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<ShowDefinition | null>(null);

  const loadShows = () => {
    setShows(getShowDefinitions());
  };

  useEffect(() => {
    loadShows();
  }, []);

  const handleSaveShow = (show: ShowDefinition) => {
    const isNew = !show.id;
    const toSave = { 
      ...show, 
      id: show.id || `SHOW-${Date.now()}` 
    };

    let updatedList;
    if (isNew) {
      updatedList = [...shows, toSave];
    } else {
      updatedList = shows.map(s => s.id === toSave.id ? toSave : s);
    }

    saveData(STORAGE_KEYS.SHOWS, updatedList);
    setShows(updatedList);
    setIsDrawerOpen(false);
    setEditingShow(null);
    
    logAuditAction(isNew ? 'CREATE_SHOW' : 'UPDATE_SHOW', 'SYSTEM', toSave.id, {
      description: `Saved show definition: ${toSave.name}`,
      after: toSave
    });
    undoManager.showSuccess("Show opgeslagen.");
  };

  const handleDeleteShow = (id: string) => {
    if (confirm("Weet u zeker dat u deze show en alle profielen wilt verwijderen?")) {
      const updatedList = shows.filter(s => s.id !== id);
      saveData(STORAGE_KEYS.SHOWS, updatedList);
      setShows(updatedList);
      logAuditAction('DELETE_SHOW', 'SYSTEM', id, { description: 'Deleted show definition' });
      undoManager.showSuccess("Show verwijderd.");
    }
  };

  const filteredShows = shows.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Shows Bibliotheek</h2>
          <p className="text-slate-500 text-sm">Beheer producties, prijzen en tijdschema's.</p>
        </div>
        <Button onClick={() => { setEditingShow(null); setIsDrawerOpen(true); }} className="flex items-center">
          <Plus size={18} className="mr-2" /> Nieuwe Show
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-slate-900/50 flex items-center space-x-4">
         <div className="relative flex-grow">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
           <input 
             className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
             placeholder="Zoek show op naam..."
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
         </div>
      </Card>

      {/* Show List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredShows.length === 0 ? (
          <div className="text-center p-12 bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl text-slate-500">
             <Calendar size={32} className="mx-auto mb-4 opacity-50"/>
             <p>Geen shows gevonden. Maak een nieuwe aan om te beginnen.</p>
          </div>
        ) : (
          filteredShows.map(show => (
            <Card key={show.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-slate-600 transition-colors">
               <div className="flex items-start space-x-6">
                  <div className="w-16 h-16 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-slate-700 overflow-hidden relative">
                    {show.posterImage ? (
                      <img src={show.posterImage} alt={show.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">{show.name}</h3>
                      {show.isActive ? (
                        <span className="flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50 uppercase tracking-wide">
                          <CheckCircle2 size={10} className="mr-1"/> Actief
                        </span>
                      ) : (
                        <span className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 uppercase tracking-wide">
                          Inactief
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                       <span className="flex items-center"><Calendar size={12} className="mr-1"/> {show.activeFrom} t/m {show.activeTo || '∞'}</span>
                       <span className="flex items-center"><Tag size={12} className="mr-1"/> {show.profiles.length} Profielen</span>
                    </div>
                  </div>
               </div>

               <div className="flex items-center space-x-3 mt-4 md:mt-0">
                  <div className="flex -space-x-2 mr-4">
                    {show.profiles.slice(0, 3).map((p, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 bg-${p.color}-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}>
                        {p.name.charAt(0)}
                      </div>
                    ))}
                    {show.profiles.length > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        +{show.profiles.length - 3}
                      </div>
                    )}
                  </div>
                  
                  <Button variant="secondary" onClick={() => { setEditingShow(show); setIsDrawerOpen(true); }} className="h-9 px-4 text-xs">
                    <Edit3 size={14} className="mr-2" /> Bewerken
                  </Button>
                  <Button variant="ghost" onClick={() => handleDeleteShow(show.id)} className="h-9 w-9 p-0 text-slate-500 hover:text-red-500">
                    <Trash2 size={16} />
                  </Button>
               </div>
            </Card>
          ))
        )}
      </div>

      {isDrawerOpen && (
        <ShowEditorDrawer 
          show={editingShow} 
          onSave={handleSaveShow} 
          onClose={() => { setIsDrawerOpen(false); setEditingShow(null); }} 
        />
      )}
    </div>
  );
};

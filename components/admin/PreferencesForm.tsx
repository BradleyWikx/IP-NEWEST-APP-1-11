
import React from 'react';
import { PrivateEventPreferences } from '../../types';
import { 
  PartyPopper, Utensils, Wine, Clock, Zap, Layout, 
  FileText, Mic, Music, Lightbulb, Projector
} from 'lucide-react';
import { Input } from '../UI';

interface PreferencesFormProps {
  data: PrivateEventPreferences;
  onChange: (updated: PrivateEventPreferences) => void;
}

export const PreferencesForm: React.FC<PreferencesFormProps> = ({ data, onChange }) => {
  
  const update = (field: keyof PrivateEventPreferences, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateTech = (key: keyof PrivateEventPreferences['techConfig'], value: boolean) => {
    onChange({
      ...data,
      techConfig: { ...data.techConfig, [key]: value }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Occasion */}
      <section className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
          <PartyPopper size={14} className="mr-2" /> Aanleiding
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold">Type Event</label>
            <select 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
              value={data.occasionType}
              onChange={(e) => update('occasionType', e.target.value)}
            >
              <option value="COMPANY">Bedrijfsevent</option>
              <option value="BIRTHDAY">Verjaardag</option>
              <option value="WEDDING">Bruiloft</option>
              <option value="OTHER">Anders</option>
            </select>
          </div>
          <Input 
            label="Details (Bijv. Jubileum Shell)" 
            value={data.occasionDetails || ''} 
            onChange={(e: any) => update('occasionDetails', e.target.value)} 
          />
        </div>
      </section>

      {/* F&B */}
      <section className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
          <Utensils size={14} className="mr-2" /> Food & Beverage
        </h4>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold flex items-center"><Wine size={12} className="mr-1"/> Bar Arrangement</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                  value={data.barType}
                  onChange={(e) => update('barType', e.target.value)}
                >
                  <option value="STANDARD">Standard (Bier/Fris/Wijn)</option>
                  <option value="PREMIUM">Premium (+ Sterk/Specials)</option>
                  <option value="NON_ALCOHOLIC">Alleen Alcoholvrij</option>
                  <option value="CASH">Cash Bar / Op nacalculatie</option>
                  <option value="NONE">Geen (Self-Service/Dry)</option>
                </select>
             </div>
             <Input label="Bar Notities" placeholder="Bijv. Signature Cocktail..." value={data.barNotes || ''} onChange={(e: any) => update('barNotes', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold">Dieetwensen & Catering</label>
            <textarea 
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none resize-none"
              placeholder="Bijv. 5x Vegetarisch, 1x Gluten..."
              value={data.dietary || ''}
              onChange={(e) => update('dietary', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Operations */}
      <section className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
          <Clock size={14} className="mr-2" /> Planning & Opzet
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold">Draaiboek Notities</label>
            <textarea 
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none resize-none"
              placeholder="18:00 Inloop, 19:00 Speech..."
              value={data.scheduleNotes || ''}
              onChange={(e) => update('scheduleNotes', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold flex items-center"><Layout size={12} className="mr-1"/> Zaalopstelling</label>
            <textarea 
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none resize-none"
              placeholder="U-vorm, theateropstelling, lange tafels..."
              value={data.setupNotes || ''}
              onChange={(e) => update('setupNotes', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Tech */}
      <section className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
          <Zap size={14} className="mr-2" /> Techniek
        </h4>
        
        <div className="flex flex-wrap gap-3 mb-3">
          <button 
            onClick={() => updateTech('mic', !data.techConfig.mic)}
            className={`flex items-center px-3 py-2 rounded-lg border text-xs font-bold transition-all ${data.techConfig.mic ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Mic size={14} className="mr-2" /> Microfoon
          </button>
          <button 
            onClick={() => updateTech('music', !data.techConfig.music)}
            className={`flex items-center px-3 py-2 rounded-lg border text-xs font-bold transition-all ${data.techConfig.music ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Music size={14} className="mr-2" /> Muziek/DJ
          </button>
          <button 
            onClick={() => updateTech('lights', !data.techConfig.lights)}
            className={`flex items-center px-3 py-2 rounded-lg border text-xs font-bold transition-all ${data.techConfig.lights ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Lightbulb size={14} className="mr-2" /> Lichtplan
          </button>
          <button 
            onClick={() => updateTech('projector', !data.techConfig.projector)}
            className={`flex items-center px-3 py-2 rounded-lg border text-xs font-bold transition-all ${data.techConfig.projector ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Projector size={14} className="mr-2" /> Projector
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-bold">Tech Specificaties</label>
          <input 
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 text-sm"
            placeholder="Bijv. HDMI kabel nodig op podium..."
            value={data.techNotes || ''}
            onChange={(e) => update('techNotes', e.target.value)}
          />
        </div>
      </section>

      {/* Internal */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
          <FileText size={14} className="mr-2" /> Interne Staff Info
        </h4>
        <textarea 
          className="w-full h-24 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none resize-none"
          placeholder="Instructies voor personeel, briefing notes..."
          value={data.internalNotes || ''}
          onChange={(e) => update('internalNotes', e.target.value)}
        />
      </section>
    </div>
  );
};

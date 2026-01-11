
import React from 'react';
import { PrivateEventPreferences } from '../../types';
import { 
  PartyPopper, Utensils, Wine, Clock, Zap, Layout, 
  FileText, Mic, Music, Lightbulb, Projector, Info
} from 'lucide-react';

interface PreferencesSummaryProps {
  data: PrivateEventPreferences;
  variant?: 'compact' | 'full';
  className?: string;
}

export const PreferencesSummary: React.FC<PreferencesSummaryProps> = ({ data, variant = 'compact', className = '' }) => {
  
  // Helpers
  const hasTech = data.techConfig.mic || data.techConfig.music || data.techConfig.lights || data.techConfig.projector;
  
  if (variant === 'compact') {
    return (
      <div className={`flex gap-2 text-slate-400 ${className}`}>
        {data.dietary && <Utensils size={12} className="text-amber-500" title="Dietary Requirements" />}
        {data.barType === 'PREMIUM' && <Wine size={12} className="text-purple-500" title="Premium Bar" />}
        {hasTech && <Zap size={12} className="text-blue-500" title="Tech Requirements" />}
        {data.scheduleNotes && <Clock size={12} title="Schedule Notes" />}
      </div>
    );
  }

  // Full View (Drawers / Print)
  return (
    <div className={`space-y-6 ${className}`}>
      
      {/* Occasion Header */}
      <div className="flex items-start space-x-3 pb-4 border-b border-slate-200/20">
        <div className="p-2 bg-purple-900/20 text-purple-500 rounded-lg">
          <PartyPopper size={20} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-white uppercase tracking-wide">
            {data.occasionType}
          </h4>
          {data.occasionDetails && <p className="text-sm text-slate-400 mt-1">{data.occasionDetails}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* F&B */}
        <div className="space-y-4">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
            <Utensils size={14} className="mr-2"/> Food & Bar
          </h5>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
             <div>
               <span className="text-xs text-slate-500 block mb-1">Bar Type</span>
               <span className="text-sm font-bold text-white">{data.barType}</span>
               {data.barNotes && <p className="text-xs text-slate-400 italic mt-1">"{data.barNotes}"</p>}
             </div>
             {data.dietary && (
               <div className="pt-2 border-t border-slate-800">
                 <span className="text-xs text-slate-500 block mb-1">Dieetwensen</span>
                 <p className="text-sm text-white">{data.dietary}</p>
               </div>
             )}
          </div>
        </div>

        {/* Tech */}
        <div className="space-y-4">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
            <Zap size={14} className="mr-2"/> Techniek
          </h5>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
             <div className="flex flex-wrap gap-2 mb-3">
               {data.techConfig.mic && <span className="px-2 py-1 bg-blue-900/20 text-blue-400 text-[10px] font-bold rounded border border-blue-900/50 flex items-center"><Mic size={10} className="mr-1"/> MIC</span>}
               {data.techConfig.music && <span className="px-2 py-1 bg-blue-900/20 text-blue-400 text-[10px] font-bold rounded border border-blue-900/50 flex items-center"><Music size={10} className="mr-1"/> MUSIC</span>}
               {data.techConfig.lights && <span className="px-2 py-1 bg-blue-900/20 text-blue-400 text-[10px] font-bold rounded border border-blue-900/50 flex items-center"><Lightbulb size={10} className="mr-1"/> LIGHTS</span>}
               {data.techConfig.projector && <span className="px-2 py-1 bg-blue-900/20 text-blue-400 text-[10px] font-bold rounded border border-blue-900/50 flex items-center"><Projector size={10} className="mr-1"/> BEAMER</span>}
               {!hasTech && <span className="text-xs text-slate-500 italic">Geen techniek vereist.</span>}
             </div>
             {data.techNotes && <p className="text-xs text-slate-400 border-t border-slate-800 pt-2">"{data.techNotes}"</p>}
          </div>
        </div>

        {/* Schedule & Setup */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
           {data.scheduleNotes && (
             <div className="space-y-2">
               <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Clock size={14} className="mr-2"/> Draaiboek</h5>
               <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap">
                 {data.scheduleNotes}
               </div>
             </div>
           )}
           {data.setupNotes && (
             <div className="space-y-2">
               <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Layout size={14} className="mr-2"/> Opstelling</h5>
               <div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap">
                 {data.setupNotes}
               </div>
             </div>
           )}
        </div>

        {/* Internal */}
        {data.internalNotes && (
          <div className="md:col-span-2 pt-4 border-t border-slate-800">
             <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded-xl flex items-start space-x-3">
               <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
               <div>
                 <h5 className="text-xs font-bold text-amber-500 uppercase mb-1">Staff Only</h5>
                 <p className="text-sm text-amber-200/80">{data.internalNotes}</p>
               </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};
